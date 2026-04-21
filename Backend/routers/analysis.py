"""
routers/analysis.py
-------------------
POST /analyze  — streams skill gap analysis + interview questions via SSE.

The frontend connects and receives tokens as they arrive from Groq,
so the user sees results appear live instead of waiting for the full response.
"""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from database import get_db
from models.user import CVSession, User
from models.schemas import AnalysisRequest
from services.llm_analyzer import stream_analysis
from services.auth_service import get_current_user

router = APIRouter()


@router.post("")
def analyze(
    payload: AnalysisRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Stream skill gap analysis for a CV session.
    Returns Server-Sent Events (SSE) — each chunk is a piece of the LLM response.

    Frontend usage:
        const source = new EventSource('/analyze')
        source.onmessage = (e) => appendText(e.data)
    """

    # Load the session and verify it belongs to the current user
    session = db.query(CVSession).filter(CVSession.id == payload.session_id).first()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your session")

    # Read CV text from the stored file
    import os
    from app.config import settings
    from services.cv_parser import extract_text_from_pdf

    cv_path = os.path.join(settings.upload_dir, session.cv_filename)
    if not os.path.exists(cv_path):
        raise HTTPException(status_code=404, detail="CV file not found on disk")

    cv_text = extract_text_from_pdf(cv_path)

    def event_stream():
        """Wrap each LLM chunk in SSE format: 'data: <chunk>\n\n'"""
        for chunk in stream_analysis(cv_text=cv_text, jd_text=session.jd_text):
            # Replace newlines so SSE protocol isn't broken
            safe_chunk = chunk.replace("\n", "\\n")
            yield f"data: {safe_chunk}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",   # disables Nginx buffering if deployed
        },
    )
