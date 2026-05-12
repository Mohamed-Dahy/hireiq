"""
Business logic for the ATS job tracker.
"""
from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session

from models.jobs import ApplicationActivity, JobApplication

TERMINAL_STATUSES: frozenset[str] = frozenset({"accepted", "rejected", "withdrawn"})

VALID_TRANSITIONS: dict[str, list[str]] = {
    "saved":        ["applied", "withdrawn"],
    "applied":      ["phone_screen", "technical", "final_round", "offer", "rejected", "withdrawn"],
    "phone_screen": ["technical", "final_round", "offer", "rejected", "withdrawn"],
    "technical":    ["final_round", "offer", "rejected", "withdrawn"],
    "final_round":  ["offer", "rejected", "withdrawn"],
    "offer":        ["accepted", "rejected", "withdrawn"],
    "accepted":     [],
    "rejected":     [],
    "withdrawn":    [],
}

_STALE_DAYS = 14


def validate_status_transition(current: str, new: str) -> None:
    """Raise HTTPException(400) if the transition is not permitted."""
    if current not in VALID_TRANSITIONS:
        raise HTTPException(status_code=400, detail=f"Unknown status: {current}")
    if new not in VALID_TRANSITIONS.get(current, []):
        raise HTTPException(
            status_code=400,
            detail=f"Transition '{current}' → '{new}' is not allowed.",
        )


def is_stale(db: Session, job: JobApplication) -> bool:
    """Return True if the job has had no activity for _STALE_DAYS and is not terminal."""
    if job.status in TERMINAL_STATUSES:
        return False

    cutoff = date.today() - timedelta(days=_STALE_DAYS)
    recent = (
        db.query(ApplicationActivity)
        .filter(
            ApplicationActivity.job_application_id == job.id,
            ApplicationActivity.event_date >= cutoff,
        )
        .first()
    )
    return recent is None


def compute_job_stats(db: Session, user_id: int) -> dict[str, Any]:
    """Return funnel analytics for the given user."""
    jobs = (
        db.query(JobApplication)
        .filter(JobApplication.user_id == user_id, JobApplication.is_archived.is_(False))
        .all()
    )

    by_status: dict[str, int] = {}
    by_source: dict[str, int] = {}
    stale_count = 0
    upcoming_count = 0
    horizon = date.today() + timedelta(days=7)
    today = date.today()

    for job in jobs:
        by_status[job.status] = by_status.get(job.status, 0) + 1
        src = job.source or "unknown"
        by_source[src] = by_source.get(src, 0) + 1
        if is_stale(db, job):
            stale_count += 1
        if job.status not in TERMINAL_STATUSES:
            has_upcoming_deadline = (
                job.deadline_date is not None
                and today <= job.deadline_date <= horizon
            )
            has_upcoming_followup = (
                job.followup_date is not None
                and today <= job.followup_date <= horizon
            )
            if has_upcoming_deadline or has_upcoming_followup:
                upcoming_count += 1

    total_active = len(jobs)
    applied_count = sum(
        v for k, v in by_status.items()
        if k not in ("saved", *TERMINAL_STATUSES)
    )
    phone_plus = sum(
        v for k, v in by_status.items()
        if k in ("phone_screen", "technical", "final_round", "offer", "accepted")
    )
    offers = by_status.get("offer", 0) + by_status.get("accepted", 0)

    total_applied = sum(
        v for k, v in by_status.items() if k != "saved"
    )
    response_rate = round(applied_count / total_applied, 3) if total_applied else 0.0
    interview_rate = round(phone_plus / total_applied, 3) if total_applied else 0.0
    offer_rate = round(offers / total_applied, 3) if total_applied else 0.0

    # Weekly trend — jobs added to the tracker in each of the last 8 ISO weeks
    week_counts: dict[str, int] = {}
    for i in range(7, -1, -1):
        week_label = (today - timedelta(weeks=i)).strftime("%G-W%V")
        week_counts.setdefault(week_label, 0)
    for job in jobs:
        week_label = job.created_at.strftime("%G-W%V")
        if week_label in week_counts:
            week_counts[week_label] += 1
    weekly_trend = [{"week": w, "count": c} for w, c in sorted(week_counts.items())]

    return {
        "total_active": total_active,
        "by_status": by_status,
        "by_source": by_source,
        "response_rate": response_rate,
        "interview_rate": interview_rate,
        "offer_rate": offer_rate,
        "stale_count": stale_count,
        "upcoming_count": upcoming_count,
        "weekly_trend": weekly_trend,
    }
