from datetime import datetime
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import declarative_base

from models.user import Base


class SalaryBenchmark(Base):
    __tablename__ = "salary_benchmarks"

    id              = Column(Integer, primary_key=True)
    role            = Column(String(100), nullable=False)
    level           = Column(String(20), nullable=False)
    country         = Column(String(100), nullable=False)
    currency        = Column(String(10), nullable=False)
    min_salary      = Column(Integer, nullable=False)
    median_salary   = Column(Integer, nullable=False)
    max_salary      = Column(Integer, nullable=False)
    usd_min         = Column(Integer, nullable=False)
    usd_max         = Column(Integer, nullable=False)
    confidence      = Column(String(10), nullable=False)
    source          = Column(String(100), nullable=False)
    last_updated_at = Column(DateTime, nullable=False)

    __table_args__ = (
        UniqueConstraint("role", "level", "country", name="uq_role_level_country"),
    )


class InterviewQuestion(Base):
    __tablename__ = "interview_questions"

    id             = Column(Integer, primary_key=True)
    role           = Column(String(100), nullable=False, index=True)
    level          = Column(String(20), nullable=False)
    category       = Column(String(30), nullable=False)
    question_text  = Column(Text, nullable=False)
    model_answer   = Column(Text, nullable=False)
    source         = Column(String(20), nullable=False)
    content_hash   = Column(String(64), unique=True, nullable=False)
    created_at     = Column(DateTime, default=datetime.utcnow)


class UserQuestionProgress(Base):
    __tablename__ = "user_question_progress"

    id          = Column(Integer, primary_key=True)
    user_id     = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    question_id = Column(Integer, ForeignKey("interview_questions.id"), nullable=False)
    practiced_at = Column(DateTime, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("user_id", "question_id", name="uq_user_question"),
    )
