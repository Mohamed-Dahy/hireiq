"""
routers/cv.py
-------------
POST /cv/upload   — receive a PDF CV + JD text, parse, score, save to DB
GET  /cv/{id}/score — return the stored score for a session
"""

import os
import shutil

from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from models.user import CVSession
from models.schemas import CVUploadResponse, CVSessionResponse
from services.cv_parser import parse_cv
from services.rag_scorer import store_embeddings, compute_match_score

router = APIRouter()


# ---------------------------------------------------------------------------
# DB dependency — we will wire up a real DB session in the next step.
# For now this is a placeholder so the router is importable and testable.
# ---------------------------------------------------------------------------

def get_db():
    """
    Yields a SQLAlchemy session.
    Replace the body here once we add database.py with engine + SessionLocal.
    """
    raise NotImplementedError("DB session not wired yet — coming in next step")
    yield  # makes this a generator so FastAPI treats it as a dependency


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.post("/upload", response_model=CVUploadResponse)
async def upload_cv(
    cv_file: UploadFile = File(..., description="PDF version of the candidate's CV"),
    jd_text: str = Form(..., description="Plain-text job description to match against"),
):
    """
    1. Save the uploaded PDF to disk
    2. Extract text + entities with cv_parser
    3. Compute match score with rag_scorer
    4. (DB save comes once we wire up the session — stubbed below)
    5. Return the score + extracted skills
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

    # --- 4. Store embeddings in ChromaDB (session_id=0 until DB is wired) ---
    store_embeddings(session_id=0, cv_text=cv_text, jd_text=jd_text)

    # --- 5. Return result ---
    return CVUploadResponse(
        session_id=0,                       # real ID once DB is connected
        cv_filename=cv_file.filename,
        match_score=score,
        skills_found=parsed["skills"],
    )


@router.get("/{session_id}/score", response_model=CVSessionResponse)
def get_score(session_id: int):
    """Return the stored match score for a given session."""
    # Stubbed — will query CVSession from DB once wired
    raise HTTPException(status_code=501, detail="DB not connected yet")