"""
routers/cv.py
-------------
POST /cv/upload           — receive a PDF CV + JD text, parse, score, save to DB
GET  /cv/{id}/score       — return the stored score for a session (Redis-cached)
GET  /cv/{id}/analysis    — return stored structured analysis (202 if not yet computed)
"""

import json
import os
import uuid

from fastapi import APIRouter, Request, UploadFile, File, Form, Depends, HTTPException
from fastapi.responses import Response, JSONResponse
from sqlalchemy.orm import Session

from app.config import settings
from database import get_db
from limiter import limiter
from models.user import CVSession, InterviewResult, User
from models.schemas import CVUploadResponse, CVSessionResponse, CVSessionDetailResponse, EnhancedAnalysisResponse
from services.cv_parser import parse_cv
from services.rag_scorer import store_embeddings, compute_match_score, delete_embeddings
from services.cache import get_cached_score, set_cached_score, clear_cached_score
from services.auth_service import get_current_user, require_ownership
from services.report_generator import generate_report
from services.llm_analyzer import run_analysis
from services.linkedin_service import is_linkedin_pdf

router = APIRouter()

_MAX_CV_BYTES = 10 * 1024 * 1024  # 10 MB
_PDF_MAGIC = b"%PDF"


@router.post("/upload", response_model=CVUploadResponse)
@limiter.limit("2/minute")
async def upload_cv(
    request: Request,
    cv_file: UploadFile = File(..., description="PDF version of the candidate's CV"),
    jd_text: str = Form(..., description="Plain-text job description to match against"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    1. Validate PDF magic bytes and enforce 10 MB size limit
    2. Save as UUID-named file (original filename discarded)
    3. Extract text + entities with cv_parser
    4. Compute match score with rag_scorer
    5. Save CVSession row to Postgres
    6. Cache the score in Redis for 1 hour
    7. Return the score + extracted skills
    """

    # --- 1. Read and validate file ---
    contents = await cv_file.read()

    if len(contents) > _MAX_CV_BYTES:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 10 MB.")

    if not contents[:4] == _PDF_MAGIC:
        raise HTTPException(status_code=422, detail="Invalid file type. Only PDF files are accepted.")

    # --- 2. Save as UUID-named file ---
    os.makedirs(settings.upload_dir, exist_ok=True)
    uuid_name = f"{uuid.uuid4()}.pdf"
    file_path = os.path.join(settings.upload_dir, uuid_name)

    with open(file_path, "wb") as buffer:
        buffer.write(contents)

    # --- 3. Parse CV ---
    parsed = parse_cv(file_path)
    cv_text = parsed["raw_text"]

    # --- 4. Score ---
    score = compute_match_score(cv_text, jd_text)

    # --- 5. Detect LinkedIn export ---
    linkedin = is_linkedin_pdf(contents)

    # --- 6. Save to Postgres ---
    session = CVSession(
        user_id=current_user.id,
        cv_filename=uuid_name,
        jd_text=jd_text,
        match_score=score,
        is_linkedin=linkedin,
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    # --- 7. Store embeddings + cache score ---
    store_embeddings(session_id=session.id, cv_text=cv_text, jd_text=jd_text)
    set_cached_score(session_id=session.id, score=score)

    return CVUploadResponse(
        session_id=session.id,
        cv_filename=uuid_name,
        match_score=score,
        skills_found=parsed["skills"],
        is_linkedin=linkedin,
    )


@router.get("/sessions", response_model=list[CVSessionResponse])
def get_sessions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all CV sessions for the current user, newest first."""
    return (
        db.query(CVSession)
        .filter(CVSession.user_id == current_user.id)
        .order_by(CVSession.created_at.desc())
        .all()
    )


@router.get("/{session_id}/detail", response_model=CVSessionDetailResponse)
def get_session_detail(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return a session with all its interview results."""
    session = db.query(CVSession).filter(CVSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Not found")
    require_ownership(session.user_id, current_user.id)
    return session


@router.get("/{session_id}/report")
def download_report(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate and return a PDF report for this CV session."""
    session = db.query(CVSession).filter(CVSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Not found")
    require_ownership(session.user_id, current_user.id)

    interview_rows = (
        db.query(InterviewResult)
        .filter(InterviewResult.session_id == session_id)
        .order_by(InterviewResult.created_at)
        .all()
    )

    interview_dicts = [
        {
            "question":          r.question,
            "transcript":        r.transcript,
            "clarity_score":     r.clarity_score,
            "relevance_score":   r.relevance_score,
            "depth_score":       r.depth_score,
            "eye_contact_ratio": r.eye_contact_ratio,
        }
        for r in interview_rows
    ]

    # Re-parse CV to get skills, then run LLM analysis (non-streaming)
    cv_path = os.path.join(settings.upload_dir, session.cv_filename)
    skills: list[str] = []
    analysis_text = ""

    if os.path.exists(cv_path):
        parsed = parse_cv(cv_path)
        skills = parsed.get("skills", [])
        cv_text = parsed["raw_text"]
        try:
            analysis_text = run_analysis(cv_text=cv_text, jd_text=session.jd_text)
        except Exception:
            analysis_text = ""

    pdf_bytes = generate_report(
        cv_filename=session.cv_filename,
        match_score=session.match_score or 0.0,
        skills=skills,
        analysis_text=analysis_text,
        interview_results=interview_dicts,
    )

    filename = f"hireiq_report_session_{session_id}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/{session_id}/analysis")
def get_analysis(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return the stored structured analysis for a session.
    Returns 202 with status=pending if the SSE stream hasn't run yet.
    Returns 200 with skill_inventory, gap_report, and study_roadmap when available.
    """
    session = db.query(CVSession).filter(CVSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Not found")
    require_ownership(session.user_id, current_user.id)

    if session.skill_inventory is None:
        return JSONResponse(
            status_code=202,
            content={
                "status": "pending",
                "message": "Analysis not yet computed. Stream it first via /analyze.",
            },
        )

    return {
        "skill_inventory": json.loads(session.skill_inventory),
        "gap_report": json.loads(session.gap_report) if session.gap_report else [],
        "study_roadmap": json.loads(session.study_roadmap) if session.study_roadmap else [],
    }


@router.delete("/{session_id}", status_code=204)
def delete_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a CV session, its interview results, and any cached score."""
    session = db.query(CVSession).filter(CVSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Not found")
    require_ownership(session.user_id, current_user.id)

    db.query(InterviewResult).filter(InterviewResult.session_id == session_id).delete()
    db.delete(session)
    db.commit()
    clear_cached_score(session_id)
    delete_embeddings(session_id)
    return Response(status_code=204)


@router.get("/{session_id}/score", response_model=CVSessionResponse)
def get_score(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return the match score for a session.
    Checks Redis first — falls back to Postgres if cache miss.
    """

    # --- Cache hit: return instantly ---
    cached = get_cached_score(session_id)
    if cached is not None:
        session = db.query(CVSession).filter(CVSession.id == session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Not found")
        require_ownership(session.user_id, current_user.id)
        session.match_score = cached
        return session

    # --- Cache miss: query Postgres ---
    session = db.query(CVSession).filter(CVSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Not found")
    require_ownership(session.user_id, current_user.id)

    if session.match_score is not None:
        set_cached_score(session_id=session_id, score=session.match_score)

    return session
