from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import relationship

from models.user import Base


class ReferralCode(Base):
    __tablename__ = "referral_codes"

    id         = Column(Integer, primary_key=True)
    user_id    = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    code       = Column(String(16), unique=True, nullable=False, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))


class ReferralConversion(Base):
    __tablename__ = "referral_conversions"

    id               = Column(Integer, primary_key=True)
    referrer_id      = Column(Integer, ForeignKey("users.id"), nullable=False)
    referred_user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    converted_at     = Column(DateTime, nullable=True)
    reward_applied   = Column(Boolean, default=False, nullable=False)
    days_credited    = Column(Integer, default=10, nullable=False)
    created_at       = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
