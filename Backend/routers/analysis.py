"""
routers/analysis.py
-------------------
GET /analyze?session_id=X&token=JWT  — streams skill gap analysis via SSE.

EventSource (browser) only supports GET and cannot set Authorization headers,
so we accept the JWT as a query param and validate it manually here.
"""

import os

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.config import settings
from database import get_db
from models.user import CVSession
from services.llm_analyzer import stream_analysis
from services.auth_service import decode_token
from services.cv_parser import extract_text_from_pdf

router = APIRouter()


@router.get("")
def analyze(
    session_id: int = Query(...),
    token: str = Query(...),
    db: Session = Depends(get_db),
):
    """
    Stream skill gap analysis for a CV session via Server-Sent Events.
    The token query param is used because EventSource cannot send headers.
    """

    # Validate JWT manually (can't use Depends(get_current_user) with SSE GET)
    payload = decode_token(token)
    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token type")
    user_id = int(payload.get("sub", 0))

    session = db.query(CVSession).filter(CVSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not your session")

    cv_path = os.path.join(settings.upload_dir, session.cv_filename)
    if not os.path.exists(cv_path):
        raise HTTPException(status_code=404, detail="CV file not found on disk")

    cv_text = extract_text_from_pdf(cv_path)

    def event_stream():
        for chunk in stream_analysis(cv_text=cv_text, jd_text=session.jd_text):
            safe_chunk = chunk.replace("\n", "\\n")
            yield f"data: {safe_chunk}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
