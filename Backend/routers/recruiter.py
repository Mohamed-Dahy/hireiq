"""
routers/recruiter.py
---------------------
POST   /recruiter/lists                                    — create pipeline
GET    /recruiter/lists                                    — list own pipelines
DELETE /recruiter/lists/{list_id}                         — delete pipeline

GET    /recruiter/lists/{list_id}/candidates               — get candidates (date-sorted, optional ?status= filter)
POST   /recruiter/lists/{list_id}/candidates               — add standalone candidate (Form + optional CV file)
PATCH  /recruiter/lists/{list_id}/candidates/{cid}        — update status / notes / starred / rank
DELETE /recruiter/lists/{list_id}/candidates/{cid}        — remove candidate

GET    /recruiter/lists/{list_id}/export                  — PDF export
"""

import os
import uuid
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from database import get_db
from models.jobs import RecruiterCandidate, RecruiterList
from models.user import User
from models.schemas import (
    RecruiterCandidateListResponse,
    RecruiterCandidateResponse,
    RecruiterCandidateUpdate,
    RecruiterListCreate,
    RecruiterListResponse,
)
from services.auth_service import get_current_user, require_ownership
from services.report_generator import generate_recruiter_report

router = APIRouter(prefix="/recruiter", tags=["recruiter"])

_MAX_CANDIDATES = 50
_UPLOAD_DIR = "./uploads/recruiter"

VALID_STATUSES = {"new", "screening", "interview", "offer", "hired", "rejected"}


def _get_list_or_404(db: Session, list_id: int, user_id: int) -> RecruiterList:
    rl = db.query(RecruiterList).filter(RecruiterList.id == list_id).first()
    require_ownership(rl.user_id if rl else None, user_id)
    return rl  # type: ignore[return-value]


def _candidate_to_response(c: RecruiterCandidate) -> RecruiterCandidateResponse:
    if c.session:
        cv_filename = c.session.cv_filename
        jd_snippet = c.session.jd_snippet
        match_score = c.session.match_score
        skill_inventory = c.session.skill_inventory
    else:
        cv_filename = os.path.basename(c.cv_file_path) if c.cv_file_path else None
        jd_snippet = None
        match_score = None
        skill_inventory = None

    display_name = c.candidate_name or cv_filename or "Unknown"

    return RecruiterCandidateResponse(
        id=c.id,
        session_id=c.session_id,
        rank=c.rank,
        status=c.status,
        notes=c.notes,
        starred=c.starred,
        candidate_name=c.candidate_name,
        candidate_email=c.candidate_email,
        candidate_phone=c.candidate_phone,
        applied_position=c.applied_position,
        cv_file_path=c.cv_file_path,
        display_name=display_name,
        cv_filename=cv_filename,
        jd_snippet=jd_snippet,
        match_score=match_score,
        skill_inventory=skill_inventory,
        created_at=c.created_at,
    )


# ---------------------------------------------------------------------------
# Pipelines CRUD
# ---------------------------------------------------------------------------

@router.post("/lists", status_code=status.HTTP_201_CREATED, response_model=RecruiterListResponse)
def create_list(
    payload: RecruiterListCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rl = RecruiterList(
        user_id=current_user.id,
        name=payload.name,
        job_title=payload.job_title,
    )
    db.add(rl)
    db.commit()
    db.refresh(rl)
    return RecruiterListResponse(
        id=rl.id,
        name=rl.name,
        job_title=rl.job_title,
        candidate_count=0,
        created_at=rl.created_at,
    )


@router.get("/lists", response_model=list[RecruiterListResponse])
def list_lists(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = (
        db.query(RecruiterList)
        .filter(RecruiterList.user_id == current_user.id)
        .order_by(RecruiterList.created_at.desc())
        .all()
    )
    return [
        RecruiterListResponse(
            id=rl.id,
            name=rl.name,
            job_title=rl.job_title,
            candidate_count=len(rl.candidates),
            created_at=rl.created_at,
        )
        for rl in rows
    ]


@router.delete("/lists/{list_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_list(
    list_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rl = _get_list_or_404(db, list_id, current_user.id)
    db.delete(rl)
    db.commit()


# ---------------------------------------------------------------------------
# Candidates
# ---------------------------------------------------------------------------

@router.get("/lists/{list_id}/candidates", response_model=RecruiterCandidateListResponse)
def get_candidates(
    list_id: int,
    filter_status: Optional[str] = Query(None, alias="status"),
    starred_only: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rl = _get_list_or_404(db, list_id, current_user.id)

    candidates = list(rl.candidates)

    if filter_status and filter_status in VALID_STATUSES:
        candidates = [c for c in candidates if c.status == filter_status]
    if starred_only:
        candidates = [c for c in candidates if c.starred]

    # Sort starred first, then by date added (newest first)
    candidates.sort(key=lambda c: (not c.starred, c.created_at), reverse=False)

    return RecruiterCandidateListResponse(
        list_id=rl.id,
        list_name=rl.name,
        candidates=[_candidate_to_response(c) for c in candidates],
    )


@router.post(
    "/lists/{list_id}/candidates",
    status_code=status.HTTP_201_CREATED,
    response_model=RecruiterCandidateResponse,
)
async def add_candidate(
    list_id: int,
    candidate_name: str = Form(...),
    candidate_email: Optional[str] = Form(None),
    candidate_phone: Optional[str] = Form(None),
    applied_position: Optional[str] = Form(None),
    cv_file: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rl = _get_list_or_404(db, list_id, current_user.id)

    if len(rl.candidates) >= _MAX_CANDIDATES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Pipeline is at the {_MAX_CANDIDATES}-candidate limit.",
        )

    saved_path: Optional[str] = None
    if cv_file and cv_file.filename:
        os.makedirs(_UPLOAD_DIR, exist_ok=True)
        ext = os.path.splitext(cv_file.filename)[1].lower()
        if ext not in (".pdf", ".doc", ".docx"):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="CV must be a PDF, DOC, or DOCX file.",
            )
        safe_name = f"{uuid.uuid4().hex}{ext}"
        saved_path = os.path.join(_UPLOAD_DIR, safe_name)
        content = await cv_file.read()
        with open(saved_path, "wb") as f:
            f.write(content)

    candidate = RecruiterCandidate(
        recruiter_list_id=list_id,
        session_id=None,
        candidate_name=candidate_name.strip(),
        candidate_email=candidate_email.strip() if candidate_email else None,
        candidate_phone=candidate_phone.strip() if candidate_phone else None,
        applied_position=applied_position.strip() if applied_position else None,
        cv_file_path=saved_path,
        status="new",
    )
    db.add(candidate)
    db.commit()
    db.refresh(candidate)
    return _candidate_to_response(candidate)


@router.patch(
    "/lists/{list_id}/candidates/{candidate_id}",
    response_model=RecruiterCandidateResponse,
)
def update_candidate(
    list_id: int,
    candidate_id: int,
    payload: RecruiterCandidateUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_list_or_404(db, list_id, current_user.id)
    candidate = (
        db.query(RecruiterCandidate)
        .filter(
            RecruiterCandidate.id == candidate_id,
            RecruiterCandidate.recruiter_list_id == list_id,
        )
        .first()
    )
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")

    if payload.rank is not None:
        candidate.rank = payload.rank
    if payload.status is not None:
        if payload.status not in VALID_STATUSES:
            raise HTTPException(status_code=422, detail=f"Invalid status. Valid values: {sorted(VALID_STATUSES)}")
        candidate.status = payload.status
    if payload.notes is not None:
        candidate.notes = payload.notes
    if payload.starred is not None:
        candidate.starred = payload.starred

    db.commit()
    db.refresh(candidate)
    return _candidate_to_response(candidate)


@router.delete("/lists/{list_id}/candidates/{candidate_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_candidate(
    list_id: int,
    candidate_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _get_list_or_404(db, list_id, current_user.id)
    candidate = (
        db.query(RecruiterCandidate)
        .filter(
            RecruiterCandidate.id == candidate_id,
            RecruiterCandidate.recruiter_list_id == list_id,
        )
        .first()
    )
    if not candidate:
        raise HTTPException(status_code=404, detail="Candidate not found")
    db.delete(candidate)
    db.commit()


# ---------------------------------------------------------------------------
# PDF Export
# ---------------------------------------------------------------------------

@router.get("/lists/{list_id}/export")
def export_list_pdf(
    list_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rl = _get_list_or_404(db, list_id, current_user.id)
    sorted_candidates = sorted(
        rl.candidates,
        key=lambda c: (not c.starred, c.created_at),
    )
    pdf_bytes = generate_recruiter_report(rl, sorted_candidates)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="pipeline_{list_id}.pdf"'},
    )
