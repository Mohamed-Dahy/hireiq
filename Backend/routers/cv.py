"""
routers/cv.py
-------------
POST /cv/upload      — receive a PDF CV + JD text, parse, score, save to DB
GET  /cv/{id}/score  — return the stored score for a session (Redis-cached)
"""

import os
import shutil

from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from database import get_db
from models.user import CVSession
from models.schemas import CVUploadResponse, CVSessionResponse
from services.cv_parser import parse_cv
from services.rag_scorer import store_embeddings, compute_match_score
from services.cache import get_cached_score, set_cached_score

router = APIRouter()


@router.post("/upload", response_model=CVUploadResponse)
async def upload_cv(
    cv_file: UploadFile = File(..., description="PDF version of the candidate's CV"),
    jd_text: str = Form(..., description="Plain-text job description to match against"),
    db: Session = Depends(get_db),
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
