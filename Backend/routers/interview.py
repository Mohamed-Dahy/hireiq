"""
routers/interview.py
--------------------
POST /interview/answer  — receive audio + optional webcam frames,
                          transcribe with Whisper, score with LLaMA 3,
                          compute eye-contact ratio, save to DB.

GET  /interview/history — return all interview results for the current user.
"""

from fastapi import APIRouter, Request, UploadFile, File, Form, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from limiter import limiter
from models.user import CVSession, InterviewResult, User
from models.schemas import InterviewResultResponse
from services.auth_service import get_current_user
from services.interview_engine import transcribe_audio, score_answer
from services.cv_vision import compute_eye_contact_ratio

router = APIRouter()


@router.post("/answer", response_model=InterviewResultResponse)
@limiter.limit("5/minute")
async def submit_answer(
    request: Request,
    audio: UploadFile = File(..., description="Recorded answer as audio/webm"),
    session_id: int = Form(..., description="CV session this question belongs to"),
    question: str = Form(..., description="The interview question that was asked"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Full interview answer pipeline:
    1. Read audio bytes
    2. Transcribe with Groq Whisper
    3. Score transcript with LLaMA 3 (clarity / relevance / depth)
    4. Save InterviewResult row to Postgres
    5. Return the full result
    """

    # Verify the session belongs to this user
    session = db.query(CVSession).filter(CVSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your session")

    # Read audio
    audio_bytes = await audio.read()
    if not audio_bytes:
        raise HTTPException(status_code=400, detail="Audio file is empty")

    # Transcribe
    transcript = transcribe_audio(audio_bytes, filename=audio.filename or "answer.webm")

    # Score
    scores = score_answer(question=question, transcript=transcript)

    # Save to DB (eye_contact_ratio left None — set via /interview/eye-contact if needed)
    result = InterviewResult(
        session_id=session_id,
        question=question,
        transcript=transcript,
        clarity_score=scores["clarity"],
        relevance_score=scores["relevance"],
        depth_score=scores["depth"],
        eye_contact_ratio=None,
    )
    db.add(result)
    db.commit()
    db.refresh(result)

    return result


@router.post("/eye-contact")
async def submit_eye_contact(
    result_id: int = Form(..., description="InterviewResult ID to update"),
    frames: list[UploadFile] = File(..., description="Webcam frames captured during recording"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Receive webcam frames captured during recording,
    compute the eye-contact ratio, and update the InterviewResult row.
    """
    result = db.query(InterviewResult).filter(InterviewResult.id == result_id).first()
    if not result:
        raise HTTPException(status_code=404, detail="Interview result not found")

    # Verify ownership via the parent session
    session = db.query(CVSession).filter(CVSession.id == result.session_id).first()
    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your result")

    frame_bytes = [await f.read() for f in frames]
    ratio = compute_eye_contact_ratio(frame_bytes)

    result.eye_contact_ratio = ratio
    db.commit()
    db.refresh(result)

    return {"result_id": result_id, "eye_contact_ratio": ratio}


@router.get("/history", response_model=list[InterviewResultResponse])
def get_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return all interview results for the current user, newest first."""
    return (
        db.query(InterviewResult)
        .join(CVSession)
        .filter(CVSession.user_id == current_user.id)
        .order_by(InterviewResult.created_at.desc())
        .all()
    )
