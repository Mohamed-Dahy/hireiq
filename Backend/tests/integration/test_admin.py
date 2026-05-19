"""
Integration tests for admin panel — Phase 10.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from models.user import User
from services.auth_service import create_access_token, hash_password


@pytest.fixture()
def admin_user(test_db: Session) -> User:
    user = User(
        email="admin@hireiq.com",
        username="admin",
        hashed_password=hash_password("admin_hireiq"),
        email_verified=True,
        is_admin=True,
        tier="enterprise",
    )
    test_db.add(user)
    test_db.commit()
    test_db.refresh(user)
    return user


@pytest.fixture()
def admin_headers(admin_user: User) -> dict:
    token = create_access_token(admin_user.id)
    return {"Authorization": f"Bearer {token}"}


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
        assert "total" in body["users"]
        assert "tier_distribution" in body["users"]

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
        assert isinstance(body["users"], list)
        emails = [u["email"] for u in body["users"]]
        assert test_user.email in emails

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

    def test_admin_cannot_delete_self(self, test_client: TestClient, admin_user: User, admin_headers: dict):
        resp = test_client.delete(f"/admin/users/{admin_user.id}", headers=admin_headers)
        assert resp.status_code == 400
