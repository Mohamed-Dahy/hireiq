"""
token_tracker.py
----------------
Quota enforcement and token usage logging for AI operations.

Free tier : max 2 CV analyses per rolling 10-day window (CVSession count).
Paid tier : max 10,000 tokens per calendar day (TokenUsageLog sum).
"""

from datetime import datetime, date, timedelta, timezone
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.config import settings
from models.token_tracking import TokenUsageLog
from models.user import CVSession, User


# ---------------------------------------------------------------------------
# Quota checks — raise HTTP 429 if limit reached
# ---------------------------------------------------------------------------

def check_free_tier_quota(db: Session, user: User) -> None:
    """Raise HTTP 429 if the user has exhausted their free-tier analysis quota."""
    window_start = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=settings.free_tier_window_days)
    sessions_in_window = (
        db.query(CVSession)
        .filter(CVSession.user_id == user.id, CVSession.created_at >= window_start)
        .order_by(CVSession.created_at.asc())
        .all()
    )
    count = len(sessions_in_window)
    limit = settings.free_tier_analysis_limit

    # count > limit: the *current* CVSession was already created at upload time,
    # so `count` includes the session the user is currently trying to analyze.
    # We block only when they have MORE than `limit` sessions (meaning they
    # have already used all their free analyses and this is an extra attempt).
    if count > limit:
        # Reset time = oldest session in window + window length
        oldest = sessions_in_window[0].created_at
        resets_at = oldest + timedelta(days=settings.free_tier_window_days)
        raise HTTPException(
            status_code=429,
            detail={
                "code": "quota_exceeded",
                "message": f"You've used your {limit} free analyses for this period.",
                "window_resets_at": resets_at.isoformat(),
                "analyses_used": count,
                "limit": limit,
            },
        )


def check_free_tier_quota_for_new(db: Session, user: User) -> None:
    """Raise HTTP 429 if creating a NEW analysis would exceed the free-tier limit.

    Unlike check_free_tier_quota (which runs after the session row already exists
    and so uses ``count > limit``), this is called BEFORE inserting the row, so it
    blocks at ``count >= limit``. A blocked attempt therefore creates no row and
    consumes no future slot (FR-025/026).
    """
    window_start = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=settings.free_tier_window_days)
    sessions_in_window = (
        db.query(CVSession)
        .filter(CVSession.user_id == user.id, CVSession.created_at >= window_start)
        .order_by(CVSession.created_at.asc())
        .all()
    )
    count = len(sessions_in_window)
    limit = settings.free_tier_analysis_limit

    if count >= limit:
        oldest = sessions_in_window[0].created_at
        resets_at = oldest + timedelta(days=settings.free_tier_window_days)
        raise HTTPException(
            status_code=429,
            detail={
                "code": "quota_exceeded",
                "message": f"You've used your {limit} free analyses for this period.",
                "window_resets_at": resets_at.isoformat(),
                "analyses_used": count,
                "limit": limit,
            },
        )


def check_paid_tier_quota(db: Session, user: User) -> None:
    """Raise HTTP 429 if the user has exhausted today's paid-tier token budget.

    Known limitation: this is a TOCTOU check. Concurrent requests from the same
    user can both pass before either logs usage. Fixing it requires an atomic
    Redis INCRBY counter (queued as a follow-up).
    """
    today = datetime.now(timezone.utc).replace(tzinfo=None).date()
    tokens_today = (
        db.query(func.sum(TokenUsageLog.tokens_used))
        .filter(TokenUsageLog.user_id == user.id, TokenUsageLog.date == today)
        .scalar() or 0
    )
    if tokens_today >= settings.paid_tier_daily_token_limit:
        raise HTTPException(
            status_code=429,
            detail={
                "code": "token_budget_exceeded",
                "message": "You've reached your daily token budget.",
                "tokens_used_today": tokens_today,
                "daily_limit": settings.paid_tier_daily_token_limit,
                "resets_at": (datetime.now(timezone.utc).replace(tzinfo=None).replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)).isoformat(),
            },
        )


# ---------------------------------------------------------------------------
# Usage logging
# ---------------------------------------------------------------------------

def log_token_usage(
    db: Session,
    user_id: int,
    tokens_used: int,
    operation_type: str,
    tier: str,
) -> None:
    """Insert a TokenUsageLog row for the given operation."""
    row = TokenUsageLog(
        user_id=user_id,
        date=datetime.now(timezone.utc).replace(tzinfo=None).date(),
        tokens_used=tokens_used,
        operation_type=operation_type,
        tier=tier,
    )
    db.add(row)
    db.commit()


# ---------------------------------------------------------------------------
# Admin reporting
# ---------------------------------------------------------------------------

def get_admin_summary(db: Session) -> dict:
    """Return an aggregate token usage summary for the admin dashboard."""
    today = datetime.now(timezone.utc).replace(tzinfo=None).date()

    tokens_today: int = (
        db.query(func.sum(TokenUsageLog.tokens_used))
        .filter(TokenUsageLog.date == today)
        .scalar() or 0
    )
    analyses_today: int = (
        db.query(func.count(TokenUsageLog.id))
        .filter(
            TokenUsageLog.date == today,
            TokenUsageLog.operation_type == "cv_analysis",
        )
        .scalar() or 0
    )

    # Active users by tier: those with at least one log entry today
    tier_rows = (
        db.query(TokenUsageLog.tier, func.count(func.distinct(TokenUsageLog.user_id)))
        .filter(TokenUsageLog.date == today)
        .group_by(TokenUsageLog.tier)
        .all()
    )
    active_by_tier = {row[0]: row[1] for row in tier_rows}

    # Estimated monthly cost based on today's token consumption
    # groq_price_per_1k_tokens * tokens_today / 1000 * 30 days
    est_monthly_cost = round(
        settings.groq_price_per_1k_tokens * tokens_today / 1000 * 30, 4
    )

    return {
        "tokens_today": tokens_today,
        "analyses_today": analyses_today,
        "active_users_by_tier": active_by_tier,
        "est_monthly_cost_usd": est_monthly_cost,
        "provider": settings.llm_provider,
        "model": settings.llm_model,
        "price_per_1k_tokens": settings.groq_price_per_1k_tokens,
        "date": today.isoformat(),
    }


def get_user_breakdown(
    db: Session,
    for_date: Optional[date] = None,
    limit: int = 50,
) -> list:
    """Return per-user token usage for a given date, sorted descending."""
    if for_date is None:
        for_date = datetime.now(timezone.utc).replace(tzinfo=None).date()

    rows = (
        db.query(
            TokenUsageLog.user_id,
            func.sum(TokenUsageLog.tokens_used).label("tokens_used"),
            func.count(TokenUsageLog.id).label("operations"),
            TokenUsageLog.tier,
        )
        .filter(TokenUsageLog.date == for_date)
        .group_by(TokenUsageLog.user_id, TokenUsageLog.tier)
        .order_by(func.sum(TokenUsageLog.tokens_used).desc())
        .limit(limit)
        .all()
    )

    # Enrich with email/username
    result = []
    for row in rows:
        user = db.query(User).filter(User.id == row.user_id).first()
        result.append({
            "user_id": row.user_id,
            "email": user.email if user else None,
            "username": user.username if user else None,
            "tier": row.tier,
            "tokens_used": row.tokens_used,
            "operations": row.operations,
        })
    return result
