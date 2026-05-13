import json
import re

from langchain_groq import ChatGroq
from langchain_core.output_parsers import StrOutputParser
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from rag.prompts import career_roadmap_prompt
from models.roadmap import CareerRoadmap

_roadmap_llm = ChatGroq(
    model="llama-3.3-70b-versatile",
    api_key=settings.groq_api_key,
    temperature=0.3,
    streaming=False,
)
_roadmap_chain = career_roadmap_prompt | _roadmap_llm | StrOutputParser()

_ROADMAP_FALLBACK = {
    "phases": [],
    "career_insight": {
        "salary_range_local": "Data unavailable",
        "salary_range_remote": "Data unavailable",
        "top_companies": [],
        "hot_skills": [],
        "market_demand": "medium",
    },
    "quick_wins": [],
}


def _strip_fences(text: str) -> str:
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*\n?", "", text)
    text = re.sub(r"\n?```\s*$", "", text)
    return text.strip()


def generate_career_roadmap(
    current_skills: list,
    target_role: str,
    jd_text: str = "",
) -> dict:
    try:
        skills_str = "\n".join(
            f"- {s.get('skill', '')} ({s.get('category', 'hard')}, {s.get('level', 'intermediate')})"
            if isinstance(s, dict) else f"- {s}"
            for s in current_skills
        ) or "No skills provided"
        raw = _roadmap_chain.invoke({
            "target_role": target_role,
            "current_skills": skills_str,
            "jd_text": jd_text or "Not provided",
        })
        data = json.loads(_strip_fences(raw))
        if "phases" not in data or "career_insight" not in data:
            return dict(_ROADMAP_FALLBACK)
        return data
    except Exception:
        return dict(_ROADMAP_FALLBACK)


def save_roadmap(db: Session, user_id: int, cv_session_id: int | None, target_role: str, roadmap_data: dict) -> CareerRoadmap:
    total_weeks = sum(p.get("estimated_weeks", 0) for p in roadmap_data.get("phases", []))
    rm = CareerRoadmap(
        user_id=user_id,
        cv_session_id=cv_session_id,
        target_role=target_role,
        roadmap_data=json.dumps({**roadmap_data, "total_estimated_weeks": total_weeks}),
    )
    db.add(rm)
    db.commit()
    db.refresh(rm)
    return rm


def get_roadmap(db: Session, roadmap_id: int, user_id: int) -> CareerRoadmap:
    rm = db.query(CareerRoadmap).filter(CareerRoadmap.id == roadmap_id).first()
    if not rm:
        raise HTTPException(status_code=404, detail="Roadmap not found")
    if rm.user_id != user_id:
        raise HTTPException(status_code=404, detail="Roadmap not found")
    return rm


def list_roadmaps(db: Session, user_id: int) -> list[CareerRoadmap]:
    return (
        db.query(CareerRoadmap)
        .filter(CareerRoadmap.user_id == user_id)
        .order_by(CareerRoadmap.created_at.desc())
        .all()
    )
