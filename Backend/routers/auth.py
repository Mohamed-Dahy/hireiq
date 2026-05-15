"""
routers/auth.py
---------------
POST   /auth/register           — create account, send OTP email
POST   /auth/login              — verify credentials, return tokens
POST   /auth/logout             — blacklist JTIs
POST   /auth/refresh            — rotate refresh token
GET    /auth/me                 — current user profile
POST   /auth/send-otp           — send OTP for any purpose
POST   /auth/verify-otp         — verify OTP code
POST   /auth/forgot-password    — send password reset OTP
POST   /auth/reset-password     — consume reset token, set new password
DELETE /auth/account            — permanently delete account and all data
"""

import os
import time
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query, Request, status
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from limiter import limiter
from models.user import User, CVSession, InterviewResult, OtpCode
from models.roadmap import CareerRoadmap
from models.schemas import (
    RegisterRequest,
    LoginRequest,
    TokenResponse,
    RegisterResponse,
    MessageResponse,
    EmailRequest,
    ResetPasswordRequest,
    UserProfileResponse,
    CVSessionResponse,
    OtpSendRequest,
    OtpVerifyRequest,
    PasswordResetWithTokenRequest,
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
    check_forgot_password_rate,
    create_reset_session,
    consume_reset_session,
    create_default_profile,
)
from services import otp_service
from services.email_service import send_otp_email, send_account_deletion_email
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
async def register(
    request: Request,
    payload: RegisterRequest,
    ref: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
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

    create_default_profile(db, user.id)

    if ref:
        from services.referral_service import register_via_referral
        try:
            register_via_referral(db, ref, user)
        except Exception:
            pass

    code = otp_service.create_otp(db, user.email, "registration")
    send_otp_email(user.email, user.username, code, "registration")

    return RegisterResponse(
        message="Account created. A 5-digit verification code has been sent to your email.",
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

    now = datetime.utcnow()
    month_start = datetime(now.year, now.month, 1)
    sessions_this_month = sum(1 for s in sessions if s.created_at >= month_start)

    roadmaps_generated = (
        db.query(func.count(CareerRoadmap.id))
        .filter(CareerRoadmap.user_id == current_user.id)
        .scalar() or 0
    )

    recent = sorted(sessions, key=lambda s: s.created_at, reverse=True)[:5]

    window_start = datetime.utcnow() - timedelta(days=settings.free_tier_window_days)
    analyses_in_window = sum(1 for s in sessions if s.created_at >= window_start)
    window_resets_at = None
    if analyses_in_window > 0:
        oldest = min((s.created_at for s in sessions if s.created_at >= window_start), default=None)
        if oldest:
            window_resets_at = oldest + timedelta(days=settings.free_tier_window_days)

    profile = current_user.profile

    return UserProfileResponse(
        id=current_user.id,
        email=current_user.email,
        username=current_user.username,
        created_at=current_user.created_at,
        is_admin=current_user.is_admin,
        tier=current_user.tier,
        total_sessions=len(sessions),
        avg_match_score=round(sum(scores) / len(scores), 1) if scores else None,
        total_interviews=total_interviews,
        best_score=max(scores) if scores else None,
        sessions_this_month=sessions_this_month,
        roadmaps_generated=roadmaps_generated,
        recent_sessions=[CVSessionResponse.model_validate(s) for s in recent],
        linkedin_url=profile.linkedin_url if profile else None,
        github_url=profile.github_url if profile else None,
        portfolio_url=profile.portfolio_url if profile else None,
        bio=profile.bio if profile else None,
        stored_cv_filename=profile.stored_cv_filename if profile else None,
        has_stored_cv=bool(profile and profile.stored_cv_path),
        analyses_in_window=analyses_in_window,
        window_resets_at=window_resets_at,
    )


@router.post("/send-otp", response_model=MessageResponse)
@limiter.limit("5/minute")
async def send_otp(
    request: Request,
    payload: OtpSendRequest,
    db: Session = Depends(get_db),
):
    otp_service.check_otp_rate_limit(payload.email)
    user = db.query(User).filter(User.email == payload.email).first()
    if user:
        code = otp_service.create_otp(db, payload.email, payload.purpose, user.id)
        send_otp_email(payload.email, user.username, code, payload.purpose)
    return MessageResponse(message="A 5-digit code has been sent to your email. Valid for 10 minutes.")


@router.post("/verify-otp")
def verify_otp(
    request: Request,
    payload: OtpVerifyRequest,
    db: Session = Depends(get_db),
):
    ok, reason = otp_service.verify_otp(db, payload.email, payload.code, payload.purpose)
    if not ok:
        if reason == "expired":
            raise HTTPException(status_code=400, detail="Code has expired. Please request a new one.")
        if reason == "locked":
            raise HTTPException(status_code=400, detail="Too many incorrect attempts. Please request a new code.")
        record = db.query(OtpCode).filter(
            OtpCode.email == payload.email.lower(),
            OtpCode.purpose == payload.purpose,
            OtpCode.used_at.is_(None),
        ).order_by(OtpCode.created_at.desc()).first()
        remaining = (settings.otp_max_attempts - record.attempt_count) if record else 0
        raise HTTPException(status_code=400, detail=f"Invalid code. {remaining} attempts remaining.")

    if payload.purpose == "registration":
        user = db.query(User).filter(User.email == payload.email).first()
        if user:
            user.email_verified = True
            db.commit()
            write_audit_log(db, "auth.email_verified", _client_ip(request), "allowed", user_id=user.id)
        return MessageResponse(message="Email verified. You can now log in.")

    if payload.purpose == "password_reset":
        user = db.query(User).filter(User.email == payload.email).first()
        if not user:
            raise HTTPException(status_code=400, detail="User not found.")
        reset_token = create_reset_session(user.id)
        return {"message": "Code verified.", "reset_token": reset_token}

    raise HTTPException(status_code=400, detail="Invalid purpose.")


@router.post("/forgot-password", response_model=MessageResponse)
@limiter.limit("5/hour")
async def forgot_password(
    request: Request,
    payload: EmailRequest,
    db: Session = Depends(get_db),
):
    check_forgot_password_rate(payload.email)
    otp_service.check_otp_rate_limit(payload.email)
    user = db.query(User).filter(User.email == payload.email).first()
    if user and user.email_verified:
        code = otp_service.create_otp(db, payload.email, "password_reset", user.id)
        send_otp_email(payload.email, user.username, code, "password_reset")
    return MessageResponse(message="If that email is registered, a 5-digit reset code has been sent.")


@router.post("/reset-password", response_model=MessageResponse)
def reset_password(
    request: Request,
    payload: PasswordResetWithTokenRequest,
    db: Session = Depends(get_db),
):
    user_id = consume_reset_session(payload.reset_token)
    if user_id is None:
        raise HTTPException(status_code=400, detail="Invalid or expired reset token.")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=400, detail="User not found.")
    user.hashed_password = hash_password(payload.new_password)
    user.sessions_revoked_at = datetime.utcnow()
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
    email = user.email
    username = user.username
    db.delete(user)
    db.commit()

    # Audit log uses no user_id — the user record is gone
    write_audit_log(db, "auth.account_deleted", ip, "allowed", detail=f"user_id={user_id}")

    send_account_deletion_email(email, username)

    return MessageResponse(message="Account permanently deleted.")
