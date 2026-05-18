"""
profile_service.py
------------------
Business logic for user profile management: extended stats, social links,
username updates, stored CV upload/deletion, and password change via OTP.
"""

import os
from datetime import datetime, timedelta
from typing import Optional

from fastapi import HTTPException, UploadFile
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import settings
from models.user import User, UserProfile, CVSession
from models.roadmap import CareerRoadmap
from models.schemas import ProfileUpdateRequest


def get_extended_profile(db: Session, user: User) -> dict:
    sessions = db.query(CVSession).filter(CVSession.user_id == user.id).all()
    scores = [s.match_score for s in sessions if s.match_score is not None]

    from models.user import InterviewResult
    session_ids = [s.id for s in sessions]
    total_interviews = 0
    if session_ids:
        total_interviews = (
            db.query(func.count(InterviewResult.id))
            .filter(InterviewResult.session_id.in_(session_ids))
            .scalar() or 0
        )

    roadmaps_generated = (
        db.query(func.count(CareerRoadmap.id))
        .filter(CareerRoadmap.user_id == user.id)
        .scalar() or 0
    )

    window_start = datetime.utcnow() - timedelta(days=settings.free_tier_window_days)
    analyses_in_window = sum(1 for s in sessions if s.created_at >= window_start)

    window_resets_at: Optional[datetime] = None
    if analyses_in_window > 0:
        oldest_in_window = min(
            (s.created_at for s in sessions if s.created_at >= window_start),
            default=None,
        )
        if oldest_in_window:
            window_resets_at = oldest_in_window + timedelta(days=settings.free_tier_window_days)

    now = datetime.utcnow()
    month_start = datetime(now.year, now.month, 1)
    sessions_this_month = sum(1 for s in sessions if s.created_at >= month_start)

    recent = sorted(sessions, key=lambda s: s.created_at, reverse=True)[:5]

    profile = user.profile

    return {
        "id": user.id,
        "email": user.email,
        "username": user.username,
        "created_at": user.created_at,
        "is_admin": user.is_admin,
        "tier": user.tier,
        "total_sessions": len(sessions),
        "avg_match_score": round(sum(scores) / len(scores), 1) if scores else None,
        "best_score": max(scores) if scores else None,
        "total_interviews": total_interviews,
        "roadmaps_generated": roadmaps_generated,
        "sessions_this_month": sessions_this_month,
        "recent_sessions": recent,
        "linkedin_url": profile.linkedin_url if profile else None,
        "github_url": profile.github_url if profile else None,
        "portfolio_url": profile.portfolio_url if profile else None,
        "bio": profile.bio if profile else None,
        "stored_cv_filename": profile.stored_cv_filename if profile else None,
        "has_stored_cv": bool(profile and profile.stored_cv_path),
        "analyses_in_window": analyses_in_window,
        "window_resets_at": window_resets_at,
    }


def update_profile(db: Session, user: User, data: ProfileUpdateRequest) -> None:
    if data.linkedin_url is not None and data.linkedin_url != "":
        if not data.linkedin_url.startswith("https://linkedin.com/"):
            raise HTTPException(status_code=422, detail="LinkedIn URL must start with https://linkedin.com/")

    if data.github_url is not None and data.github_url != "":
        if not data.github_url.startswith("https://github.com/"):
            raise HTTPException(status_code=422, detail="GitHub URL must start with https://github.com/")

    if data.portfolio_url is not None and data.portfolio_url != "":
        if not data.portfolio_url.startswith("https://"):
            raise HTTPException(status_code=422, detail="Portfolio URL must use HTTPS")

    if data.username is not None:
        existing = db.query(User).filter(
            User.username == data.username, User.id != user.id
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Username already taken.")
        user.username = data.username

    profile = user.profile
    if profile is None:
        profile = UserProfile(user_id=user.id)
        db.add(profile)

    if data.bio is not None:
        profile.bio = data.bio
    if data.linkedin_url is not None:
        profile.linkedin_url = data.linkedin_url or None
    if data.github_url is not None:
        profile.github_url = data.github_url or None
    if data.portfolio_url is not None:
        profile.portfolio_url = data.portfolio_url or None

    profile.updated_at = datetime.utcnow()
    db.commit()


async def save_stored_cv(db: Session, user: User, file: UploadFile) -> str:
    if file.content_type not in ("application/pdf", "application/octet-stream"):
        if not (file.filename or "").lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="File size exceeds the 5MB limit.")

    user_cv_dir = os.path.join(settings.upload_dir, "profiles", str(user.id))
    os.makedirs(user_cv_dir, exist_ok=True)

    cv_path = os.path.join(user_cv_dir, "cv.pdf")
    with open(cv_path, "wb") as f:
        f.write(contents)

    profile = user.profile
    if profile is None:
        profile = UserProfile(user_id=user.id)
        db.add(profile)

    profile.stored_cv_path = cv_path
    profile.stored_cv_filename = file.filename or "cv.pdf"
    profile.updated_at = datetime.utcnow()
    db.commit()

    return profile.stored_cv_filename


def delete_stored_cv(db: Session, user: User) -> None:
    profile = user.profile
    if not profile or not profile.stored_cv_path:
        raise HTTPException(status_code=404, detail="No stored CV found.")

    try:
        if os.path.exists(profile.stored_cv_path):
            os.remove(profile.stored_cv_path)
    except OSError:
        pass

    profile.stored_cv_path = None
    profile.stored_cv_filename = None
    profile.updated_at = datetime.utcnow()
    db.commit()
