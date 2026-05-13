from datetime import datetime
from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from models.user import Base


class CareerRoadmap(Base):
    __tablename__ = "career_roadmaps"

    id            = Column(Integer, primary_key=True)
    user_id       = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    cv_session_id = Column(Integer, ForeignKey("cv_sessions.id"), nullable=True)
    target_role   = Column(String, nullable=False)
    roadmap_data  = Column(Text, nullable=False)
    created_at    = Column(DateTime, default=datetime.utcnow)
