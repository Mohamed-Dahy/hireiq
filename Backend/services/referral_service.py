"""Referral service — Phase 9, US9"""
import secrets
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session
from loguru import logger

from models.user import User
from models.referral import ReferralCode, ReferralConversion
from app.config import settings


def _generate_code() -> str:
    raw = secrets.token_hex(6)
    return raw[:12]


def get_or_create_referral_code(db: Session, user: User) -> ReferralCode:
    existing = db.query(ReferralCode).filter(ReferralCode.user_id == user.id).first()
    if existing:
        return existing
    code = _generate_code()
    while db.query(ReferralCode).filter(ReferralCode.code == code).first():
        code = _generate_code()
    rc = ReferralCode(user_id=user.id, code=code)
    db.add(rc)
    db.commit()
    db.refresh(rc)
    return rc


def register_via_referral(db: Session, code: str, new_user: User) -> None:
    referral_code = db.query(ReferralCode).filter(ReferralCode.code == code).first()
    if not referral_code:
        raise HTTPException(status_code=404, detail="Referral code not found")
    if referral_code.user_id == new_user.id:
        return
    existing = db.query(ReferralConversion).filter(
        ReferralConversion.referred_user_id == new_user.id
    ).first()
    if existing:
        return
    conversion = ReferralConversion(
        referrer_id=referral_code.user_id,
        referred_user_id=new_user.id,
        reward_applied=False,
        days_credited=10,
    )
    db.add(conversion)
    db.commit()


def apply_referral_reward(db: Session, referred_user_id: int) -> None:
    conversion = db.query(ReferralConversion).filter(
        ReferralConversion.referred_user_id == referred_user_id,
        ReferralConversion.reward_applied == False,
    ).first()
    if not conversion:
        return
    conversion.reward_applied = True
    conversion.converted_at = datetime.now(timezone.utc).replace(tzinfo=None)
    conversion.days_credited = 10
    db.commit()


def get_referral_stats(db: Session, user: User) -> dict:
    conversions = db.query(ReferralConversion).filter(
        ReferralConversion.referrer_id == user.id
    ).all()
    total_referred = len(conversions)
    total_converted = sum(1 for c in conversions if c.converted_at is not None)
    days_earned = total_converted * 10
    return {
        "total_referred": total_referred,
        "total_converted": total_converted,
        "days_earned": days_earned,
    }


def get_leaderboard(db: Session, limit: int = 10) -> list[dict]:
    from sqlalchemy import func
    rows = (
        db.query(
            ReferralConversion.referrer_id,
            func.count(ReferralConversion.id).label("cnt"),
        )
        .group_by(ReferralConversion.referrer_id)
        .order_by(func.count(ReferralConversion.id).desc())
        .limit(limit)
        .all()
    )
    result = []
    for row in rows:
        user = db.query(User).filter(User.id == row.referrer_id).first()
        if user:
            result.append({"username": user.username, "referral_count": int(row.cnt)})
    return result
