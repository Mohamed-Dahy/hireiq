import hashlib
import hmac
from sqlalchemy.orm import Session

from app.config import settings
from models.security import SecurityAuditLog


def write_audit_log(
    db: Session,
    event_type: str,
    source_ip: str,
    outcome: str,
    user_id: int | None = None,
    detail: str | None = None,
) -> None:
    """Append a security event. Never call UPDATE or DELETE on this table."""
    entry = SecurityAuditLog(
        event_type=event_type,
        source_ip=source_ip,
        outcome=outcome,
        user_id=user_id,
        detail=detail,
    )
    db.add(entry)
    db.commit()


def verify_paymob_hmac(payload: dict, received_hmac: str) -> bool:
    """
    Verify Paymob webhook HMAC-SHA512 signature.
    Paymob concatenates specific transaction fields in alphabetical order.
    """
    fields = [
        "amount_cents", "created_at", "currency", "error_occured",
        "has_parent_transaction", "id", "integration_id", "is_3d_secure",
        "is_auth", "is_capture", "is_refunded", "is_standalone_payment",
        "is_voided", "order", "owner", "pending", "source_data.pan",
        "source_data.sub_type", "source_data.type", "success",
    ]
    concatenated = "".join(str(payload.get(field, "")) for field in fields)
    expected = hmac.new(
        settings.paymob_hmac_secret.encode(),
        concatenated.encode(),
        hashlib.sha512,
    ).hexdigest()
    return hmac.compare_digest(expected, received_hmac)
