from datetime import datetime, timezone
from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, String, Index
from sqlalchemy.orm import declarative_base

from models.user import Base


class TokenUsageLog(Base):
    __tablename__ = "token_usage_log"

    id             = Column(Integer, primary_key=True)
    user_id        = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    date           = Column(Date, nullable=False)
    tokens_used    = Column(Integer, nullable=False)
    operation_type = Column(String(30), nullable=False)
    tier           = Column(String(10), nullable=False)
    created_at     = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))

    __table_args__ = (
        Index("ix_token_usage_user_date", "user_id", "date"),
    )
