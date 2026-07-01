"""
routers/analysis.py
-------------------
GET /analyze?session_id=X&token=JWT  — streams skill gap analysis via SSE.

EventSource (browser) only supports GET and cannot set Authorization headers,
so we accept the JWT as a query param and validate it manually here.

After the narrative stream completes, a named `structured` event is emitted
with the JSON analysis payload — BEFORE the [DONE] sentinel so the client
EventSource is still open when the structured event arrives.
"""

import json
import logging
import os
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.config import settings
from database import get_db, SessionLocal
from models.user import CVSession, User
from services.llm_analyzer import stream_analysis, analyze_structured
from services.auth_service import decode_token, is_jti_blacklisted
from services.cv_parser import extract_text_from_pdf
from services import token_tracker
from limiter import limiter

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("")
@limiter.limit("3/minute")
def analyze(
    request: Request,
    session_id: int = Query(...),
    token: str = Query(...),
    db: Session = Depends(get_db),
):
    """
    Stream skill gap analysis for a CV session via Server-Sent Events.
    The token query param is used because EventSource cannot send headers.

    Event sequence:
      1. data: <text chunk>  (repeated, narrative analysis)
      2. event: structured / data: <json>
      3. data: [DONE]
    """
    payload = decode_token(token)
    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token type")

    # Honour JTI blacklist (populated on logout) — EventSource can't use the
    # standard Bearer dependency, so we must replicate its checks manually.
    jti = payload.get("jti")
    if jti and is_jti_blacklisted(jti):
        raise HTTPException(status_code=401, detail="Token has been revoked")

    user_id_str = payload.get("sub")
    if not user_id_str:
        raise HTTPException(status_code=401, detail="Invalid token")
    user_id = int(user_id_str)

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    # Honour sessions_revoked_at (set on password reset).
    if user.sessions_revoked_at:
        iat = payload.get("iat")
        if iat is not None and datetime.fromtimestamp(int(iat), tz=timezone.utc).replace(tzinfo=None) < user.sessions_revoked_at:
            raise HTTPException(status_code=401, detail="Token revoked — please log in again")

    # Quota check BEFORE returning the streaming response
    if user.tier == "free":
        token_tracker.check_free_tier_quota(db, user)
    elif user.tier in ("pro", "enterprise"):
        token_tracker.check_paid_tier_quota(db, user)

    session = db.query(CVSession).filter(CVSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not your session")

    # Skill-gap analysis requires a job description. ATS-only sessions (jd_text
    # is nullable since spec 003) have no JD — guard against a null concatenation.
    if session.analysis_mode == "ats_check" or not session.jd_text:
        raise HTTPException(
            status_code=400,
            detail="This session has no job description. Use the ATS result endpoint instead.",
        )

    cv_path = os.path.join(settings.upload_dir, session.cv_filename)
    if not os.path.exists(cv_path):
        raise HTTPException(status_code=404, detail="CV file not found on disk")

    cv_text = extract_text_from_pdf(cv_path)
    # Capture plain values now — the generator may outlive the request-scoped
    # SQLAlchemy session, so we must not access `session.*` or `user.*` inside
    # the generator.
    session_id_val: int = session.id
    jd_text_val: str = session.jd_text
    user_id_val: int = user.id
    user_tier_val: str = user.tier
    estimated_tokens: int = len(cv_text + jd_text_val) // 4

    def event_stream():
        # 1. Stream narrative analysis text
        for chunk in stream_analysis(cv_text=cv_text, jd_text=jd_text_val):
            safe_chunk = chunk.replace("\n", "\\n")
            yield f"data: {safe_chunk}\n\n"

        # 2. Compute structured analysis
        structured = analyze_structured(cv_text=cv_text, jd_text=jd_text_val)

        # 3. Persist using a fresh, independent session so the commit is not
        #    affected by the request-scoped session's lifecycle inside the generator.
        try:
            save_db = SessionLocal()
            try:
                row = save_db.query(CVSession).filter(CVSession.id == session_id_val).first()
                if row:
                    row.skill_inventory = json.dumps(structured.get("skill_inventory", []))
                    row.gap_report = json.dumps(structured.get("gap_report", []))
                    save_db.commit()
                # Log token usage in the same independent session
                token_tracker.log_token_usage(
                    save_db, user_id_val, estimated_tokens, "cv_analysis", user_tier_val
                )
            finally:
                save_db.close()
        except Exception:
            logger.exception("Failed to persist analysis for session %s", session_id_val)

        # 4. Emit structured event BEFORE [DONE] — client closes on [DONE]
        structured_payload = json.dumps(structured)
        yield f"event: structured\ndata: {structured_payload}\n\n"

        # 5. Signal end of stream
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
