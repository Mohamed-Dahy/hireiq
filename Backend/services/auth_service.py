"""
auth_service.py
---------------
Password hashing, JWT helpers, JTI blacklisting, account lockout,
and email verification / password reset token management.
"""

import uuid
from datetime import datetime, timedelta

import bcrypt
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from loguru import logger
from sqlalchemy.orm import Session

from app.config import settings
from database import get_db
from models.user import User, EmailVerificationToken, PasswordResetToken
from services.cache import redis_client

bearer_scheme = HTTPBearer()

MAX_FAILED_LOGINS = 5
LOCKOUT_MINUTES = 15
VERIFICATION_HOURS = 24
RESET_MINUTES = 60


# ---------------------------------------------------------------------------
# Password helpers
# ---------------------------------------------------------------------------

def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))


# ---------------------------------------------------------------------------
# JWT helpers
# ---------------------------------------------------------------------------

def _new_jti() -> str:
    return str(uuid.uuid4())


def create_access_token(user_id: int) -> str:
    jti = _new_jti()
    now = datetime.utcnow()
    payload = {
        "sub": str(user_id),
        "jti": jti,
        "iat": now,
        "exp": now + timedelta(minutes=settings.access_token_expire_minutes),
        "type": "access",
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_refresh_token(user_id: int) -> str:
    jti = _new_jti()
    now = datetime.utcnow()
    payload = {
        "sub": str(user_id),
        "jti": jti,
        "iat": now,
        "exp": now + timedelta(days=7),
        "type": "refresh",
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict:
    """Decode and validate a JWT. Raises 401 if invalid or expired."""
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ---------------------------------------------------------------------------
# JTI blacklist (Redis) — fail-open: if Redis is down, auth continues
# ---------------------------------------------------------------------------

def _jti_key(jti: str) -> str:
    return f"jti:blacklist:{jti}"


def blacklist_jti(jti: str, ttl_seconds: int) -> None:
    try:
        redis_client.setex(_jti_key(jti), ttl_seconds, "1")
    except Exception:
        logger.warning("Redis unavailable — JTI {} not blacklisted", jti)


def is_jti_blacklisted(jti: str) -> bool:
    try:
        return redis_client.exists(_jti_key(jti)) == 1
    except Exception:
        logger.warning("Redis unavailable — JTI blacklist check skipped for {}", jti)
        return False  # fail-open: let request through


# ---------------------------------------------------------------------------
# Account lockout
# ---------------------------------------------------------------------------

def check_account_locked(user: User) -> None:
    if user.locked_until and user.locked_until > datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=f"Account locked until {user.locked_until.isoformat()}",
        )


def record_failed_login(db: Session, user: User) -> None:
    user.failed_login_count = (user.failed_login_count or 0) + 1
    if user.failed_login_count >= MAX_FAILED_LOGINS:
        user.locked_until = datetime.utcnow() + timedelta(minutes=LOCKOUT_MINUTES)
        logger.warning("Account {} locked after {} failed attempts", user.email, MAX_FAILED_LOGINS)
    db.commit()


def reset_failed_login(db: Session, user: User) -> None:
    if user.failed_login_count or user.locked_until:
        user.failed_login_count = 0
        user.locked_until = None
        db.commit()


# ---------------------------------------------------------------------------
# Forgot-password per-email rate limit (3 requests per 15 minutes)
# ---------------------------------------------------------------------------

_FP_MAX_ATTEMPTS = 3
_FP_WINDOW_SECONDS = LOCKOUT_MINUTES * 60  # 900 s = 15 min


def check_forgot_password_rate(email: str) -> None:
    key = f"fp:rate:{email.lower()}"
    try:
        count = redis_client.incr(key)
        if count == 1:
            redis_client.expire(key, _FP_WINDOW_SECONDS)
        if count > _FP_MAX_ATTEMPTS:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Too many password reset requests. Please wait {LOCKOUT_MINUTES} minutes.",
            )
    except HTTPException:
        raise
    except Exception:
        logger.warning("Redis unavailable — forgot-password email rate limit skipped for {}", email)


# ---------------------------------------------------------------------------
# Email verification tokens
# ---------------------------------------------------------------------------

def create_verification_token(db: Session, user_id: int) -> str:
    # Invalidate any previous unused tokens
    db.query(EmailVerificationToken).filter(
        EmailVerificationToken.user_id == user_id,
        EmailVerificationToken.used_at.is_(None),
    ).update({"used_at": datetime.utcnow()})

    raw_token = str(uuid.uuid4())
    record = EmailVerificationToken(
        user_id=user_id,
        token=raw_token,
        expires_at=datetime.utcnow() + timedelta(hours=VERIFICATION_HOURS),
    )
    db.add(record)
    db.commit()
    return raw_token


def consume_verification_token(db: Session, token: str) -> User:
    record = db.query(EmailVerificationToken).filter(
        EmailVerificationToken.token == token
    ).first()

    if not record:
        raise HTTPException(status_code=400, detail="Invalid verification token")
    if record.used_at is not None:
        raise HTTPException(status_code=400, detail="Token already used")
    if record.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Token expired")

    record.used_at = datetime.utcnow()
    user = db.query(User).filter(User.id == record.user_id).first()
    user.email_verified = True
    db.commit()
    return user


# ---------------------------------------------------------------------------
# Password reset tokens
# ---------------------------------------------------------------------------

def create_password_reset_token(db: Session, user_id: int) -> str:
    # Invalidate any previous unused tokens
    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user_id,
        PasswordResetToken.used_at.is_(None),
    ).update({"used_at": datetime.utcnow()})

    raw_token = str(uuid.uuid4())
    record = PasswordResetToken(
        user_id=user_id,
        token=raw_token,
        expires_at=datetime.utcnow() + timedelta(minutes=RESET_MINUTES),
    )
    db.add(record)
    db.commit()
    return raw_token


def consume_password_reset_token(db: Session, token: str) -> User:
    record = db.query(PasswordResetToken).filter(
        PasswordResetToken.token == token
    ).first()

    if not record:
        raise HTTPException(status_code=400, detail="Invalid reset token")
    if record.used_at is not None:
        raise HTTPException(status_code=400, detail="Token already used")
    if record.expires_at < datetime.utcnow():
        raise HTTPException(status_code=400, detail="Token expired")

    record.used_at = datetime.utcnow()
    db.commit()
    user = db.query(User).filter(User.id == record.user_id).first()
    return user


# ---------------------------------------------------------------------------
# Ownership check — raises 404 (not 403) to avoid resource-existence disclosure
# ---------------------------------------------------------------------------

def require_ownership(resource_user_id: int, current_user_id: int) -> None:
    if resource_user_id != current_user_id:
        raise HTTPException(status_code=404, detail="Not found")


# ---------------------------------------------------------------------------
# FastAPI dependency — use in any protected route
# ---------------------------------------------------------------------------

def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    payload = decode_token(credentials.credentials)

    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token type")

    jti = payload.get("jti")
    if jti and is_jti_blacklisted(jti):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=401, detail="Token missing subject")

    user = db.query(User).filter(User.id == int(user_id)).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")

    check_account_locked(user)

    return user
