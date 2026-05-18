"""
routers/recruiter.py
---------------------
POST   /recruiter/lists                                    — create list
GET    /recruiter/lists                                    — list own lists
DELETE /recruiter/lists/{list_id}                         — delete list
GET    /recruiter/lists/{list_id}/candidates               — get candidates (sorted by score)
POST   /recruiter/lists/{list_id}/candidates               — add candidate
PATCH  /recruiter/lists/{list_id}/candidates/{cid}        — update rank
DELETE /recruiter/lists/{list_id}/candidates/{cid}        — remove candidate
GET    /recruiter/lists/{list_id}/export                  — PDF export
"""

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from database import get_db
from models.jobs import RecruiterCandidate, RecruiterList
from models.user import CVSession, User
from models.schemas import (
    AddCandidateRequest,
    RecruiterCandidateListResponse,
    RecruiterCandidateResponse,
    RecruiterCandidateUpdate,
    RecruiterListCreate,
    RecruiterListResponse,
)
from services.auth_service import get_current_user, require_ownership
from services.report_generator import generate_recruiter_report

router = APIRouter(prefix="/recruiter", tags=["recruiter"])

_MAX_CANDIDATES = 20


def _get_list_or_404(db: Session, list_id: int, user_id: int) -> RecruiterList:
    rl = db.query(RecruiterList).filter(RecruiterList.id == list_id).first()
    require_ownership(rl.user_id if rl else None, user_id)
    return rl  # type: ignore[return-value]


def _candidate_to_response(c: RecruiterCandidate) -> RecruiterCandidateResponse:
    return RecruiterCandidateResponse(
        id=c.id,
        session_id=c.session_id,
        rank=c.rank,
        cv_filename=c.session.cv_filename,
        jd_snippet=c.session.jd_snippet,
        match_score=c.session.match_score,
        skill_inventory=c.session.skill_inventory,
        created_at=c.created_at,
    )


# ---------------------------------------------------------------------------
# Lists CRUD
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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rl = _get_list_or_404(db, list_id, current_user.id)
    sorted_candidates = sorted(
        rl.candidates,
        key=lambda c: (c.session.match_score or 0),
        reverse=True,
    )
    return RecruiterCandidateListResponse(
        list_id=rl.id,
        list_name=rl.name,
        candidates=[_candidate_to_response(c) for c in sorted_candidates],
    )


@router.post(
    "/lists/{list_id}/candidates",
    status_code=status.HTTP_201_CREATED,
    response_model=RecruiterCandidateResponse,
)
def add_candidate(
    list_id: int,
    payload: AddCandidateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rl = _get_list_or_404(db, list_id, current_user.id)

    # Enforce 20-candidate limit
    if len(rl.candidates) >= _MAX_CANDIDATES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Recruiter list is at the {_MAX_CANDIDATES}-candidate limit.",
        )

    # Validate session ownership and analysis completion
    session = db.query(CVSession).filter(CVSession.id == payload.session_id).first()
    if not session or session.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Session not found or not owned by you.",
        )
    if session.match_score is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Session has no match score — run analysis first.",
        )

    # Check for duplicate
    existing = (
        db.query(RecruiterCandidate)
        .filter(
            RecruiterCandidate.recruiter_list_id == list_id,
            RecruiterCandidate.session_id == payload.session_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This session is already in the list.",
        )

    candidate = RecruiterCandidate(
        recruiter_list_id=list_id,
        session_id=payload.session_id,
    )
    db.add(candidate)
    db.commit()
    db.refresh(candidate)
    return _candidate_to_response(candidate)


@router.patch(
    "/lists/{list_id}/candidates/{candidate_id}",
    response_model=RecruiterCandidateResponse,
)
def update_candidate_rank(
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
        key=lambda c: (c.session.match_score or 0),
        reverse=True,
    )
    pdf_bytes = generate_recruiter_report(rl, sorted_candidates)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="recruiter_list_{list_id}.pdf"'},
    )
