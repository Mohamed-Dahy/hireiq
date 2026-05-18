"""Career roadmap router — Phase 11, US11

POST /roadmap/generate    — generate a career roadmap
GET  /roadmap             — list user's saved roadmaps
GET  /roadmap/{id}        — get full roadmap data
"""
import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models.user import User, CVSession
from models.schemas import RoadmapGenerateRequest, RoadmapListItem, RoadmapResponse
from services.auth_service import get_current_user, require_ownership
from services.roadmap_service import generate_career_roadmap, save_roadmap, get_roadmap, list_roadmaps
from app.config import settings

router = APIRouter()


@router.post("/generate", response_model=RoadmapResponse)
def generate(
    body: RoadmapGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    current_skills = []
    jd_text = ""
    gap_report = None

    if body.cv_session_id is not None:
        session = db.query(CVSession).filter(CVSession.id == body.cv_session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="CV session not found")
        if session.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not your session")
        if session.skill_inventory:
            try:
                current_skills = json.loads(session.skill_inventory)
            except (json.JSONDecodeError, TypeError):
                current_skills = []
        if session.gap_report:
            try:
                gap_report = json.loads(session.gap_report)
            except (json.JSONDecodeError, TypeError):
                gap_report = None
        jd_text = session.jd_text or ""

    roadmap_data = generate_career_roadmap(
        current_skills,
        body.target_role,
        jd_text,
        gap_report,
        role_description=body.role_description or "",
    )
    total_weeks = sum(p.get("estimated_weeks", 0) for p in roadmap_data.get("phases", []))
    rm = save_roadmap(db, current_user.id, body.cv_session_id, body.target_role, roadmap_data)

    return RoadmapResponse(
        id=rm.id,
        target_role=rm.target_role,
        total_estimated_weeks=total_weeks,
        phases=roadmap_data.get("phases", []),
        career_insight=roadmap_data.get("career_insight", {}),
        quick_wins=roadmap_data.get("quick_wins", []),
        created_at=rm.created_at,
    )


@router.get("", response_model=list[RoadmapListItem])
def list_user_roadmaps(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rms = list_roadmaps(db, current_user.id)
    result = []
    for rm in rms:
        data = json.loads(rm.roadmap_data) if rm.roadmap_data else {}
        total_weeks = data.get("total_estimated_weeks", 0)
        result.append(RoadmapListItem(
            id=rm.id,
            target_role=rm.target_role,
            total_estimated_weeks=total_weeks,
            created_at=rm.created_at,
        ))
    return result


@router.get("/{roadmap_id}", response_model=RoadmapResponse)
def get_roadmap_endpoint(
    roadmap_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rm = get_roadmap(db, roadmap_id, current_user.id)
    data = json.loads(rm.roadmap_data) if rm.roadmap_data else {}

    return RoadmapResponse(
        id=rm.id,
        target_role=rm.target_role,
        total_estimated_weeks=data.get("total_estimated_weeks", 0),
        phases=data.get("phases", []),
        career_insight=data.get("career_insight", {}),
        quick_wins=data.get("quick_wins", []),
        created_at=rm.created_at,
    )
