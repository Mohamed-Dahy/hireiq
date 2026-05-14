import re
import inspect

import pytest
from fastapi import HTTPException

from services.otp_service import generate_otp, hmac_code, verify_otp, check_otp_rate_limit
from app.config import settings


class TestGenerateOtp:
    def test_generate_otp_is_5_digits(self):
        for _ in range(20):
            code = generate_otp()
            assert re.match(r"^\d{5}$", code), f"Expected 5 digits, got {code}"


class TestHmacCode:
    def test_hmac_code_is_consistent(self):
        code = "12345"
        secret = "test-secret"
        h1 = hmac_code(code, secret)
        h2 = hmac_code(code, secret)
        assert h1 == h2

    def test_hmac_code_differs_for_diff_inputs(self):
        h1 = hmac_code("12345", "secret1")
        h2 = hmac_code("12346", "secret1")
        h3 = hmac_code("12345", "secret2")
        assert h1 != h2
        assert h1 != h3

    def test_hmac_uses_compare_digest(self):
        source = inspect.getsource(verify_otp)
        assert "compare_digest" in source


class TestVerifyOtpWithDb:
    def test_wrong_code_returns_false_and_increments(self, test_db):
        from models.user import User, OtpCode
        from services.otp_service import create_otp
        from services.auth_service import hash_password

        user = User(
            email="wrong_code@example.com",
            username="wrongcode",
            hashed_password=hash_password("TestPass123!"),
            email_verified=False,
        )
        test_db.add(user)
        test_db.commit()
        test_db.refresh(user)

        create_otp(test_db, user.email, "registration", user.id)
        ok, reason = verify_otp(test_db, user.email, "00000", "registration")
        assert ok is False
        assert reason == "invalid"

        record = test_db.query(OtpCode).filter(
            OtpCode.email == user.email.lower(),
            OtpCode.purpose == "registration",
        ).order_by(OtpCode.created_at.desc()).first()
        assert record.attempt_count == 1

    def test_correct_code_returns_true(self, test_db):
        from models.user import User, OtpCode
        from services.otp_service import create_otp
        from services.auth_service import hash_password

        user = User(
            email="correct@example.com",
            username="correct",
            hashed_password=hash_password("TestPass123!"),
            email_verified=False,
        )
        test_db.add(user)
        test_db.commit()
        test_db.refresh(user)

        code = create_otp(test_db, user.email, "registration", user.id)
        ok, reason = verify_otp(test_db, user.email, code, "registration")
        assert ok is True
        assert reason == "ok"

        record = test_db.query(OtpCode).filter(
            OtpCode.email == user.email.lower(),
            OtpCode.purpose == "registration",
        ).order_by(OtpCode.created_at.desc()).first()
        assert record.used_at is not None

    def test_expired_otp_returns_expired(self, test_db):
        from datetime import datetime, timedelta
        from models.user import User, OtpCode
        from services.otp_service import create_otp
        from services.auth_service import hash_password

        user = User(
            email="expired@example.com",
            username="expired",
            hashed_password=hash_password("TestPass123!"),
            email_verified=False,
        )
        test_db.add(user)
        test_db.commit()
        test_db.refresh(user)

        create_otp(test_db, user.email, "registration", user.id)
        record = test_db.query(OtpCode).filter(
            OtpCode.email == user.email.lower()
        ).order_by(OtpCode.created_at.desc()).first()
        record.expires_at = datetime.utcnow() - timedelta(hours=1)
        test_db.commit()

        ok, reason = verify_otp(test_db, user.email, "12345", "registration")
        assert ok is False
        assert reason == "expired"


class TestRateLimit:
    def test_rate_limit_raises_after_limit(self, monkeypatch):
        from services.cache import redis_client

        def mock_incr(key):
            return settings.otp_rate_limit_per_30min + 1

        monkeypatch.setattr(redis_client, "incr", mock_incr)

        with pytest.raises(HTTPException) as exc:
            check_otp_rate_limit("rate_limit@example.com")
        assert exc.value.status_code == 429
