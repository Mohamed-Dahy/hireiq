"""
routers/jobs.py
---------------
POST   /jobs                        — create job application
GET    /jobs                        — list (filters: status, priority, is_archived)
GET    /jobs/stats                  — funnel analytics
GET    /jobs/upcoming               — deadline/followup within 7 days
GET    /jobs/stale                  — no activity in 14+ days
GET    /jobs/{id}                   — detail
PATCH  /jobs/{id}                   — update fields
DELETE /jobs/{id}                   — soft-archive
PATCH  /jobs/{id}/status            — validated status transition
POST   /jobs/{id}/activities        — log an activity
GET    /jobs/{id}/activities        — list activities
POST   /jobs/{id}/contacts          — add contact
GET    /jobs/{id}/contacts          — list contacts
DELETE /jobs/{id}/contacts/{cid}    — remove contact
POST   /jobs/{id}/analyze           — AI analysis (requires jd_text)
GET    /jobs/{id}/prep              — interview prep questions
"""

import json
import os
from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from database import get_db
from models.jobs import ApplicationActivity, ApplicationContact, JobApplication
from models.schemas import (
    ActivityCreateRequest,
    ActivityResponse,
    ContactCreateRequest,
    ContactResponse,
    JobAnalyzeRequest,
    JobAnalyzeResponse,
    JobCreateRequest,
    JobResponse,
    JobStatsResponse,
    JobUpdateRequest,
    PrepQuestionsResponse,
    StatusTransitionRequest,
)
from models.user import CVSession, User
from services.auth_service import get_current_user, require_ownership
from services.job_service import (
    compute_job_stats,
    is_stale,
    validate_status_transition,
)
from services.cv_parser import extract_text_from_pdf
from services.llm_analyzer import analyze_structured
from services.rag_scorer import compute_match_score

router = APIRouter(prefix="/jobs", tags=["jobs"])


def _get_job_or_404(db: Session, job_id: int, user_id: int) -> JobApplication:
    job = db.query(JobApplication).filter(JobApplication.id == job_id).first()
    require_ownership(job.user_id if job else None, user_id)
    return job  # type: ignore[return-value]


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------

@router.post("", status_code=status.HTTP_201_CREATED, response_model=JobResponse)
def create_job(
    payload: JobCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    job = JobApplication(
        user_id=current_user.id,
        stage_entered_at=datetime.utcnow(),
        **payload.model_dump(exclude_none=False),
    )
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


# ---------------------------------------------------------------------------
# List
# ---------------------------------------------------------------------------

@router.get("", response_model=list[JobResponse])
def list_jobs(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    is_archived: Optional[bool] = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    q = db.query(JobApplication).filter(JobApplication.user_id == current_user.id)
    if is_archived is not None:
        q = q.filter(JobApplication.is_archived.is_(is_archived))
    if status:
        q = q.filter(JobApplication.status == status)
    if priority:
        q = q.filter(JobApplication.priority == priority)
    return q.order_by(JobApplication.updated_at.desc()).all()


# ---------------------------------------------------------------------------
# Stats / upcoming / stale  (must come before /{id} to avoid routing clash)
# ---------------------------------------------------------------------------

@router.get("/stats", response_model=JobStatsResponse)
def get_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return compute_job_stats(db, current_user.id)


@router.get("/upcoming", response_model=list[JobResponse])
def get_upcoming(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    today = date.today()
    horizon = today + timedelta(days=7)
    return (
        db.query(JobApplication)
        .filter(
            JobApplication.user_id == current_user.id,
            JobApplication.is_archived.is_(False),
            or_(
                (JobApplication.deadline_date >= today) & (JobApplication.deadline_date <= horizon),
                (JobApplication.followup_date >= today) & (JobApplication.followup_date <= horizon),
            ),
        )
        .all()
    )


@router.get("/stale", response_model=list[JobResponse])
def get_stale(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    jobs = (
        db.query(JobApplication)
        .filter(
            JobApplication.user_id == current_user.id,
            JobApplication.is_archived.is_(False),
        )
        .all()
    )
    return [j for j in jobs if is_stale(db, j)]


# ---------------------------------------------------------------------------
# Detail / update / archive
# ---------------------------------------------------------------------------

@router.get("/{job_id}", response_model=JobResponse)
def get_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return _get_job_or_404(db, job_id, current_user.id)


@router.patch("/{job_id}", response_model=JobResponse)
def update_job(
    job_id: int,
    payload: JobUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    job = _get_job_or_404(db, job_id, current_user.id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(job, field, value)
    job.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(job)
    return job


@router.delete("/{job_id}", response_model=JobResponse)
def archive_job(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    job = _get_job_or_404(db, job_id, current_user.id)
    job.is_archived = True
    job.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(job)
    return job


# ---------------------------------------------------------------------------
# Status transition
# ---------------------------------------------------------------------------

@router.patch("/{job_id}/status", response_model=JobResponse)
def transition_status(
    job_id: int,
    payload: StatusTransitionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    job = _get_job_or_404(db, job_id, current_user.id)
    validate_status_transition(job.status, payload.new_status)

    job.status = payload.new_status
    job.stage_entered_at = datetime.utcnow()
    job.updated_at = datetime.utcnow()

    activity = ApplicationActivity(
        job_application_id=job.id,
        user_id=current_user.id,
        event_type="status_change",
        event_date=date.today(),
        notes=payload.note,
    )
    db.add(activity)
    db.commit()
    db.refresh(job)
    return job


# ---------------------------------------------------------------------------
# Activities
# ---------------------------------------------------------------------------

@router.post("/{job_id}/activities", status_code=status.HTTP_201_CREATED, response_model=ActivityResponse)
def log_activity(
    job_id: int,
    payload: ActivityCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_job_or_404(db, job_id, current_user.id)
    activity = ApplicationActivity(
        job_application_id=job_id,
        user_id=current_user.id,
        event_type=payload.event_type,
        event_date=payload.event_date or date.today(),
        notes=payload.notes,
    )
    db.add(activity)
    db.commit()
    db.refresh(activity)
    return activity


@router.get("/{job_id}/activities", response_model=list[ActivityResponse])
def get_activities(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_job_or_404(db, job_id, current_user.id)
    return (
        db.query(ApplicationActivity)
        .filter(ApplicationActivity.job_application_id == job_id)
        .order_by(ApplicationActivity.event_date.desc())
        .all()
    )


# ---------------------------------------------------------------------------
# Contacts
# ---------------------------------------------------------------------------

@router.post("/{job_id}/contacts", status_code=status.HTTP_201_CREATED, response_model=ContactResponse)
def add_contact(
    job_id: int,
    payload: ContactCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_job_or_404(db, job_id, current_user.id)
    contact = ApplicationContact(
        job_application_id=job_id,
        **payload.model_dump(exclude_none=False),
    )
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return contact


@router.get("/{job_id}/contacts", response_model=list[ContactResponse])
def get_contacts(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_job_or_404(db, job_id, current_user.id)
    return (
        db.query(ApplicationContact)
        .filter(ApplicationContact.job_application_id == job_id)
        .all()
    )


@router.delete("/{job_id}/contacts/{contact_id}", response_model=ContactResponse)
def delete_contact(
    job_id: int,
    contact_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_job_or_404(db, job_id, current_user.id)
    contact = (
        db.query(ApplicationContact)
        .filter(
            ApplicationContact.id == contact_id,
            ApplicationContact.job_application_id == job_id,
        )
        .first()
    )
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    db.delete(contact)
    db.commit()
    return contact


# ---------------------------------------------------------------------------
# AI analysis
# ---------------------------------------------------------------------------

@router.post("/{job_id}/analyze", response_model=JobAnalyzeResponse)
def analyze_job(
    job_id: int,
    payload: JobAnalyzeRequest = JobAnalyzeRequest(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    job = _get_job_or_404(db, job_id, current_user.id)

    effective_jd = payload.jd_text or job.jd_text
    if not effective_jd:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="jd_text is required — provide it in the request body or store it on the job",
        )

    # Load CV text from the linked session (owned by this user)
    cv_text = ""
    if job.cv_session_id:
        session = db.query(CVSession).filter(CVSession.id == job.cv_session_id).first()
        if session and session.user_id == current_user.id:
            from app.config import settings
            cv_path = os.path.join(settings.upload_dir, session.cv_filename)
            if os.path.exists(cv_path):
                cv_text = extract_text_from_pdf(cv_path) or ""

    result = analyze_structured(cv_text, effective_jd)
    score = compute_match_score(cv_text, effective_jd) if cv_text else None

    gaps = result.get("gap_report", [])
    gap_summary = "; ".join(g.get("skill", "") for g in gaps[:5]) if gaps else None

    job.match_score = score
    job.ai_gap_summary = gap_summary
    job.ai_prep_questions = json.dumps(result.get("questions", []))
    if payload.jd_text:
        job.jd_text = payload.jd_text
    job.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(job)

    return JobAnalyzeResponse(match_score=job.match_score, ai_gap_summary=job.ai_gap_summary)


# ---------------------------------------------------------------------------
# Interview prep
# ---------------------------------------------------------------------------

@router.get("/{job_id}/prep")
def get_prep(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from fastapi.responses import JSONResponse

    job = _get_job_or_404(db, job_id, current_user.id)
    if job.ai_prep_questions:
        questions = json.loads(job.ai_prep_questions)
        return PrepQuestionsResponse(questions=questions)

    # No stored questions and no JD — tell the client to trigger analysis first
    return JSONResponse(
        status_code=status.HTTP_202_ACCEPTED,
        content={"status": "pending", "message": "Run /analyze first to generate prep questions."},
    )
