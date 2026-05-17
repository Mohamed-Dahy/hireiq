from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from database import get_db
from services.auth_service import get_current_user, get_optional_user
from models.user import User
from services import interview_bank_service

router = APIRouter()


class PracticeRequest(BaseModel):
    question_id: int
    practiced: bool


@router.get("/roles")
def get_roles(db: Session = Depends(get_db)):
    roles = interview_bank_service.get_roles(db)
    return {"roles": roles}


@router.get("/questions")
def get_questions(
    role: str = Query(..., min_length=1),
    level: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    user_id = current_user.id if current_user else None
    return interview_bank_service.get_questions(db, role, level, user_id)


@router.get("/search")
def search_questions(
    q: str = Query(..., min_length=1),
    role: Optional[str] = Query(None),
    level: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    user_id = current_user.id if current_user else None
    return interview_bank_service.search_questions(db, q, role, level, user_id)


@router.post("/progress")
def mark_practiced(
    body: PracticeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from models.content import InterviewQuestion
    question = db.query(InterviewQuestion).filter(
        InterviewQuestion.id == body.question_id
    ).first()
    if not question:
        raise HTTPException(status_code=404, detail="Question not found")

    interview_bank_service.set_practiced(db, current_user.id, body.question_id, body.practiced)

    from models.content import UserQuestionProgress
    from datetime import datetime
    progress = (
        db.query(UserQuestionProgress)
        .filter(
            UserQuestionProgress.user_id == current_user.id,
            UserQuestionProgress.question_id == body.question_id,
        )
        .first()
    )
    practiced_at = progress.practiced_at.isoformat() if progress else None

    return {
        "question_id": body.question_id,
        "practiced": body.practiced,
        "practiced_at": practiced_at,
    }


@router.get("/progress")
def get_progress(
    role: str = Query(..., min_length=1),
    level: str = Query(..., min_length=1),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return interview_bank_service.get_progress(db, current_user.id, role, level)
