from datetime import date, datetime, timezone
from sqlalchemy import (
    Boolean, Column, Date, DateTime, Float,
    ForeignKey, Integer, String, Text,
)
from sqlalchemy.orm import relationship

from models.user import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class JobApplication(Base):
    __tablename__ = "job_applications"

    id               = Column(Integer, primary_key=True, index=True)
    user_id          = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    cv_session_id    = Column(Integer, ForeignKey("cv_sessions.id"), nullable=True)

    # Core job info
    company          = Column(String(200), nullable=False)
    title            = Column(String(200), nullable=False)
    location         = Column(String(200), nullable=True)
    remote_type      = Column(String(20), nullable=True)   # onsite/remote/hybrid
    job_url          = Column(Text, nullable=True)
    jd_text          = Column(Text, nullable=True)

    # Pipeline stage
    status           = Column(String(30), nullable=False, default="saved", index=True)
    stage_entered_at = Column(DateTime, nullable=False, default=_utcnow)

    # Metadata
    source           = Column(String(50), nullable=True)   # linkedin/indeed/referral/…
    priority         = Column(String(10), nullable=True)   # low/medium/high
    applied_date     = Column(Date, nullable=True)
    deadline_date    = Column(Date, nullable=True)
    followup_date    = Column(Date, nullable=True)
    salary_min       = Column(Integer, nullable=True)
    salary_max       = Column(Integer, nullable=True)
    notes            = Column(Text, nullable=True)
    cover_letter     = Column(Text, nullable=True)
    rejection_reason = Column(String(300), nullable=True)

    # AI-derived fields
    match_score       = Column(Float, nullable=True)
    ai_gap_summary    = Column(Text, nullable=True)
    ai_prep_questions = Column(Text, nullable=True)   # JSON list

    # Soft-delete
    is_archived      = Column(Boolean, nullable=False, default=False)
    created_at       = Column(DateTime, nullable=False, default=_utcnow)
    updated_at       = Column(DateTime, nullable=False, default=_utcnow, onupdate=_utcnow)

    activities = relationship("ApplicationActivity", back_populates="job", cascade="all, delete-orphan")
    contacts   = relationship("ApplicationContact",  back_populates="job", cascade="all, delete-orphan")


class ApplicationActivity(Base):
    __tablename__ = "application_activities"

    id                 = Column(Integer, primary_key=True, index=True)
    job_application_id = Column(Integer, ForeignKey("job_applications.id"), nullable=False, index=True)
    user_id            = Column(Integer, ForeignKey("users.id"), nullable=False)

    event_type         = Column(String(50), nullable=False)
    event_date         = Column(Date, nullable=False, default=date.today)
    notes              = Column(Text, nullable=True)
    created_at         = Column(DateTime, nullable=False, default=_utcnow)

    job = relationship("JobApplication", back_populates="activities")


class ApplicationContact(Base):
    __tablename__ = "application_contacts"

    id                 = Column(Integer, primary_key=True, index=True)
    job_application_id = Column(Integer, ForeignKey("job_applications.id"), nullable=False, index=True)

    name               = Column(String(200), nullable=False)
    role               = Column(String(100), nullable=True)
    email              = Column(String(200), nullable=True)
    phone              = Column(String(50), nullable=True)
    linkedin_url       = Column(Text, nullable=True)
    notes              = Column(Text, nullable=True)
    created_at         = Column(DateTime, nullable=False, default=_utcnow)

    job = relationship("JobApplication", back_populates="contacts")


class RecruiterList(Base):
    __tablename__ = "recruiter_lists"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    name       = Column(String(100), nullable=False)
    job_title  = Column(String(200), nullable=True)
    created_at = Column(DateTime, nullable=False, default=_utcnow)

    candidates = relationship(
        "RecruiterCandidate", back_populates="recruiter_list", cascade="all, delete-orphan"
    )


class RecruiterCandidate(Base):
    __tablename__ = "recruiter_candidates"

    id                = Column(Integer, primary_key=True, index=True)
    recruiter_list_id = Column(Integer, ForeignKey("recruiter_lists.id"), nullable=False, index=True)
    session_id        = Column(Integer, ForeignKey("cv_sessions.id"), nullable=True)

    # Standalone candidate identity (filled when not linked to a CV session)
    candidate_name    = Column(String(200), nullable=True)
    candidate_email   = Column(String(200), nullable=True)
    candidate_phone   = Column(String(50),  nullable=True)
    applied_position  = Column(String(200), nullable=True)
    cv_file_path      = Column(String(500), nullable=True)

    rank              = Column(Integer, nullable=True)
    status            = Column(String(20), nullable=False, default="new")
    notes             = Column(Text, nullable=True)
    starred           = Column(Boolean, nullable=False, default=False)
    created_at        = Column(DateTime, nullable=False, default=_utcnow)

    recruiter_list = relationship("RecruiterList", back_populates="candidates")
    session        = relationship("CVSession")
