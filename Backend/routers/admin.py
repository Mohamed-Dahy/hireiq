"""
admin.py
--------
Admin-only endpoints. No user session involved.
POST /admin/login is the sole public route — all others require a valid admin JWT.
"""

import platform
import sys
import time
from datetime import datetime, date
from typing import Optional

import httpx
import psutil
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, text
from sqlalchemy.orm import Session

from database import get_db
from limiter import limiter
from models.content import InterviewQuestion
from models.jobs import JobApplication
from models.roadmap import CareerRoadmap
from models.schemas import AdminLoginRequest, AdminTokenResponse
from models.user import CVSession, InterviewResult, User
from services.admin_service import create_admin_token, require_admin, verify_admin_credentials
from services.analytics_service import get_all_users, get_platform_metrics
from services.cache import redis_client
from services import token_tracker

router = APIRouter()

_START_TIME = time.time()

# Tier pricing assumptions for MRR estimate
_TIER_PRICE = {"free": 0, "pro": 29, "enterprise": 99}


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

@router.post("/login", response_model=AdminTokenResponse)
@limiter.limit("5/15minute")
def admin_login(request: Request, body: AdminLoginRequest):
    if not verify_admin_credentials(body.email, body.password):
        raise HTTPException(status_code=401, detail="Invalid admin credentials")
    return {"access_token": create_admin_token()}


# ---------------------------------------------------------------------------
# Metrics / BI
# ---------------------------------------------------------------------------

@router.get("/metrics")
def admin_metrics(
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    base = get_platform_metrics(db)

    # MRR estimate from tier distribution
    pro_count = db.query(func.count(User.id)).filter(User.tier == "pro").scalar() or 0
    ent_count = db.query(func.count(User.id)).filter(User.tier == "enterprise").scalar() or 0
    mrr = pro_count * _TIER_PRICE["pro"] + ent_count * _TIER_PRICE["enterprise"]

    # DAU: users who had a cv session today
    today = datetime.utcnow().date()
    dau = (
        db.query(func.count(func.distinct(CVSession.user_id)))
        .filter(func.date(CVSession.created_at) == today)
        .scalar() or 0
    )

    base["billing"] = {
        "mrr_estimate_usd": mrr,
        "pro_users": pro_count,
        "enterprise_users": ent_count,
    }
    base["dau"] = dau
    return base


# ---------------------------------------------------------------------------
# User management
# ---------------------------------------------------------------------------

@router.get("/users")
def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    tier: Optional[str] = Query(None, pattern="^(free|pro|enterprise)$"),
    status: Optional[str] = Query(None, pattern="^(locked|unverified|active)$"),
    joined_from: Optional[date] = Query(None),
    joined_to: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    q = db.query(User)
    if tier:
        q = q.filter(User.tier == tier)
    if status == "locked":
        q = q.filter(User.locked_until > datetime.utcnow())
    elif status == "unverified":
        q = q.filter(User.email_verified == False)
    elif status == "active":
        q = q.filter(User.email_verified == True, User.locked_until == None)
    if joined_from:
        q = q.filter(func.date(User.created_at) >= joined_from)
    if joined_to:
        q = q.filter(func.date(User.created_at) <= joined_to)

    total = q.count()
    users = q.order_by(User.created_at.desc()).offset(skip).limit(limit).all()

    result = []
    for u in users:
        session_count = (
            db.query(func.count(CVSession.id)).filter(CVSession.user_id == u.id).scalar() or 0
        )
        result.append({
            "id": u.id,
            "email": u.email,
            "username": u.username,
            "tier": u.tier,
            "is_admin": u.is_admin,
            "email_verified": u.email_verified,
            "created_at": u.created_at.isoformat() if u.created_at else None,
            "session_count": session_count,
            "locked_until": u.locked_until.isoformat() if u.locked_until else None,
        })
    return {"total": total, "users": result}


@router.patch("/users/{user_id}/tier")
def set_user_tier(
    user_id: int,
    tier: str = Query(..., pattern="^(free|pro|enterprise)$"),
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.tier = tier
    db.commit()
    return {"id": user_id, "tier": tier}


@router.patch("/users/{user_id}/unlock")
def unlock_user(
    user_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.locked_until = None
    user.failed_login_count = 0
    db.commit()
    return {"id": user_id, "unlocked": True}


@router.patch("/users/{user_id}/verify")
def verify_user_email(
    user_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.email_verified = True
    db.commit()
    return {"id": user_id, "email_verified": True}


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return {"deleted": user_id}


# ---------------------------------------------------------------------------
# Per-user usage stats
# ---------------------------------------------------------------------------

@router.get("/usage/{user_id}")
def user_usage(
    user_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    cv_count = db.query(func.count(CVSession.id)).filter(CVSession.user_id == user_id).scalar() or 0
    avg_score = (
        db.query(func.avg(CVSession.match_score))
        .filter(CVSession.user_id == user_id, CVSession.match_score.isnot(None))
        .scalar()
    )
    interview_count = (
        db.query(func.count(InterviewResult.id))
        .join(CVSession, InterviewResult.session_id == CVSession.id)
        .filter(CVSession.user_id == user_id)
        .scalar() or 0
    )
    job_count = (
        db.query(func.count(JobApplication.id)).filter(JobApplication.user_id == user_id).scalar() or 0
    )
    roadmap_count = (
        db.query(func.count(CareerRoadmap.id)).filter(CareerRoadmap.user_id == user_id).scalar() or 0
    )
    last_session = (
        db.query(CVSession.created_at)
        .filter(CVSession.user_id == user_id)
        .order_by(CVSession.created_at.desc())
        .scalar()
    )

    return {
        "user_id": user_id,
        "email": user.email,
        "username": user.username,
        "tier": user.tier,
        "cv_sessions": cv_count,
        "avg_cv_score": round(float(avg_score), 1) if avg_score else None,
        "interviews": interview_count,
        "job_applications": job_count,
        "roadmaps": roadmap_count,
        "last_active": last_session.isoformat() if last_session else None,
        "joined": user.created_at.isoformat() if user.created_at else None,
    }


# ---------------------------------------------------------------------------
# Content management (Interview Bank)
# ---------------------------------------------------------------------------

@router.get("/content/questions")
def list_questions(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    total = db.query(InterviewQuestion).count()
    questions = (
        db.query(InterviewQuestion)
        .order_by(InterviewQuestion.id.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    return {
        "total": total,
        "questions": [
            {
                "id": q.id,
                "role": q.role,
                "level": q.level,
                "category": q.category,
                "question_text": q.question_text,
            }
            for q in questions
        ],
    }


@router.delete("/content/questions/{question_id}")
def delete_question(
    question_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    q = db.query(InterviewQuestion).filter(InterviewQuestion.id == question_id).first()
    if not q:
        raise HTTPException(status_code=404, detail="Question not found")
    db.delete(q)
    db.commit()
    return {"deleted": question_id}


# ---------------------------------------------------------------------------
# Token management
# ---------------------------------------------------------------------------

@router.get("/tokens/summary")
def token_summary(
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    return token_tracker.get_admin_summary(db)


@router.get("/tokens/users")
def token_user_breakdown(
    for_date: Optional[date] = Query(None),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    return {"users": token_tracker.get_user_breakdown(db, for_date, limit), "date": (for_date or datetime.utcnow().date()).isoformat()}


# ---------------------------------------------------------------------------
# System health
# ---------------------------------------------------------------------------

@router.get("/health")
def system_health(
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    # Postgres
    db_ok = True
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        db_ok = False

    # Redis
    redis_ok = False
    try:
        redis_ok = bool(redis_client.ping())
    except Exception:
        pass

    # ChromaDB
    chroma_ok = False
    try:
        r = httpx.get("http://chromadb:8000/api/v2/heartbeat", timeout=2.0)
        chroma_ok = r.status_code == 200
    except Exception:
        pass

    mem = psutil.virtual_memory()
    cpu = psutil.cpu_percent(interval=None)

    return {
        "uptime_seconds": round(time.time() - _START_TIME),
        "python_version": sys.version,
        "os": platform.system(),
        "services": {
            "postgres": {"ok": db_ok},
            "redis": {"ok": redis_ok},
            "chromadb": {"ok": chroma_ok},
        },
        "cpu_percent": cpu,
        "memory": {
            "total_mb": round(mem.total / 1024 / 1024),
            "used_mb": round(mem.used / 1024 / 1024),
            "percent": mem.percent,
        },
    }
