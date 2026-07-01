"""
Integration tests for Phase 12 — admin token management endpoints.
"""

from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from models.user import User, CVSession
from models.token_tracking import TokenUsageLog
from services.admin_service import create_admin_token
from services.auth_service import hash_password
from app.config import settings


@pytest.fixture()
def admin_headers() -> dict:
    token = create_admin_token()
    return {"Authorization": f"Bearer {token}"}


class TestAdminTokenSummary:
    def test_summary_requires_admin(self, test_client: TestClient, auth_headers: dict):
        """Regular user must be rejected with 403."""
        resp = test_client.get("/admin/tokens/summary", headers=auth_headers)
        assert resp.status_code == 403

    def test_summary_unauthenticated_rejected(self, test_client: TestClient):
        resp = test_client.get("/admin/tokens/summary")
        assert resp.status_code == 403

    def test_summary_returns_expected_shape(self, test_client: TestClient, admin_headers: dict):
        resp = test_client.get("/admin/tokens/summary", headers=admin_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert "tokens_today" in body
        assert "analyses_today" in body
        assert "active_users_by_tier" in body
        assert "est_monthly_cost_usd" in body
        assert "provider" in body


class TestAdminTokenUserBreakdown:
    def test_breakdown_returns_list(
        self, test_client: TestClient, admin_headers: dict, test_user: User, test_db: Session
    ):
        today = datetime.utcnow().date()
        log = TokenUsageLog(
            user_id=test_user.id,
            date=today,
            tokens_used=1000,
            operation_type="cv_analysis",
            tier="free",
        )
        test_db.add(log)
        test_db.commit()

        resp = test_client.get("/admin/tokens/users", headers=admin_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert "users" in body
        assert "date" in body
        user_ids = [u["user_id"] for u in body["users"]]
        assert test_user.id in user_ids


class TestTierChangeTakesEffect:
    def test_tier_change_takes_effect(
        self, test_client: TestClient, admin_headers: dict, test_user: User, test_db: Session
    ):
        """PATCH /admin/users/{id}/tier should update the user's tier in the DB."""
        assert test_user.tier == "free"

        resp = test_client.patch(
            f"/admin/users/{test_user.id}/tier",
            headers=admin_headers,
            params={"tier": "pro"},
        )
        assert resp.status_code == 200
        assert resp.json()["tier"] == "pro"

        test_db.refresh(test_user)
        assert test_user.tier == "pro"


class TestFreeTierQuotaBlocking:
    def test_free_tier_blocks_on_analysis_limit_in_window(
        self, test_client: TestClient, admin_headers: dict, test_db: Session
    ):
        """
        When a free-tier user has >= FREE_TIER_ANALYSIS_LIMIT CVSessions in
        the rolling window, the /analyze endpoint must return HTTP 429.
        Verifies T071's quota gate integration with token_tracker.
        """
        from services.auth_service import create_access_token

        # Create a fresh free-tier user
        user = User(
            email="quota_test@example.com",
            username="quotatest",
            hashed_password=hash_password("TestPass123!"),
            email_verified=True,
            tier="free",
        )
        test_db.add(user)
        test_db.commit()
        test_db.refresh(user)

        limit = settings.free_tier_analysis_limit
        now = datetime.utcnow()

        # Insert exactly `limit` CVSessions within the window
        for i in range(limit):
            session = CVSession(
                user_id=user.id,
                cv_filename=f"cv_{i}.pdf",
                jd_text="job description",
                created_at=now - timedelta(hours=i),
            )
            test_db.add(session)
        test_db.commit()

        # Create one more session record so /analyze has something to reference
        extra_session = CVSession(
            user_id=user.id,
            cv_filename="cv_extra.pdf",
            jd_text="job description",
            created_at=now,
        )
        test_db.add(extra_session)
        test_db.commit()
        test_db.refresh(extra_session)

        token = create_access_token(user.id)
        resp = test_client.get(
            f"/analyze?session_id={extra_session.id}&token={token}"
        )
        # Quota exceeded BEFORE any streaming response is returned
        assert resp.status_code == 429
        detail = resp.json()["detail"]
        assert detail["code"] == "quota_exceeded"
