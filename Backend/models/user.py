from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Text, DateTime, ForeignKey
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class User(Base):
    """One row per registered user."""
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, nullable=False, index=True)
    username = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    # One user can have many CV sessions
    sessions = relationship("CVSession", back_populates="user")


class CVSession(Base):
    """One row per CV + JD upload. Stores the match score."""
    __tablename__ = "cv_sessions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    cv_filename = Column(String, nullable=False)       # original uploaded filename
    jd_text = Column(Text, nullable=False)             # the pasted job description
    match_score = Column(Float, nullable=True)         # 0.0 – 100.0, set after scoring
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="sessions")
    interview_results = relationship("InterviewResult", back_populates="session")


class InterviewResult(Base):
    """One row per answered interview question."""
    __tablename__ = "interview_results"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("cv_sessions.id"), nullable=False)
    question = Column(Text, nullable=False)            # the question that was asked
    transcript = Column(Text, nullable=True)           # Whisper transcription of answer
    clarity_score = Column(Float, nullable=True)       # 0–10
    relevance_score = Column(Float, nullable=True)     # 0–10
    depth_score = Column(Float, nullable=True)         # 0–10
    eye_contact_ratio = Column(Float, nullable=True)   # 0.0–1.0  (fraction of time eyes on camera)
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("CVSession", back_populates="interview_results")
