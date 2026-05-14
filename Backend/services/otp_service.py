import secrets
import hmac as hmac_lib
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.config import settings
from models.user import OtpCode
from services.cache import redis_client
from fastapi import HTTPException, status


def generate_otp() -> str:
    return f"{secrets.randbelow(100000):05d}"


def hmac_code(code: str, secret: str) -> str:
    return hmac_lib.new(secret.encode(), code.encode(), digestmod="sha256").hexdigest()


def create_otp(db: Session, email: str, purpose: str, user_id: int | None = None) -> str:
    db.query(OtpCode).filter(
        OtpCode.email == email.lower(),
        OtpCode.purpose == purpose,
        OtpCode.used_at.is_(None),
    ).update({"used_at": datetime.utcnow()})

    code = generate_otp()
    record = OtpCode(
        email=email.lower(),
        user_id=user_id,
        code_hmac=hmac_code(code, settings.otp_hmac_secret),
        purpose=purpose,
        expires_at=datetime.utcnow() + timedelta(minutes=settings.otp_expiry_minutes),
    )
    db.add(record)
    db.commit()
    return code


def verify_otp(db: Session, email: str, code: str, purpose: str) -> tuple[bool, str]:
    record = (
        db.query(OtpCode)
        .filter(
            OtpCode.email == email.lower(),
            OtpCode.purpose == purpose,
            OtpCode.used_at.is_(None),
        )
        .order_by(OtpCode.created_at.desc())
        .first()
    )
    if record is None:
        return False, "invalid"
    if record.expires_at < datetime.utcnow():
        return False, "expired"
    if record.attempt_count >= settings.otp_max_attempts:
        return False, "locked"

    expected = hmac_code(code, settings.otp_hmac_secret)
    if not hmac_lib.compare_digest(expected, record.code_hmac):
        record.attempt_count += 1
        if record.attempt_count >= settings.otp_max_attempts:
            record.used_at = datetime.utcnow()
        db.commit()
        return False, "invalid"

    record.used_at = datetime.utcnow()
    db.commit()
    return True, "ok"


def check_otp_rate_limit(email: str) -> None:
    key = f"otp:rate:{email.lower()}"
    try:
        count = redis_client.incr(key)
        if count == 1:
            redis_client.expire(key, 1800)
        if count > settings.otp_rate_limit_per_30min:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many OTP requests. Please wait before requesting a new code.",
            )
    except HTTPException:
        raise
    except Exception:
        pass
