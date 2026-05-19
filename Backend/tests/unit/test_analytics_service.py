"""
Unit tests for analytics_service.py — Phase 10.
Uses the real test DB via the shared conftest fixtures.
"""
from sqlalchemy.orm import Session
from models.user import User
from services.analytics_service import get_platform_metrics, get_all_users
from services.auth_service import hash_password


def _make_user(db: Session, email: str, tier: str = "free", is_admin: bool = False) -> User:
    u = User(
        email=email,
        username=email.split("@")[0],
        hashed_password=hash_password("pass1234"),
        email_verified=True,
        tier=tier,
        is_admin=is_admin,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u


class TestGetPlatformMetrics:
    def test_returns_all_top_level_keys(self, test_db: Session):
        metrics = get_platform_metrics(test_db)
        assert set(metrics.keys()) == {
            "users", "cv_sessions", "interviews", "jobs",
            "roadmaps", "referrals", "interview_bank",
        }

    def test_user_counts_are_correct(self, test_db: Session):
        _make_user(test_db, "free1@x.com", tier="free")
        _make_user(test_db, "free2@x.com", tier="free")
        _make_user(test_db, "pro1@x.com", tier="pro")
        _make_user(test_db, "adm@x.com", tier="enterprise", is_admin=True)
        metrics = get_platform_metrics(test_db)
        assert metrics["users"]["total"] == 4
        assert metrics["users"]["free"] == 2
        assert metrics["users"]["paid"] == 2
        assert metrics["users"]["admins"] == 1

    def test_tier_distribution_list(self, test_db: Session):
        _make_user(test_db, "a@x.com", tier="free")
        _make_user(test_db, "b@x.com", tier="pro")
        metrics = get_platform_metrics(test_db)
        dist = {d["tier"]: d["count"] for d in metrics["users"]["tier_distribution"]}
        assert dist["free"] >= 1
        assert dist["paid"] >= 1

    def test_signup_trend_is_list(self, test_db: Session):
        metrics = get_platform_metrics(test_db)
        assert isinstance(metrics["users"]["signup_trend"], list)

    def test_empty_db_returns_zeros(self, test_db: Session):
        metrics = get_platform_metrics(test_db)
        assert metrics["users"]["total"] == 0
        assert metrics["cv_sessions"]["total"] == 0


class TestGetAllUsers:
    def test_returns_list_with_user_fields(self, test_db: Session):
        _make_user(test_db, "list@x.com")
        users = get_all_users(test_db, skip=0, limit=10)
        assert len(users) == 1
        u = users[0]
        assert "id" in u
        assert "email" in u
        assert "tier" in u
        assert "session_count" in u

    def test_pagination(self, test_db: Session):
        for i in range(5):
            _make_user(test_db, f"page{i}@x.com")
        assert len(get_all_users(test_db, skip=0, limit=3)) == 3
        assert len(get_all_users(test_db, skip=3, limit=3)) == 2
