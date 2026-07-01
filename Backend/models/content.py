from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from models.user import Base


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
    created_at     = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))


class UserQuestionProgress(Base):
    __tablename__ = "user_question_progress"

    id          = Column(Integer, primary_key=True)
    user_id     = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    question_id = Column(Integer, ForeignKey("interview_questions.id"), nullable=False)
    practiced_at = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))

    __table_args__ = (
        UniqueConstraint("user_id", "question_id", name="uq_user_question"),
    )
