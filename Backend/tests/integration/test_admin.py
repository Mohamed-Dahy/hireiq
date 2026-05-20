"""
Integration tests for admin panel — Phase 10.
Admin is env-based (no DB user), authenticated via role-claim JWT.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from models.user import User
from services.admin_service import create_admin_token
from services.auth_service import hash_password


@pytest.fixture()
def admin_headers() -> dict:
    token = create_admin_token()
    return {"Authorization": f"Bearer {token}"}


class TestAdminLogin:
    def test_valid_credentials_return_token(self, test_client: TestClient):
        resp = test_client.post("/admin/login", json={"email": "admin@hireiq.com", "password": "admin_hireiq"})
        assert resp.status_code == 200
        body = resp.json()
        assert "access_token" in body
        assert body["token_type"] == "bearer"

    def test_wrong_password_rejected(self, test_client: TestClient):
        resp = test_client.post("/admin/login", json={"email": "admin@hireiq.com", "password": "wrong"})
        assert resp.status_code == 401

    def test_wrong_email_rejected(self, test_client: TestClient):
        resp = test_client.post("/admin/login", json={"email": "other@hireiq.com", "password": "admin_hireiq"})
        assert resp.status_code == 401


class TestAdminMetrics:
    def test_metrics_returns_expected_shape(self, test_client: TestClient, admin_headers: dict):
        resp = test_client.get("/admin/metrics", headers=admin_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert "users" in body
        assert "cv_sessions" in body
        assert "interviews" in body
        assert "jobs" in body
        assert "roadmaps" in body
        assert "referrals" in body
        assert "interview_bank" in body
        assert "billing" in body
        assert "dau" in body
        assert "total" in body["users"]
        assert "tier_distribution" in body["users"]
        assert "mrr_estimate_usd" in body["billing"]

    def test_regular_user_rejected_on_metrics(self, test_client: TestClient, auth_headers: dict):
        resp = test_client.get("/admin/metrics", headers=auth_headers)
        assert resp.status_code == 403

    def test_unauthenticated_rejected_on_metrics(self, test_client: TestClient):
        resp = test_client.get("/admin/metrics")
        assert resp.status_code == 403


class TestAdminUsers:
    def test_list_users(self, test_client: TestClient, admin_headers: dict, test_user: User):
        resp = test_client.get("/admin/users", headers=admin_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert "users" in body
        assert "total" in body
        assert isinstance(body["users"], list)
        emails = [u["email"] for u in body["users"]]
        assert test_user.email in emails

    def test_list_users_filter_by_tier(self, test_client: TestClient, admin_headers: dict, test_user: User):
        resp = test_client.get("/admin/users?tier=free", headers=admin_headers)
        assert resp.status_code == 200
        for u in resp.json()["users"]:
            assert u["tier"] == "free"

    def test_regular_user_cannot_list_users(self, test_client: TestClient, auth_headers: dict):
        resp = test_client.get("/admin/users", headers=auth_headers)
        assert resp.status_code == 403

    def test_set_tier(self, test_client: TestClient, admin_headers: dict, test_user: User, test_db: Session):
        resp = test_client.patch(
            f"/admin/users/{test_user.id}/tier",
            headers=admin_headers,
            params={"tier": "pro"},
        )
        assert resp.status_code == 200
        assert resp.json()["tier"] == "pro"
        test_db.refresh(test_user)
        assert test_user.tier == "pro"

    def test_unlock_user(self, test_client: TestClient, admin_headers: dict, test_user: User, test_db: Session):
        from datetime import datetime, timedelta
        test_user.locked_until = datetime.utcnow() + timedelta(minutes=15)
        test_db.commit()
        resp = test_client.patch(
            f"/admin/users/{test_user.id}/unlock",
            headers=admin_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["unlocked"] is True
        test_db.refresh(test_user)
        assert test_user.locked_until is None

    def test_verify_user_email(self, test_client: TestClient, admin_headers: dict, test_user: User, test_db: Session):
        test_user.email_verified = False
        test_db.commit()
        resp = test_client.patch(f"/admin/users/{test_user.id}/verify", headers=admin_headers)
        assert resp.status_code == 200
        assert resp.json()["email_verified"] is True
        test_db.refresh(test_user)
        assert test_user.email_verified is True

    def test_delete_user(self, test_client: TestClient, admin_headers: dict, test_db: Session):
        user = User(
            email="todelete@example.com",
            username="todelete",
            hashed_password=hash_password("pass1234"),
            email_verified=True,
        )
        test_db.add(user)
        test_db.commit()
        test_db.refresh(user)
        uid = user.id
        resp = test_client.delete(f"/admin/users/{uid}", headers=admin_headers)
        assert resp.status_code == 200
        assert resp.json()["deleted"] == uid
        assert test_db.query(User).filter(User.id == uid).first() is None


class TestAdminUsage:
    def test_usage_returns_stats(self, test_client: TestClient, admin_headers: dict, test_user: User):
        resp = test_client.get(f"/admin/usage/{test_user.id}", headers=admin_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body["user_id"] == test_user.id
        assert "cv_sessions" in body
        assert "interviews" in body
        assert "job_applications" in body
        assert "roadmaps" in body

    def test_usage_404_for_unknown(self, test_client: TestClient, admin_headers: dict):
        resp = test_client.get("/admin/usage/99999", headers=admin_headers)
        assert resp.status_code == 404


class TestAdminHealth:
    def test_health_returns_expected_fields(self, test_client: TestClient, admin_headers: dict):
        resp = test_client.get("/admin/health", headers=admin_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert "uptime_seconds" in body
        assert "services" in body
        assert "postgres" in body["services"]
        assert body["services"]["postgres"]["ok"] is True
        assert "memory" in body
        assert "cpu_percent" in body
