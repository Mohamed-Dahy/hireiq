from datetime import datetime
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id                  = Column(Integer, primary_key=True, index=True)
    email               = Column(String, unique=True, nullable=False, index=True)
    username            = Column(String, unique=True, nullable=False, index=True)
    hashed_password     = Column(String, nullable=False)
    created_at          = Column(DateTime, default=datetime.utcnow)

    # Auth hardening
    email_verified      = Column(Boolean, default=False, nullable=False)
    failed_login_count  = Column(Integer, default=0, nullable=False)
    locked_until        = Column(DateTime, nullable=True)
    sessions_revoked_at = Column(DateTime, nullable=True)

    # Phase 2: tier + admin flag
    is_admin            = Column(Boolean, default=False, nullable=False)
    tier                = Column(String(10), default="free", nullable=False)

    sessions            = relationship("CVSession", back_populates="user")
    profile             = relationship("UserProfile", back_populates="user", uselist=False)


class CVSession(Base):
    __tablename__ = "cv_sessions"

    id               = Column(Integer, primary_key=True, index=True)
    user_id          = Column(Integer, ForeignKey("users.id"), nullable=False)
    cv_filename      = Column(String, nullable=False)
    jd_text          = Column(Text, nullable=False)
    match_score      = Column(Float, nullable=True)
    created_at       = Column(DateTime, default=datetime.utcnow)

    # Phase 5: structured analysis (stored as JSON text)
    skill_inventory  = Column(Text, nullable=True)
    gap_report       = Column(Text, nullable=True)
    study_roadmap    = Column(Text, nullable=True)
    is_linkedin      = Column(Boolean, default=False, nullable=False)

    user             = relationship("User", back_populates="sessions")
    interview_results = relationship("InterviewResult", back_populates="session")


class InterviewResult(Base):
    __tablename__ = "interview_results"

    id               = Column(Integer, primary_key=True, index=True)
    session_id       = Column(Integer, ForeignKey("cv_sessions.id"), nullable=False)
    question         = Column(Text, nullable=False)
    transcript       = Column(Text, nullable=True)
    clarity_score    = Column(Float, nullable=True)
    relevance_score  = Column(Float, nullable=True)
    depth_score      = Column(Float, nullable=True)
    eye_contact_ratio = Column(Float, nullable=True)
    created_at       = Column(DateTime, default=datetime.utcnow)

    session = relationship("CVSession", back_populates="interview_results")


class OtpCode(Base):
    __tablename__ = "otp_codes"

    id            = Column(Integer, primary_key=True)
    email         = Column(String, nullable=False, index=True)
    user_id       = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    code_hmac     = Column(String(64), nullable=False)
    purpose       = Column(String(20), nullable=False)
    expires_at    = Column(DateTime, nullable=False)
    attempt_count = Column(Integer, default=0, nullable=False)
    used_at       = Column(DateTime, nullable=True)
    created_at    = Column(DateTime, default=datetime.utcnow)


class UserProfile(Base):
    __tablename__ = "user_profiles"

    id                = Column(Integer, primary_key=True)
    user_id           = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    stored_cv_path    = Column(String, nullable=True)
    stored_cv_filename = Column(String, nullable=True)
    linkedin_url      = Column(String(500), nullable=True)
    github_url        = Column(String(500), nullable=True)
    portfolio_url     = Column(String(500), nullable=True)
    bio               = Column(Text, nullable=True)
    avatar_url        = Column(String(500), nullable=True)
    updated_at        = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="profile")
