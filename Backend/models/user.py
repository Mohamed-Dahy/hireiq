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

    sessions            = relationship("CVSession", back_populates="user")
    verification_tokens = relationship("EmailVerificationToken", back_populates="user")
    reset_tokens        = relationship("PasswordResetToken", back_populates="user")


class CVSession(Base):
    __tablename__ = "cv_sessions"

    id          = Column(Integer, primary_key=True, index=True)
    user_id     = Column(Integer, ForeignKey("users.id"), nullable=False)
    cv_filename = Column(String, nullable=False)
    jd_text     = Column(Text, nullable=False)
    match_score = Column(Float, nullable=True)
    created_at  = Column(DateTime, default=datetime.utcnow)

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


class EmailVerificationToken(Base):
    __tablename__ = "email_verification_tokens"

    id         = Column(Integer, primary_key=True)
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=False)
    token      = Column(String, unique=True, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    used_at    = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="verification_tokens")


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id         = Column(Integer, primary_key=True)
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=False)
    token      = Column(String, unique=True, nullable=False, index=True)
    expires_at = Column(DateTime, nullable=False)
    used_at    = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="reset_tokens")
