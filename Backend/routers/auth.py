"""
routers/auth.py
---------------
POST   /auth/register           — create account, send verification email
POST   /auth/login              — verify credentials, return tokens
POST   /auth/logout             — blacklist JTIs
POST   /auth/refresh            — rotate refresh token
GET    /auth/me                 — current user profile
POST   /auth/verify-email       — consume email verification token
POST   /auth/resend-verification — re-send verification email
POST   /auth/forgot-password    — send password reset email
POST   /auth/reset-password     — consume reset token, set new password
DELETE /auth/account            — permanently delete account and all data
"""

import os
import time

from fastapi import APIRouter, Body, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from limiter import limiter
from models.user import User, CVSession, InterviewResult, EmailVerificationToken, PasswordResetToken
from models.schemas import (
    RegisterRequest,
    LoginRequest,
    TokenResponse,
    RegisterResponse,
    MessageResponse,
    EmailRequest,
    ResetPasswordRequest,
    UserProfileResponse,
)
from services.auth_service import (
    bearer_scheme,
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
    blacklist_jti,
    is_jti_blacklisted,
    check_account_locked,
    record_failed_login,
    reset_failed_login,
    create_verification_token,
    consume_verification_token,
    create_password_reset_token,
    consume_password_reset_token,
    check_forgot_password_rate,
    RESET_MINUTES,
)
from services.email_service import (
    send_verification_email,
    send_password_reset_email,
    send_account_deletion_email,
)
from services.security_service import write_audit_log
from services.rag_scorer import delete_embeddings
from app.config import settings

router = APIRouter()


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


@router.post("/register", response_model=RegisterResponse, status_code=201)
@limiter.limit("3/minute")
async def register(request: Request, payload: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")

    user = User(
        email=payload.email,
        username=payload.username,
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_verification_token(db, user.id)
    send_verification_email(user.email, user.username, token)

    return RegisterResponse(
        message="Account created. Please check your email to verify your account.",
        email=user.email,
    )


@router.post("/login", response_model=TokenResponse)
@limiter.limit("5/minute")
async def login(request: Request, payload: LoginRequest, db: Session = Depends(get_db)):
    ip = _client_ip(request)
    user = db.query(User).filter(User.email == payload.email).first()

    # Constant-time: always check password even on missing user (prevents timing oracle)
    dummy_hash = "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdFMkS0mMlFLVkq"
    if not user:
        verify_password(payload.password, dummy_hash)
        write_audit_log(db, "auth.login.failed", ip, "blocked", detail="unknown email")
        raise HTTPException(status_code=401, detail="Invalid email or password")

    check_account_locked(user)

    if not verify_password(payload.password, user.hashed_password):
        record_failed_login(db, user)
        write_audit_log(db, "auth.login.failed", ip, "blocked", user_id=user.id, detail="bad password")
        raise HTTPException(status_code=401, detail="Invalid email or password")

    if not user.email_verified:
        write_audit_log(db, "auth.login.failed", ip, "blocked", user_id=user.id, detail="email not verified")
        raise HTTPException(
            status_code=403,
            detail="Email not verified. Please check your inbox or request a new verification link.",
        )

    reset_failed_login(db, user)
    write_audit_log(db, "auth.login.success", ip, "allowed", user_id=user.id)

    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


@router.post("/logout", response_model=MessageResponse)
def logout(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    refresh_token: str = Body(None, embed=True),
    db: Session = Depends(get_db),
):
    access_payload = decode_token(credentials.credentials)
    if access_payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token type")

    jti = access_payload.get("jti")
    if jti:
        remaining = int(access_payload["exp"]) - int(time.time())
        if remaining > 0:
            blacklist_jti(jti, remaining)

    if refresh_token:
        try:
            ref_payload = decode_token(refresh_token)
            ref_jti = ref_payload.get("jti")
            if ref_jti:
                remaining = int(ref_payload["exp"]) - int(time.time())
                if remaining > 0:
                    blacklist_jti(ref_jti, remaining)
        except HTTPException:
            pass  # Expired/invalid refresh token is fine — blacklist what we can

    user_id = access_payload.get("sub")
    write_audit_log(
        db, "auth.logout", _client_ip(request), "allowed",
        user_id=int(user_id) if user_id else None,
    )
    return MessageResponse(message="Logged out successfully")


@router.post("/refresh", response_model=TokenResponse)
def refresh(refresh_token: str = Body(..., embed=True), db: Session = Depends(get_db)):
    payload = decode_token(refresh_token)

    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid token type")

    old_jti = payload.get("jti")
    if old_jti and is_jti_blacklisted(old_jti):
        raise HTTPException(status_code=401, detail="Refresh token has been revoked")

    # Blacklist the old refresh JTI before issuing new tokens (token rotation)
    if old_jti:
        remaining = int(payload["exp"]) - int(time.time())
        if remaining > 0:
            blacklist_jti(old_jti, remaining)

    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=create_refresh_token(user.id),
    )


@router.get("/me", response_model=UserProfileResponse)
def get_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sessions = db.query(CVSession).filter(CVSession.user_id == current_user.id).all()
    scores = [s.match_score for s in sessions if s.match_score is not None]
    session_ids = [s.id for s in sessions]

    total_interviews = 0
    if session_ids:
        total_interviews = (
            db.query(func.count(InterviewResult.id))
            .filter(InterviewResult.session_id.in_(session_ids))
            .scalar() or 0
        )

    return UserProfileResponse(
        id=current_user.id,
        email=current_user.email,
        username=current_user.username,
        created_at=current_user.created_at,
        total_sessions=len(sessions),
        avg_match_score=round(sum(scores) / len(scores), 1) if scores else None,
        total_interviews=total_interviews,
        best_score=max(scores) if scores else None,
    )


@router.post("/verify-email", response_model=MessageResponse)
def verify_email(
    request: Request,
    token: str = Body(..., embed=True),
    db: Session = Depends(get_db),
):
    user = consume_verification_token(db, token)
    write_audit_log(db, "auth.email_verified", _client_ip(request), "allowed", user_id=user.id)
    return MessageResponse(message="Email verified. You can now log in.")


@router.post("/resend-verification", response_model=MessageResponse)
@limiter.limit("2/minute")
async def resend_verification(
    request: Request,
    payload: EmailRequest,
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.email == payload.email).first()
    # Always return 200 — don't reveal whether the email exists
    if user and not user.email_verified:
        token = create_verification_token(db, user.id)
        send_verification_email(user.email, user.username, token)
    return MessageResponse(message="If that email exists and is unverified, a new link has been sent.")


@router.post("/forgot-password", response_model=MessageResponse)
@limiter.limit("5/hour")
async def forgot_password(
    request: Request,
    payload: EmailRequest,
    db: Session = Depends(get_db),
):
    check_forgot_password_rate(payload.email)  # per-email: 3 per 15 min
    user = db.query(User).filter(User.email == payload.email).first()
    # Always return 200 — don't reveal whether the email exists
    if user and user.email_verified:
        token = create_password_reset_token(db, user.id)
        send_password_reset_email(user.email, user.username, token)
    return MessageResponse(message=f"If that email is registered, a reset link has been sent (valid {RESET_MINUTES} min).")


@router.post("/reset-password", response_model=MessageResponse)
def reset_password(
    request: Request,
    payload: ResetPasswordRequest,
    db: Session = Depends(get_db),
):
    from datetime import datetime as _dt
    user = consume_password_reset_token(db, payload.token)
    user.hashed_password = hash_password(payload.new_password)
    user.sessions_revoked_at = _dt.utcnow()  # invalidate all tokens issued before now
    reset_failed_login(db, user)
    db.commit()
    write_audit_log(db, "auth.password_change", _client_ip(request), "allowed", user_id=user.id)
    return MessageResponse(message="Password reset successfully. You can now log in.")


@router.delete("/account", response_model=MessageResponse)
def delete_account(
    request: Request,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
):
    """
    Permanently delete the authenticated user's account and all associated data.
    Blacklists the current access token immediately so it cannot be reused.
    """
    access_payload = decode_token(credentials.credentials)
    if access_payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token type")

    # Blacklist the current access token
    jti = access_payload.get("jti")
    if jti:
        remaining = int(access_payload["exp"]) - int(time.time())
        if remaining > 0:
            blacklist_jti(jti, remaining)

    user_id = int(access_payload.get("sub", 0))
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    ip = _client_ip(request)

    # Delete CV files from disk and ChromaDB embeddings
    sessions = db.query(CVSession).filter(CVSession.user_id == user.id).all()
    for session in sessions:
        cv_path = os.path.join(settings.upload_dir, session.cv_filename)
        try:
            if os.path.exists(cv_path):
                os.remove(cv_path)
        except OSError:
            pass  # Non-fatal: continue deletion even if file is already gone
        try:
            delete_embeddings(session.id)
        except Exception:
            pass

    # Cascade delete all user data
    session_ids = [s.id for s in sessions]
    if session_ids:
        db.query(InterviewResult).filter(InterviewResult.session_id.in_(session_ids)).delete(synchronize_session=False)
    db.query(CVSession).filter(CVSession.user_id == user.id).delete(synchronize_session=False)
    db.query(EmailVerificationToken).filter(EmailVerificationToken.user_id == user.id).delete(synchronize_session=False)
    db.query(PasswordResetToken).filter(PasswordResetToken.user_id == user.id).delete(synchronize_session=False)

    email = user.email
    username = user.username
    db.delete(user)
    db.commit()

    # Audit log uses no user_id — the user record is gone
    write_audit_log(db, "auth.account_deleted", ip, "allowed", detail=f"user_id={user_id}")

    send_account_deletion_email(email, username)

    return MessageResponse(message="Account permanently deleted.")
