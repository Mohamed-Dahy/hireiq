"""
routers/cv.py
-------------
POST /cv/upload           — receive a PDF CV + JD text, parse, score, save to DB
GET  /cv/{id}/score       — return the stored score for a session (Redis-cached)
GET  /cv/{id}/analysis    — return stored structured analysis (202 if not yet computed)
"""

import json
import logging
import os
import uuid

from fastapi import APIRouter, Body, Request, UploadFile, File, Form, Depends, HTTPException
from fastapi.responses import Response, JSONResponse
from sqlalchemy.orm import Session

from app.config import settings
from database import get_db
from limiter import limiter
from models.user import CVSession, InterviewResult, User
from models.schemas import CVUploadResponse, CVSessionResponse, CVSessionDetailResponse, EnhancedAnalysisResponse, SaveQuestionsRequest
from services.cv_parser import parse_cv, extract_layout_signals
from services.rag_scorer import store_embeddings, compute_match_score, delete_embeddings
from services.cache import get_cached_score, set_cached_score, clear_cached_score
from services.auth_service import get_current_user, require_ownership
from services.report_generator import generate_report
from services.llm_analyzer import run_analysis
from services.linkedin_service import is_linkedin_pdf
from services import ats_checker, token_tracker, ats_keywords
from models.schemas import AtsResultResponse

router = APIRouter()
logger = logging.getLogger(__name__)

_MAX_CV_BYTES = 10 * 1024 * 1024  # 10 MB
_PDF_MAGIC = b"%PDF"


_VALID_MODES = {"job_match", "ats_check"}


def _enforce_new_analysis_quota(db: Session, user: User) -> None:
    """Quota gate for a NEW analysis, checked BEFORE creating the row (FR-025/026)."""
    if user.tier == "free":
        token_tracker.check_free_tier_quota_for_new(db, user)
    elif user.tier in ("pro", "enterprise"):
        token_tracker.check_paid_tier_quota(db, user)


def _build_ats_result(cv_text: str, file_path: str, jd_clean: str) -> dict:
    """Deterministic ATS evaluation, plus AI keyword coverage when a JD is present.

    Keyword coverage is a non-critical, timeout-bounded AI step: on failure it
    reports keyword_coverage.available=False and the deterministic score stands
    (FR-027/028). Returns the full ats_result dict.
    """
    signals = extract_layout_signals(file_path)
    ats_result = ats_checker.evaluate(cv_text, signals)
    if jd_clean:
        coverage = ats_keywords.compute_keyword_coverage(cv_text, jd_clean)
        ats_result["keyword_coverage"] = {
            "matched": coverage["matched"],
            "missing": coverage["missing"],
            "available": coverage["available"],
        }
        ats_result["ai_sections_available"] = coverage["available"]
    return ats_result


def _log_keyword_tokens_if_available(db: Session, user: User, cv_text: str, jd_clean: str, ats_result: dict) -> None:
    """Charge tokens for keyword coverage only when the AI step actually succeeded (FR-028)."""
    kc = ats_result.get("keyword_coverage") or {}
    if jd_clean and kc.get("available"):
        estimated = len(cv_text + jd_clean) // 4
        try:
            token_tracker.log_token_usage(db, user.id, estimated, "ats_keyword_coverage", user.tier)
        except Exception:
            logger.exception("Failed to log ATS keyword-coverage tokens")


@router.post("/upload", response_model=CVUploadResponse)
@limiter.limit("2/minute")
async def upload_cv(
    request: Request,
    cv_file: UploadFile = File(..., description="PDF version of the candidate's CV"),
    jd_text: str | None = Form(None, description="Job description — required for job_match, optional for ats_check"),
    analysis_mode: str = Form("job_match", description="'job_match' or 'ats_check'"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Mode-aware CV intake.

    - job_match (default): requires jd_text; computes a match score, stores
      embeddings, and streams skill-gap analysis via /analyze (unchanged).
    - ats_check: jd_text optional; runs the deterministic ATS engine synchronously
      and returns an ATS score. Quota is checked BEFORE the row is created so a
      blocked attempt consumes no slot.
    """
    if analysis_mode not in _VALID_MODES:
        raise HTTPException(status_code=422, detail="analysis_mode must be 'job_match' or 'ats_check'.")

    jd_clean = (jd_text or "").strip()
    if analysis_mode == "job_match" and not jd_clean:
        raise HTTPException(status_code=422, detail="A job description is required for Job Match Analysis.")

    # --- Read and validate file (no quota consumed on rejection) ---
    contents = await cv_file.read()
    if len(contents) > _MAX_CV_BYTES:
        raise HTTPException(status_code=413, detail="File too large. Maximum size is 10 MB.")
    if not contents[:4] == _PDF_MAGIC:
        raise HTTPException(status_code=422, detail="Invalid file type. Only PDF files are accepted.")

    # --- ATS Check: enforce quota BEFORE creating the session row ---
    if analysis_mode == "ats_check":
        _enforce_new_analysis_quota(db, current_user)

    # --- Save as UUID-named file ---
    os.makedirs(settings.upload_dir, exist_ok=True)
    uuid_name = f"{uuid.uuid4()}.pdf"
    file_path = os.path.join(settings.upload_dir, uuid_name)
    with open(file_path, "wb") as buffer:
        buffer.write(contents)

    parsed = parse_cv(file_path)
    cv_text = parsed["raw_text"]
    linkedin = is_linkedin_pdf(contents)

    if analysis_mode == "ats_check":
        # Deterministic ATS evaluation + (when a JD is present) AI keyword coverage.
        ats_result = _build_ats_result(cv_text, file_path, jd_clean)
        ats_score = ats_result.get("overall_score")
        match_score = compute_match_score(cv_text, jd_clean) if jd_clean else None

        session = CVSession(
            user_id=current_user.id,
            cv_filename=uuid_name,
            original_cv_filename=cv_file.filename or None,
            jd_text=jd_clean or None,
            match_score=match_score,
            is_linkedin=linkedin,
            analysis_mode="ats_check",
            ats_score=ats_score,
            ats_result=json.dumps(ats_result),
        )
        db.add(session)
        db.commit()
        db.refresh(session)

        if jd_clean:
            store_embeddings(session_id=session.id, cv_text=cv_text, jd_text=jd_clean)
            set_cached_score(session_id=session.id, score=match_score)
        _log_keyword_tokens_if_available(db, current_user, cv_text, jd_clean, ats_result)

        return CVUploadResponse(
            session_id=session.id,
            cv_filename=uuid_name,
            match_score=match_score,
            skills_found=parsed["skills"],
            is_linkedin=linkedin,
            analysis_mode="ats_check",
            ats_score=ats_score,
        )

    # --- job_match (unchanged behaviour) ---
    score = compute_match_score(cv_text, jd_clean)
    session = CVSession(
        user_id=current_user.id,
        cv_filename=uuid_name,
        original_cv_filename=cv_file.filename or None,
        jd_text=jd_clean,
        match_score=score,
        is_linkedin=linkedin,
        analysis_mode="job_match",
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    store_embeddings(session_id=session.id, cv_text=cv_text, jd_text=jd_clean)
    set_cached_score(session_id=session.id, score=score)

    return CVUploadResponse(
        session_id=session.id,
        cv_filename=uuid_name,
        match_score=score,
        skills_found=parsed["skills"],
        is_linkedin=linkedin,
        analysis_mode="job_match",
    )


@router.post("/use-stored", response_model=CVUploadResponse)
@limiter.limit("2/minute")
async def use_stored_cv(
    request: Request,
    jd_text: str | None = Body(None, embed=True),
    analysis_mode: str = Body("job_match", embed=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a CVSession using the user's previously stored personal CV.

    Mode-aware like /upload. Sessions created here set from_stored_cv=True so a
    future stored-CV deletion can cascade to their derived results.
    """
    if analysis_mode not in _VALID_MODES:
        raise HTTPException(status_code=422, detail="analysis_mode must be 'job_match' or 'ats_check'.")

    jd_clean = (jd_text or "").strip()
    if analysis_mode == "job_match" and not jd_clean:
        raise HTTPException(status_code=422, detail="A job description is required for Job Match Analysis.")

    profile = current_user.profile
    if not profile or not profile.stored_cv_path:
        raise HTTPException(status_code=400, detail="No stored CV found. Upload one from your profile first.")

    cv_path = profile.stored_cv_path
    if not os.path.exists(cv_path):
        raise HTTPException(status_code=400, detail="Stored CV file not found on disk.")

    if analysis_mode == "ats_check":
        _enforce_new_analysis_quota(db, current_user)

    parsed = parse_cv(cv_path)
    cv_text = parsed["raw_text"]

    # Copy into the main uploads dir under a UUID name so /analyze can find it
    os.makedirs(settings.upload_dir, exist_ok=True)
    uuid_name = f"{uuid.uuid4()}.pdf"
    dest_path = os.path.join(settings.upload_dir, uuid_name)
    with open(cv_path, "rb") as src:
        cv_bytes = src.read()
    with open(dest_path, "wb") as dst:
        dst.write(cv_bytes)
    linkedin = is_linkedin_pdf(cv_bytes)

    if analysis_mode == "ats_check":
        ats_result = _build_ats_result(cv_text, dest_path, jd_clean)
        ats_score = ats_result.get("overall_score")
        match_score = compute_match_score(cv_text, jd_clean) if jd_clean else None

        session = CVSession(
            user_id=current_user.id,
            cv_filename=uuid_name,
            original_cv_filename=profile.stored_cv_filename or None,
            jd_text=jd_clean or None,
            match_score=match_score,
            is_linkedin=linkedin,
            analysis_mode="ats_check",
            ats_score=ats_score,
            ats_result=json.dumps(ats_result),
            from_stored_cv=True,
        )
        db.add(session)
        db.commit()
        db.refresh(session)

        if jd_clean:
            store_embeddings(session_id=session.id, cv_text=cv_text, jd_text=jd_clean)
            set_cached_score(session_id=session.id, score=match_score)
        _log_keyword_tokens_if_available(db, current_user, cv_text, jd_clean, ats_result)

        return CVUploadResponse(
            session_id=session.id,
            cv_filename=uuid_name,
            match_score=match_score,
            skills_found=parsed["skills"],
            is_linkedin=linkedin,
            analysis_mode="ats_check",
            ats_score=ats_score,
        )

    score = compute_match_score(cv_text, jd_clean)
    session = CVSession(
        user_id=current_user.id,
        cv_filename=uuid_name,
        original_cv_filename=profile.stored_cv_filename or None,
        jd_text=jd_clean,
        match_score=score,
        is_linkedin=linkedin,
        analysis_mode="job_match",
        from_stored_cv=True,
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    store_embeddings(session_id=session.id, cv_text=cv_text, jd_text=jd_clean)
    set_cached_score(session_id=session.id, score=score)

    return CVUploadResponse(
        session_id=session.id,
        cv_filename=uuid_name,
        match_score=score,
        skills_found=parsed["skills"],
        is_linkedin=linkedin,
        analysis_mode="job_match",
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
    """Generate and return a PDF report for this CV session (owner-only download)."""
    session = db.query(CVSession).filter(CVSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Not found")
    require_ownership(session.user_id, current_user.id)

    # ATS Check sessions get the ATS report (no LLM recompute; JD may be absent).
    if session.analysis_mode == "ats_check" and session.ats_result:
        from services.report_generator import generate_ats_report
        try:
            ats_data = json.loads(session.ats_result)
        except Exception:
            ats_data = {}
        pdf_bytes = generate_ats_report(
            cv_filename=session.cv_filename,
            original_cv_filename=session.original_cv_filename,
            ats_result=ats_data,
        )
        filename = f"hireiq_ats_report_session_{session_id}.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

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

    # Use stored structured analysis (avoids re-running the LLM every download)
    skill_inventory: list[dict] = []
    gap_report_data: list[dict] = []

    if session.skill_inventory:
        try:
            skill_inventory = json.loads(session.skill_inventory)
        except Exception:
            pass
    if session.gap_report:
        try:
            gap_report_data = json.loads(session.gap_report)
        except Exception:
            pass

    # If analysis was never run, compute it now and persist for future downloads
    if not skill_inventory:
        cv_path = os.path.join(settings.upload_dir, session.cv_filename)
        if os.path.exists(cv_path):
            try:
                from services.llm_analyzer import analyze_structured
                cv_text = parse_cv(cv_path)["raw_text"]
                structured = analyze_structured(cv_text, session.jd_text)
                skill_inventory = structured.get("skill_inventory", [])
                gap_report_data = structured.get("gap_report", [])
                session.skill_inventory = json.dumps(skill_inventory)
                session.gap_report = json.dumps(gap_report_data)
                db.commit()
            except Exception:
                pass

    ai_qs: list[str] = []
    if session.ai_interview_questions:
        try:
            ai_qs = json.loads(session.ai_interview_questions)
        except Exception:
            pass

    pdf_bytes = generate_report(
        cv_filename=session.cv_filename,
        original_cv_filename=session.original_cv_filename,
        jd_snippet=session.jd_snippet,
        match_score=session.match_score or 0.0,
        candidate_level=None,
        skill_inventory=skill_inventory,
        gap_report=gap_report_data,
        ai_interview_questions=ai_qs,
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


@router.get("/{session_id}/ats", response_model=AtsResultResponse)
def get_ats_result(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return the stored ATS result for a session (owner-only).
    Returns 202 status=pending if the session exists but has no ATS result yet.
    """
    session = db.query(CVSession).filter(CVSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Not found")
    require_ownership(session.user_id, current_user.id)

    if not session.ats_result:
        return JSONResponse(
            status_code=202,
            content={"status": "pending", "message": "ATS result not yet computed."},
        )

    data = json.loads(session.ats_result)
    return AtsResultResponse(
        session_id=session.id,
        overall_score=data.get("overall_score", session.ats_score or 0.0),
        ai_sections_available=data.get("ai_sections_available", True),
        categories=data.get("categories", []),
        issues=data.get("issues", []),
        keyword_coverage=data.get("keyword_coverage"),
        strengths=data.get("strengths", []),
        next_steps=data.get("next_steps", []),
        score_explanation=data.get("score_explanation"),
    )


@router.patch("/{session_id}/save-questions", response_model=dict)
def save_interview_questions(
    session_id: int,
    body: SaveQuestionsRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Store AI-generated interview questions on the session for later practice."""
    session = db.query(CVSession).filter(CVSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Not found")
    require_ownership(session.user_id, current_user.id)

    if not body.questions:
        raise HTTPException(status_code=422, detail="questions list must not be empty")

    session.ai_interview_questions = json.dumps(body.questions)
    db.commit()
    return {"saved": len(body.questions)}


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

    cv_filename = session.cv_filename

    db.query(InterviewResult).filter(InterviewResult.session_id == session_id).delete()
    db.delete(session)
    db.commit()
    clear_cached_score(session_id)
    delete_embeddings(session_id)

    # Remove the uploaded CV file from disk so no residual PII is left behind
    # (cv_filename is a server-generated UUID — no path-traversal risk).
    if cv_filename:
        file_path = os.path.join(settings.upload_dir, cv_filename)
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
            except OSError:
                pass

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
