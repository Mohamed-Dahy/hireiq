from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from sqlalchemy import func, case

from models.user import User, CVSession, InterviewResult
from models.jobs import JobApplication
from models.referral import ReferralConversion
from models.roadmap import CareerRoadmap
from models.content import InterviewQuestion


def get_platform_metrics(db: Session) -> dict:
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)

    total_users = db.query(func.count(User.id)).scalar() or 0
    new_users_week = db.query(func.count(User.id)).filter(User.created_at >= week_ago).scalar() or 0
    new_users_month = db.query(func.count(User.id)).filter(User.created_at >= month_ago).scalar() or 0

    free_count = db.query(func.count(User.id)).filter(User.tier == "free").scalar() or 0
    paid_count = db.query(func.count(User.id)).filter(User.tier != "free").scalar() or 0
    admin_count = db.query(func.count(User.id)).filter(User.is_admin == True).scalar() or 0

    total_sessions = db.query(func.count(CVSession.id)).scalar() or 0
    sessions_week = db.query(func.count(CVSession.id)).filter(CVSession.created_at >= week_ago).scalar() or 0
    avg_score = db.query(func.avg(CVSession.match_score)).filter(CVSession.match_score.isnot(None)).scalar()

    total_interviews = db.query(func.count(InterviewResult.id)).scalar() or 0

    total_jobs = db.query(func.count(JobApplication.id)).scalar() or 0
    active_jobs = db.query(func.count(JobApplication.id)).filter(
        JobApplication.status.notin_(["rejected", "withdrawn", "accepted"])
    ).scalar() or 0

    total_roadmaps = db.query(func.count(CareerRoadmap.id)).scalar() or 0
    roadmaps_week = db.query(func.count(CareerRoadmap.id)).filter(CareerRoadmap.created_at >= week_ago).scalar() or 0

    total_referrals = db.query(func.count(ReferralConversion.id)).scalar() or 0
    converted_referrals = db.query(func.count(ReferralConversion.id)).filter(
        ReferralConversion.converted_at.isnot(None)
    ).scalar() or 0

    total_questions = db.query(func.count(InterviewQuestion.id)).scalar() or 0

    job_status_dist = dict(
        db.query(JobApplication.status, func.count(JobApplication.id))
        .group_by(JobApplication.status)
        .all()
    )

    tier_distribution = [
        {"tier": "free", "count": free_count},
        {"tier": "paid", "count": paid_count},
    ]

    signups_by_day = (
        db.query(
            func.date_trunc("day", User.created_at).label("day"),
            func.count(User.id).label("count"),
        )
        .filter(User.created_at >= month_ago)
        .group_by("day")
        .order_by("day")
        .all()
    )
    signup_trend = [{"date": str(row.day.date()), "count": row.count} for row in signups_by_day]

    sessions_by_day = (
        db.query(
            func.date_trunc("day", CVSession.created_at).label("day"),
            func.count(CVSession.id).label("count"),
        )
        .filter(CVSession.created_at >= month_ago)
        .group_by("day")
        .order_by("day")
        .all()
    )
    session_trend = [{"date": str(row.day.date()), "count": row.count} for row in sessions_by_day]

    return {
        "users": {
            "total": total_users,
            "new_this_week": new_users_week,
            "new_this_month": new_users_month,
            "free": free_count,
            "paid": paid_count,
            "admins": admin_count,
            "tier_distribution": tier_distribution,
            "signup_trend": signup_trend,
        },
        "cv_sessions": {
            "total": total_sessions,
            "this_week": sessions_week,
            "avg_match_score": round(float(avg_score), 1) if avg_score else None,
            "trend": session_trend,
        },
        "interviews": {
            "total": total_interviews,
        },
        "jobs": {
            "total": total_jobs,
            "active": active_jobs,
            "by_status": job_status_dist,
        },
        "roadmaps": {
            "total": total_roadmaps,
            "this_week": roadmaps_week,
        },
        "referrals": {
            "total": total_referrals,
            "converted": converted_referrals,
            "conversion_rate": round(converted_referrals / total_referrals * 100, 1) if total_referrals else 0,
        },
        "interview_bank": {
            "total_questions": total_questions,
        },
    }


def get_all_users(db: Session, skip: int = 0, limit: int = 50) -> list:
    users = (
        db.query(User)
        .order_by(User.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    result = []
    for u in users:
        session_count = db.query(func.count(CVSession.id)).filter(CVSession.user_id == u.id).scalar() or 0
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
    return result
