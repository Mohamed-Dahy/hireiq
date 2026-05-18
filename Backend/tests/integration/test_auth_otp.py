import pytest


class TestRegisterOtp:
    def test_register_creates_otp_record(self, test_client, test_db):
        resp = test_client.post("/auth/register", json={
            "email": "otp_reg@example.com", "username": "otpreg", "password": "SecurePass1!"
        })
        assert resp.status_code == 201
        from models.user import OtpCode
        record = test_db.query(OtpCode).filter(OtpCode.email == "otp_reg@example.com").first()
        assert record is not None
        assert record.purpose == "registration"
        assert record.used_at is None

    def test_register_response_message_mentions_code(self, test_client):
        resp = test_client.post("/auth/register", json={
            "email": "otp_msg@example.com", "username": "otpmsg", "password": "SecurePass1!"
        })
        assert "code" in resp.json()["message"].lower()


class TestVerifyOtp:
    def test_verify_otp_activates_account(self, test_client, test_db, unverified_user):
        from services.otp_service import create_otp
        code = create_otp(test_db, unverified_user.email, "registration", unverified_user.id)
        resp = test_client.post("/auth/verify-otp", json={
            "email": unverified_user.email, "code": code, "purpose": "registration"
        })
        assert resp.status_code == 200
        test_db.refresh(unverified_user)
        assert unverified_user.email_verified is True

    def test_wrong_otp_increments_attempt_count(self, test_client, test_db, unverified_user):
        from services.otp_service import create_otp
        from models.user import OtpCode
        create_otp(test_db, unverified_user.email, "registration", unverified_user.id)
        test_client.post("/auth/verify-otp", json={
            "email": unverified_user.email, "code": "00000", "purpose": "registration"
        })
        record = test_db.query(OtpCode).filter(
            OtpCode.email == unverified_user.email.lower(),
            OtpCode.purpose == "registration",
        ).order_by(OtpCode.created_at.desc()).first()
        assert record.attempt_count == 1

    def test_expired_otp_rejected(self, test_client, test_db, unverified_user):
        from services.otp_service import create_otp
        from datetime import datetime, timedelta
        from models.user import OtpCode
        create_otp(test_db, unverified_user.email, "registration", unverified_user.id)
        record = test_db.query(OtpCode).filter(
            OtpCode.email == unverified_user.email.lower()
        ).order_by(OtpCode.created_at.desc()).first()
        record.expires_at = datetime.utcnow() - timedelta(hours=1)
        test_db.commit()
        resp = test_client.post("/auth/verify-otp", json={
            "email": unverified_user.email, "code": "12345", "purpose": "registration"
        })
        assert resp.status_code == 400
        assert "expired" in resp.json()["detail"].lower()

    def test_locked_after_max_attempts(self, test_client, test_db, unverified_user):
        from services.otp_service import create_otp
        create_otp(test_db, unverified_user.email, "registration", unverified_user.id)
        from app.config import settings
        for _ in range(settings.otp_max_attempts):
            test_client.post("/auth/verify-otp", json={
                "email": unverified_user.email, "code": "00000", "purpose": "registration"
            })
        resp = test_client.post("/auth/verify-otp", json={
            "email": unverified_user.email, "code": "00000", "purpose": "registration"
        })
        assert resp.status_code == 400
        detail_lower = resp.json()["detail"].lower()
        assert "locked" in detail_lower or "attempts" in detail_lower


class TestForgotPasswordOtp:
    def test_forgot_password_always_returns_200(self, test_client):
        resp = test_client.post("/auth/forgot-password", json={"email": "nobody@example.com"})
        assert resp.status_code == 200

    def test_forgot_password_creates_otp_for_verified_user(self, test_client, test_db, test_user):
        from models.user import OtpCode
        resp = test_client.post("/auth/forgot-password", json={"email": test_user.email})
        assert resp.status_code == 200
        record = test_db.query(OtpCode).filter(
            OtpCode.email == test_user.email.lower(),
            OtpCode.purpose == "password_reset",
        ).first()
        assert record is not None


class TestResetPasswordOtp:
    def test_reset_password_with_otp_token(self, test_client, test_db, test_user):
        from services.otp_service import create_otp, verify_otp as svc_verify
        from services.auth_service import create_reset_session
        code = create_otp(test_db, test_user.email, "password_reset", test_user.id)
        ok, _ = svc_verify(test_db, test_user.email, code, "password_reset")
        assert ok
        reset_token = create_reset_session(test_user.id)
        resp = test_client.post("/auth/reset-password", json={
            "reset_token": reset_token, "new_password": "NewSecure1!"
        })
        assert resp.status_code == 200
        login_resp = test_client.post("/auth/login", json={
            "email": test_user.email, "password": "NewSecure1!"
        })
        assert login_resp.status_code == 200

    def test_reset_password_invalid_token_returns_400(self, test_client):
        resp = test_client.post("/auth/reset-password", json={
            "reset_token": "fake-uuid-token", "new_password": "NewPass123!"
        })
        assert resp.status_code == 400
