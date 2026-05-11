from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime
from models.user import Base


class SecurityAuditLog(Base):
    """Append-only security event log. No FK on user_id so records survive user deletion."""
    __tablename__ = "security_audit_logs"

    id = Column(Integer, primary_key=True)
    event_type = Column(String, nullable=False)
    # event_type values:
    #   auth.login.success | auth.login.failed | auth.logout
    #   auth.password_change | auth.account_locked
    #   payment.webhook.success | payment.webhook.invalid_signature | payment.webhook.duplicate
    #   access.ownership_violation | access.feature_gate_hit | access.rate_limit_exceeded
    #   upload.rejected_mime | upload.rejected_size
    #   admin.panel_access
    user_id = Column(Integer, nullable=True)   # no FK — audit rows must outlive users
    source_ip = Column(String, nullable=False)
    outcome = Column(String, nullable=False)   # "blocked" | "allowed" | "logged"
    detail = Column(Text, nullable=True)       # opaque ref only — NO PII, tokens, or card data
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
