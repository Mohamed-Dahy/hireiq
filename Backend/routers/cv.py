"""
routers/cv.py
-------------
POST /cv/upload      — receive a PDF CV + JD text, parse, score, save to DB
GET  /cv/{id}/score  — return the stored score for a session (Redis-cached)
"""

import os
import shutil

from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.config import settings
from database import get_db
from models.user import CVSession, InterviewResult, User
from models.schemas import CVUploadResponse, CVSessionResponse, CVSessionDetailResponse
from services.cv_parser import parse_cv, extract_text_from_pdf
from services.rag_scorer import store_embeddings, compute_match_score
from services.cache import get_cached_score, set_cached_score, clear_cached_score
from services.auth_service import get_current_user
from services.report_generator import generate_report
from services.llm_analyzer import run_analysis

router = APIRouter()


@router.post("/upload", response_model=CVUploadResponse)
async def upload_cv(
    cv_file: UploadFile = File(..., description="PDF version of the candidate's CV"),
    jd_text: str = Form(..., description="Plain-text job description to match against"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    1. Save the uploaded PDF to disk
    2. Extract text + entities with cv_parser
    3. Compute match score with rag_scorer
    4. Save CVSession row to Postgres
    5. Cache the score in Redis for 1 hour
    6. Return the score + extracted skills
    """

    # --- 1. Save PDF to upload directory ---
    os.makedirs(settings.upload_dir, exist_ok=True)
    file_path = os.path.join(settings.upload_dir, cv_file.filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(cv_file.file, buffer)

    # --- 2. Parse CV ---
    parsed = parse_cv(file_path)
    cv_text = parsed["raw_text"]

    # --- 3. Score ---
    score = compute_match_score(cv_text, jd_text)

    # --- 4. Save to Postgres ---
    session = CVSession(
        user_id=current_user.id,
        cv_filename=cv_file.filename,
        jd_text=jd_text,
        match_score=score,
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    # --- 5. Store embeddings + cache score ---
    store_embeddings(session_id=session.id, cv_text=cv_text, jd_text=jd_text)
    set_cached_score(session_id=session.id, score=score)

    return CVUploadResponse(
        session_id=session.id,
        cv_filename=cv_file.filename,
        match_score=score,
        skills_found=parsed["skills"],
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
    session = (
        db.query(CVSession)
        .filter(CVSession.id == session_id, CVSession.user_id == current_user.id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
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
        raise HTTPException(status_code=404, detail="Session not found")
    if session.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your session")

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


@router.delete("/{session_id}", status_code=204)
def delete_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a CV session, its interview results, and any cached score."""
    session = db.query(CVSession).filter(CVSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your session")

    db.query(InterviewResult).filter(InterviewResult.session_id == session_id).delete()
    db.delete(session)
    db.commit()
    clear_cached_score(session_id)
    return Response(status_code=204)


@router.get("/{session_id}/score", response_model=CVSessionResponse)
def get_score(session_id: int, db: Session = Depends(get_db)):
    """
    Return the match score for a session.
    Checks Redis first — falls back to Postgres if cache miss.
    """

    # --- Cache hit: return instantly ---
    cached = get_cached_score(session_id)
    if cached is not None:
        session = db.query(CVSession).filter(CVSession.id == session_id).first()
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        session.match_score = cached  # use cached value
        return session

    # --- Cache miss: query Postgres ---
    session = db.query(CVSession).filter(CVSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Re-cache for next time
    if session.match_score is not None:
        set_cached_score(session_id=session_id, score=session.match_score)

    return session
