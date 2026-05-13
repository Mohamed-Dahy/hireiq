"""Referral router — Phase 9, US9

GET  /referrals/my-code       — returns or creates referral code
GET  /referrals/stats         — conversion stats for current user
GET  /referrals/leaderboard   — top referrers by username + count
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models.user import User
from models.schemas import ReferralCodeResponse, ReferralStatsResponse, LeaderboardEntry
from services.auth_service import get_current_user
from services.referral_service import (
    get_or_create_referral_code,
    get_referral_stats,
    get_leaderboard,
)
from app.config import settings

router = APIRouter()


@router.get("/my-code", response_model=ReferralCodeResponse)
def my_code(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rc = get_or_create_referral_code(db, current_user)
    referral_url = f"{settings.app_base_url}/register?ref={rc.code}"
    return ReferralCodeResponse(code=rc.code, referral_url=referral_url)


@router.get("/stats", response_model=ReferralStatsResponse)
def stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    s = get_referral_stats(db, current_user)
    return ReferralStatsResponse(**s)


@router.get("/leaderboard", response_model=list[LeaderboardEntry])
def leaderboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return get_leaderboard(db)
