"""
routers/profile.py
------------------
GET    /profile/me               — extended profile with stats
PUT    /profile/update           — update username, bio, social links
POST   /profile/cv               — upload stored personal CV (PDF, max 5MB)
DELETE /profile/cv               — remove stored CV
POST   /profile/send-change-otp  — send password-change OTP to user's email
POST   /profile/change-password  — verify OTP and update password
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from sqlalchemy.orm import Session

from database import get_db
from limiter import limiter
from models.schemas import (
    ChangePasswordRequest,
    CVSessionResponse,
    MessageResponse,
    ProfileUpdateRequest,
    UserProfileResponse,
)
from models.user import User
from services import otp_service
from services.auth_service import get_current_user, hash_password
from services.email_service import send_otp_email
from services.profile_service import (
    delete_stored_cv,
    get_extended_profile,
    save_stored_cv,
    update_profile,
)

router = APIRouter()


@router.get("/me", response_model=UserProfileResponse)
def get_profile_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = get_extended_profile(db, current_user)
    data["recent_sessions"] = [CVSessionResponse.model_validate(s) for s in data["recent_sessions"]]
    return UserProfileResponse(**data)


@router.put("/update", response_model=MessageResponse)
def update_profile_endpoint(
    payload: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    update_profile(db, current_user, payload)
    return MessageResponse(message="Profile updated successfully.")


@router.post("/cv", response_model=dict)
async def upload_stored_cv(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    filename = await save_stored_cv(db, current_user, file)
    return {"message": "CV stored successfully.", "filename": filename}


@router.delete("/cv", response_model=MessageResponse)
def remove_stored_cv(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    delete_stored_cv(db, current_user)
    return MessageResponse(message="Stored CV removed.")


@router.post("/send-change-otp", response_model=MessageResponse)
@limiter.limit("3/30minute")
async def send_change_otp(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    otp_service.check_otp_rate_limit(current_user.email)
    code = otp_service.create_otp(db, current_user.email, "password_change", current_user.id)
    send_otp_email(current_user.email, current_user.username, code, "password_change")
    return MessageResponse(message="A 5-digit confirmation code has been sent to your registered email.")


@router.post("/change-password", response_model=MessageResponse)
def change_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ok, reason = otp_service.verify_otp(db, current_user.email, payload.otp_code, "password_change")
    if not ok:
        if reason == "expired":
            raise HTTPException(status_code=400, detail="Code has expired. Please request a new one.")
        if reason == "locked":
            raise HTTPException(status_code=400, detail="Too many incorrect attempts. Please request a new code.")
        from models.user import OtpCode
        from app.config import settings
        record = db.query(OtpCode).filter(
            OtpCode.email == current_user.email.lower(),
            OtpCode.purpose == "password_change",
            OtpCode.used_at.is_(None),
        ).order_by(OtpCode.created_at.desc()).first()
        remaining = (settings.otp_max_attempts - record.attempt_count) if record else 0
        raise HTTPException(status_code=400, detail=f"Invalid code. {remaining} attempts remaining.")

    current_user.hashed_password = hash_password(payload.new_password)
    current_user.sessions_revoked_at = datetime.now(timezone.utc).replace(tzinfo=None)
    db.commit()
    return MessageResponse(message="Password changed successfully. All other sessions have been revoked.")
