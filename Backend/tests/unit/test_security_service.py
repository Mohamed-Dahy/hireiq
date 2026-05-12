"""
Unit tests for security_service.py
------------------------------------
Tests HMAC verification and audit log writing.
"""
import hashlib
import hmac as _hmac

import pytest
from sqlalchemy.orm import Session

from models.security import SecurityAuditLog
from services.security_service import verify_paymob_hmac, write_audit_log


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

PAYLOAD = {
    "amount_cents": "1000",
    "created_at": "2026-01-01T00:00:00",
    "currency": "EGP",
    "error_occured": "false",
    "has_parent_transaction": "false",
    "id": "12345",
    "integration_id": "456",
    "is_3d_secure": "false",
    "is_auth": "false",
    "is_capture": "false",
    "is_refunded": "false",
    "is_standalone_payment": "true",
    "is_voided": "false",
    "order": "789",
    "owner": "100",
    "pending": "false",
    "source_data.pan": "1234",
    "source_data.sub_type": "MasterCard",
    "source_data.type": "card",
    "success": "true",
}

_FIELDS = [
    "amount_cents", "created_at", "currency", "error_occured",
    "has_parent_transaction", "id", "integration_id", "is_3d_secure",
    "is_auth", "is_capture", "is_refunded", "is_standalone_payment",
    "is_voided", "order", "owner", "pending", "source_data.pan",
    "source_data.sub_type", "source_data.type", "success",
]


def _compute_hmac(payload: dict, secret: str) -> str:
    concatenated = "".join(str(payload.get(field, "")) for field in _FIELDS)
    return _hmac.new(
        secret.encode(),
        concatenated.encode(),
        hashlib.sha512,
    ).hexdigest()


# ---------------------------------------------------------------------------
# T039: HMAC verification
# ---------------------------------------------------------------------------

class TestVerifyPaymobHmac:
    def test_valid_signature_accepted(self, monkeypatch):
        secret = "test_hmac_secret_abc123"
        monkeypatch.setattr("services.security_service.settings.paymob_hmac_secret", secret)
        valid_hmac = _compute_hmac(PAYLOAD, secret)
        assert verify_paymob_hmac(PAYLOAD, valid_hmac) is True

    def test_tampered_payload_rejected(self, monkeypatch):
        secret = "test_hmac_secret_abc123"
        monkeypatch.setattr("services.security_service.settings.paymob_hmac_secret", secret)
        valid_hmac = _compute_hmac(PAYLOAD, secret)
        tampered = {**PAYLOAD, "amount_cents": "99999"}  # attacker inflated amount
        assert verify_paymob_hmac(tampered, valid_hmac) is False

    def test_missing_fields_rejected(self, monkeypatch):
        secret = "test_hmac_secret_abc123"
        monkeypatch.setattr("services.security_service.settings.paymob_hmac_secret", secret)
        valid_hmac = _compute_hmac(PAYLOAD, secret)
        # Empty payload produces a different concatenation
        assert verify_paymob_hmac({}, valid_hmac) is False

    def test_wrong_secret_rejected(self, monkeypatch):
        monkeypatch.setattr("services.security_service.settings.paymob_hmac_secret", "secret_a")
        hmac_from_b = _compute_hmac(PAYLOAD, "secret_b")
        assert verify_paymob_hmac(PAYLOAD, hmac_from_b) is False

    def test_signature_is_case_sensitive(self, monkeypatch):
        secret = "test_hmac_secret_abc123"
        monkeypatch.setattr("services.security_service.settings.paymob_hmac_secret", secret)
        valid_hmac = _compute_hmac(PAYLOAD, secret)
        # Uppercased HMAC should not match
        assert verify_paymob_hmac(PAYLOAD, valid_hmac.upper()) is False


# ---------------------------------------------------------------------------
# T039: Audit log persistence
# ---------------------------------------------------------------------------

class TestWriteAuditLog:
    def test_audit_log_persisted_with_user_id(self, test_db: Session):
        write_audit_log(
            db=test_db,
            event_type="auth.login.success",
            source_ip="127.0.0.1",
            outcome="allowed",
            user_id=42,
            detail="login ok",
        )
        row = test_db.query(SecurityAuditLog).filter_by(event_type="auth.login.success").first()
        assert row is not None
        assert row.source_ip == "127.0.0.1"
        assert row.outcome == "allowed"
        assert row.user_id == 42

    def test_audit_log_no_user_id(self, test_db: Session):
        write_audit_log(
            db=test_db,
            event_type="auth.login.failed",
            source_ip="10.0.0.1",
            outcome="blocked",
        )
        row = test_db.query(SecurityAuditLog).filter_by(event_type="auth.login.failed").first()
        assert row is not None
        assert row.user_id is None

    def test_audit_log_never_updates_existing(self, test_db: Session):
        write_audit_log(db=test_db, event_type="upload.rejected_mime", source_ip="1.2.3.4", outcome="blocked")
        write_audit_log(db=test_db, event_type="upload.rejected_mime", source_ip="1.2.3.5", outcome="blocked")
        count = test_db.query(SecurityAuditLog).filter_by(event_type="upload.rejected_mime").count()
        assert count == 2  # append-only: never merges or updates
