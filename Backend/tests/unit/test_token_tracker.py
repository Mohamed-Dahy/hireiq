"""
Unit tests for services/token_tracker.py
All DB interactions use in-memory SQLite via a shared SQLAlchemy session.
"""

from datetime import datetime, timedelta

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import models.token_tracking  # noqa: F401 — registers TokenUsageLog
from models.user import Base, User, CVSession
from services.token_tracker import (
    check_free_tier_quota,
    check_paid_tier_quota,
    log_token_usage,
)
from app.config import settings


# ---------------------------------------------------------------------------
# In-memory SQLite fixture (isolated from the integration test DB)
# ---------------------------------------------------------------------------

@pytest.fixture()
def mem_db():
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    db = Session()
    yield db
    db.close()
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def free_user(mem_db):
    user = User(
        email="free@example.com",
        username="freeuser",
        hashed_password="hashed",
        email_verified=True,
        tier="free",
    )
    mem_db.add(user)
    mem_db.commit()
    mem_db.refresh(user)
    return user


@pytest.fixture()
def paid_user(mem_db):
    user = User(
        email="paid@example.com",
        username="paiduser",
        hashed_password="hashed",
        email_verified=True,
        tier="pro",
    )
    mem_db.add(user)
    mem_db.commit()
    mem_db.refresh(user)
    return user


# ---------------------------------------------------------------------------
# T073 test cases
# ---------------------------------------------------------------------------

def test_free_tier_quota_not_exceeded_passes(mem_db, free_user):
    """User with 0 sessions in window — quota check should pass without error."""
    check_free_tier_quota(mem_db, free_user)  # must not raise


def test_free_tier_quota_exceeded_raises_429(mem_db, free_user):
    """
    When a free-tier user has >= FREE_TIER_ANALYSIS_LIMIT sessions in the
    rolling window, check_free_tier_quota must raise HTTP 429.
    """
    limit = settings.free_tier_analysis_limit
    now = datetime.utcnow()

    # Create limit+1 sessions: the current session is already counted at upload
    # time, so we need count > limit to trigger 429 (not count >= limit).
    for i in range(limit + 1):
        session = CVSession(
            user_id=free_user.id,
            cv_filename=f"cv_{i}.pdf",
            jd_text="some job description",
            created_at=now - timedelta(days=i),
        )
        mem_db.add(session)
    mem_db.commit()

    with pytest.raises(HTTPException) as exc_info:
        check_free_tier_quota(mem_db, free_user)

    assert exc_info.value.status_code == 429
    detail = exc_info.value.detail
    assert detail["code"] == "quota_exceeded"
    assert detail["analyses_used"] == limit + 1
    assert detail["limit"] == limit
    assert "window_resets_at" in detail


def test_paid_tier_quota_exceeded_raises_429(mem_db, paid_user):
    """
    When a paid-tier user has tokens_used >= PAID_TIER_DAILY_TOKEN_LIMIT today,
    check_paid_tier_quota must raise HTTP 429.
    """
    from models.token_tracking import TokenUsageLog

    today = datetime.utcnow().date()
    log = TokenUsageLog(
        user_id=paid_user.id,
        date=today,
        tokens_used=settings.paid_tier_daily_token_limit,
        operation_type="cv_analysis",
        tier="pro",
    )
    mem_db.add(log)
    mem_db.commit()

    with pytest.raises(HTTPException) as exc_info:
        check_paid_tier_quota(mem_db, paid_user)

    assert exc_info.value.status_code == 429
    detail = exc_info.value.detail
    assert detail["code"] == "token_budget_exceeded"
    assert detail["tokens_used_today"] >= settings.paid_tier_daily_token_limit


def test_log_token_usage_inserts_row(mem_db, free_user):
    """log_token_usage should insert exactly one TokenUsageLog row."""
    from models.token_tracking import TokenUsageLog

    log_token_usage(mem_db, free_user.id, 512, "cv_analysis", "free")

    rows = mem_db.query(TokenUsageLog).filter(TokenUsageLog.user_id == free_user.id).all()
    assert len(rows) == 1
    assert rows[0].tokens_used == 512
    assert rows[0].operation_type == "cv_analysis"
    assert rows[0].tier == "free"
    assert rows[0].date == datetime.utcnow().date()
