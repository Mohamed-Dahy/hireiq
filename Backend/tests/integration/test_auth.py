"""
Integration tests for /auth/* endpoints
-----------------------------------------
All tests use the real PostgreSQL test DB and the FastAPI TestClient.
Redis is available but failures are tolerated (fail-open).
Email sending is disabled (RESEND_API_KEY is empty in .env.test).
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from models.user import User, EmailVerificationToken
from services.auth_service import (
    create_verification_token,
    create_password_reset_token,
    hash_password,
    blacklist_jti,
    decode_token,
)


# ---------------------------------------------------------------------------
# POST /auth/register
# ---------------------------------------------------------------------------

class TestRegister:
    def test_register_creates_account_and_returns_message(self, test_client: TestClient):
        resp = test_client.post("/auth/register", json={
            "email": "new@example.com",
            "username": "newuser",
            "password": "SecurePass1!",
        })
        assert resp.status_code == 201
        body = resp.json()
        assert "message" in body
        assert body["email"] == "new@example.com"
        # Must NOT return tokens — user must verify email first
        assert "access_token" not in body
        assert "refresh_token" not in body

    def test_register_duplicate_email_returns_400(self, test_client: TestClient, test_user: User):
        resp = test_client.post("/auth/register", json={
            "email": test_user.email,
            "username": "differentuser",
            "password": "SecurePass1!",
        })
        assert resp.status_code == 400

    def test_register_duplicate_username_returns_400(self, test_client: TestClient, test_user: User):
        resp = test_client.post("/auth/register", json={
            "email": "other@example.com",
            "username": test_user.username,
            "password": "SecurePass1!",
        })
        assert resp.status_code == 400

    def test_register_short_password_returns_422(self, test_client: TestClient):
        resp = test_client.post("/auth/register", json={
            "email": "pw@example.com",
            "username": "pwuser",
            "password": "123",
        })
        assert resp.status_code == 422

    def test_register_invalid_email_returns_422(self, test_client: TestClient):
        resp = test_client.post("/auth/register", json={
            "email": "not-an-email",
            "username": "user2",
            "password": "SecurePass1!",
        })
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# POST /auth/login
# ---------------------------------------------------------------------------

class TestLogin:
    def test_login_verified_user_returns_tokens(self, test_client: TestClient, test_user: User):
        resp = test_client.post("/auth/login", json={
            "email": test_user.email,
            "password": "TestPass123!",
        })
        assert resp.status_code == 200
        body = resp.json()
        assert "access_token" in body
        assert "refresh_token" in body
        assert body["token_type"] == "bearer"

    def test_login_unverified_user_returns_403(self, test_client: TestClient, unverified_user: User):
        resp = test_client.post("/auth/login", json={
            "email": unverified_user.email,
            "password": "TestPass123!",
        })
        assert resp.status_code == 403
        assert "verified" in resp.json()["detail"].lower()

    def test_login_wrong_password_returns_401(self, test_client: TestClient, test_user: User):
        resp = test_client.post("/auth/login", json={
            "email": test_user.email,
            "password": "WrongPassword!",
        })
        assert resp.status_code == 401

    def test_login_unknown_email_returns_401(self, test_client: TestClient):
        resp = test_client.post("/auth/login", json={
            "email": "ghost@example.com",
            "password": "AnyPass123!",
        })
        assert resp.status_code == 401

    def test_login_lockout_after_max_failures(
        self, test_client: TestClient, test_db: Session, test_user: User
    ):
        for _ in range(5):
            test_client.post("/auth/login", json={
                "email": test_user.email,
                "password": "WrongPassword!",
            })
        # 6th attempt — should be locked
        resp = test_client.post("/auth/login", json={
            "email": test_user.email,
            "password": "WrongPassword!",
        })
        assert resp.status_code == 423  # HTTP Locked


# ---------------------------------------------------------------------------
# POST /auth/verify-email
# ---------------------------------------------------------------------------

class TestVerifyEmail:
    def test_verify_email_marks_user_verified(
        self, test_client: TestClient, test_db: Session, unverified_user: User
    ):
        token = create_verification_token(test_db, unverified_user.id)
        resp = test_client.post("/auth/verify-email", json={"token": token})
        assert resp.status_code == 200

        test_db.refresh(unverified_user)
        assert unverified_user.email_verified is True

    def test_verify_email_invalid_token_returns_400(self, test_client: TestClient):
        resp = test_client.post("/auth/verify-email", json={"token": "fake-token"})
        assert resp.status_code == 400

    def test_verify_email_token_used_twice_returns_400(
        self, test_client: TestClient, test_db: Session, unverified_user: User
    ):
        token = create_verification_token(test_db, unverified_user.id)
        test_client.post("/auth/verify-email", json={"token": token})
        resp = test_client.post("/auth/verify-email", json={"token": token})
        assert resp.status_code == 400


# ---------------------------------------------------------------------------
# POST /auth/resend-verification
# ---------------------------------------------------------------------------

class TestResendVerification:
    def test_resend_always_returns_200(self, test_client: TestClient):
        # Unknown email — should still return 200
        resp = test_client.post("/auth/resend-verification", json={"email": "nobody@example.com"})
        assert resp.status_code == 200

    def test_resend_for_unverified_user_returns_200(
        self, test_client: TestClient, unverified_user: User
    ):
        resp = test_client.post("/auth/resend-verification", json={"email": unverified_user.email})
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# POST /auth/forgot-password
# ---------------------------------------------------------------------------

class TestForgotPassword:
    def test_forgot_password_always_returns_200(self, test_client: TestClient):
        resp = test_client.post("/auth/forgot-password", json={"email": "unknown@example.com"})
        assert resp.status_code == 200

    def test_forgot_password_for_verified_user_returns_200(
        self, test_client: TestClient, test_user: User
    ):
        resp = test_client.post("/auth/forgot-password", json={"email": test_user.email})
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# POST /auth/reset-password
# ---------------------------------------------------------------------------

class TestResetPassword:
    def test_reset_password_changes_password(
        self, test_client: TestClient, test_db: Session, test_user: User
    ):
        reset_token = create_password_reset_token(test_db, test_user.id)
        resp = test_client.post("/auth/reset-password", json={
            "token": reset_token,
            "new_password": "NewSecurePass1!",
        })
        assert resp.status_code == 200

        # Can now log in with new password
        login_resp = test_client.post("/auth/login", json={
            "email": test_user.email,
            "password": "NewSecurePass1!",
        })
        assert login_resp.status_code == 200

    def test_reset_password_invalid_token_returns_400(self, test_client: TestClient):
        resp = test_client.post("/auth/reset-password", json={
            "token": "fake-reset-token",
            "new_password": "NewPass123!",
        })
        assert resp.status_code == 400

    def test_reset_password_invalidates_existing_sessions(
        self, test_client: TestClient, test_db: Session, test_user: User
    ):
        """FR-004: tokens issued before password reset must be rejected (sessions_revoked_at)."""
        # Obtain a valid access token first
        login_resp = test_client.post("/auth/login", json={
            "email": test_user.email,
            "password": "TestPass123!",
        })
        old_access_token = login_resp.json()["access_token"]
        old_headers = {"Authorization": f"Bearer {old_access_token}"}

        # Verify the old token works now
        me_resp = test_client.get("/auth/me", headers=old_headers)
        assert me_resp.status_code == 200

        # Reset the password
        reset_token = create_password_reset_token(test_db, test_user.id)
        test_client.post("/auth/reset-password", json={
            "token": reset_token,
            "new_password": "BrandNewPass1!",
        })

        # The old token must now be rejected (sessions_revoked_at set by reset)
        me_resp = test_client.get("/auth/me", headers=old_headers)
        assert me_resp.status_code == 401


# ---------------------------------------------------------------------------
# POST /auth/logout
# ---------------------------------------------------------------------------

class TestLogout:
    def test_logout_invalidates_access_token(
        self, test_client: TestClient, test_user: User, auth_headers: dict
    ):
        resp = test_client.post("/auth/logout", headers=auth_headers)
        assert resp.status_code == 200

        # Subsequent request with the same token should fail
        me_resp = test_client.get("/auth/me", headers=auth_headers)
        assert me_resp.status_code == 401

    def test_logout_without_token_returns_403(self, test_client: TestClient):
        resp = test_client.post("/auth/logout")
        assert resp.status_code in (401, 403)


# ---------------------------------------------------------------------------
# POST /auth/refresh
# ---------------------------------------------------------------------------

class TestRefresh:
    def test_refresh_returns_new_tokens(self, test_client: TestClient, test_user: User):
        login_resp = test_client.post("/auth/login", json={
            "email": test_user.email,
            "password": "TestPass123!",
        })
        refresh_token = login_resp.json()["refresh_token"]

        resp = test_client.post("/auth/refresh", json={"refresh_token": refresh_token})
        assert resp.status_code == 200
        body = resp.json()
        assert "access_token" in body
        assert "refresh_token" in body
        # New refresh token must differ from old
        assert body["refresh_token"] != refresh_token

    def test_refresh_old_token_is_blacklisted(self, test_client: TestClient, test_user: User):
        login_resp = test_client.post("/auth/login", json={
            "email": test_user.email,
            "password": "TestPass123!",
        })
        old_refresh = login_resp.json()["refresh_token"]

        # Use the refresh token once
        test_client.post("/auth/refresh", json={"refresh_token": old_refresh})

        # Reusing the same refresh token should fail (JTI is blacklisted)
        resp = test_client.post("/auth/refresh", json={"refresh_token": old_refresh})
        assert resp.status_code == 401

    def test_refresh_with_access_token_returns_401(self, test_client: TestClient, test_user: User):
        access_token = test_client.post("/auth/login", json={
            "email": test_user.email,
            "password": "TestPass123!",
        }).json()["access_token"]

        resp = test_client.post("/auth/refresh", json={"refresh_token": access_token})
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# GET /auth/me
# ---------------------------------------------------------------------------

class TestGetMe:
    def test_get_me_returns_profile(self, test_client: TestClient, test_user: User, auth_headers: dict):
        resp = test_client.get("/auth/me", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body["email"] == test_user.email
        assert body["username"] == test_user.username

    def test_get_me_without_token_returns_403(self, test_client: TestClient):
        resp = test_client.get("/auth/me")
        assert resp.status_code == 403


# ---------------------------------------------------------------------------
# DELETE /auth/account
# ---------------------------------------------------------------------------

class TestDeleteAccount:
    def test_delete_account_returns_200_and_removes_user(
        self, test_client: TestClient, test_db: Session, test_user: User, auth_headers: dict
    ):
        resp = test_client.delete("/auth/account", headers=auth_headers)
        assert resp.status_code == 200
        assert "deleted" in resp.json()["message"].lower()

        # User record must be gone from the database
        gone = test_db.query(User).filter(User.id == test_user.id).first()
        assert gone is None

    def test_delete_account_blacklists_token(
        self, test_client: TestClient, test_user: User, auth_headers: dict
    ):
        test_client.delete("/auth/account", headers=auth_headers)

        # The same token must now be rejected
        resp = test_client.get("/auth/me", headers=auth_headers)
        assert resp.status_code == 401

    def test_delete_account_without_token_returns_403(self, test_client: TestClient):
        resp = test_client.delete("/auth/account")
        assert resp.status_code in (401, 403)

    def test_delete_account_writes_audit_log(
        self, test_client: TestClient, test_db: Session, test_user: User, auth_headers: dict
    ):
        from models.security import SecurityAuditLog

        test_client.delete("/auth/account", headers=auth_headers)

        log = (
            test_db.query(SecurityAuditLog)
            .filter(SecurityAuditLog.event_type == "auth.account_deleted")
            .first()
        )
        assert log is not None
        assert log.outcome == "allowed"
