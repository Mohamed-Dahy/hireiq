"""
Unit tests for services/job_service.py
---------------------------------------
Tests status transition validation, stale detection, and stats aggregation.
No HTTP requests — pure service-layer logic.
"""

from datetime import date, datetime, timedelta

import pytest
from fastapi import HTTPException
from sqlalchemy.orm import Session

from services.job_service import (
    VALID_TRANSITIONS,
    validate_status_transition,
    is_stale,
    TERMINAL_STATUSES,
)


# ---------------------------------------------------------------------------
# Status transition validation
# ---------------------------------------------------------------------------

class TestValidateStatusTransition:
    def test_saved_to_applied_is_valid(self):
        validate_status_transition("saved", "applied")  # no exception

    def test_saved_to_withdrawn_is_valid(self):
        validate_status_transition("saved", "withdrawn")

    def test_applied_to_phone_screen_is_valid(self):
        validate_status_transition("applied", "phone_screen")

    def test_applied_to_rejected_is_valid(self):
        validate_status_transition("applied", "rejected")

    def test_technical_to_final_round_is_valid(self):
        validate_status_transition("technical", "final_round")

    def test_offer_to_accepted_is_valid(self):
        validate_status_transition("offer", "accepted")

    def test_offer_to_rejected_is_valid(self):
        validate_status_transition("offer", "rejected")

    def test_saved_to_offer_is_invalid(self):
        with pytest.raises(HTTPException) as exc:
            validate_status_transition("saved", "offer")
        assert exc.value.status_code == 400

    def test_applied_to_accepted_is_invalid(self):
        with pytest.raises(HTTPException) as exc:
            validate_status_transition("applied", "accepted")
        assert exc.value.status_code == 400

    def test_accepted_is_terminal_no_transitions(self):
        with pytest.raises(HTTPException) as exc:
            validate_status_transition("accepted", "applied")
        assert exc.value.status_code == 400

    def test_rejected_is_terminal_no_transitions(self):
        with pytest.raises(HTTPException) as exc:
            validate_status_transition("rejected", "phone_screen")
        assert exc.value.status_code == 400

    def test_withdrawn_is_terminal_no_transitions(self):
        with pytest.raises(HTTPException) as exc:
            validate_status_transition("withdrawn", "applied")
        assert exc.value.status_code == 400

    def test_same_status_is_invalid(self):
        with pytest.raises(HTTPException) as exc:
            validate_status_transition("applied", "applied")
        assert exc.value.status_code == 400

    def test_unknown_status_is_invalid(self):
        with pytest.raises(HTTPException) as exc:
            validate_status_transition("ghost", "applied")
        assert exc.value.status_code == 400

    def test_all_terminal_statuses_defined(self):
        for status in TERMINAL_STATUSES:
            assert status not in VALID_TRANSITIONS or VALID_TRANSITIONS[status] == []


# ---------------------------------------------------------------------------
# Stale detection
# ---------------------------------------------------------------------------

class TestIsStale:
    def test_job_with_recent_activity_is_not_stale(self, test_db: Session):
        from models.jobs import JobApplication, ApplicationActivity
        from models.user import User
        from services.auth_service import hash_password

        user = User(
            email="stale_test@example.com",
            username="stale_test",
            hashed_password=hash_password("x"),
            email_verified=True,
        )
        test_db.add(user)
        test_db.commit()

        job = JobApplication(
            user_id=user.id,
            company="Acme",
            title="Engineer",
            status="applied",
            stage_entered_at=datetime.utcnow() - timedelta(days=20),
        )
        test_db.add(job)
        test_db.commit()

        # Recent activity
        activity = ApplicationActivity(
            job_application_id=job.id,
            user_id=user.id,
            event_type="email_sent",
            event_date=date.today() - timedelta(days=3),
        )
        test_db.add(activity)
        test_db.commit()

        assert is_stale(test_db, job) is False

    def test_job_with_no_activity_for_14_days_is_stale(self, test_db: Session):
        from models.jobs import JobApplication, ApplicationActivity
        from models.user import User
        from services.auth_service import hash_password

        user = User(
            email="stale_test2@example.com",
            username="stale_test2",
            hashed_password=hash_password("x"),
            email_verified=True,
        )
        test_db.add(user)
        test_db.commit()

        job = JobApplication(
            user_id=user.id,
            company="Corp",
            title="Dev",
            status="applied",
            stage_entered_at=datetime.utcnow() - timedelta(days=30),
        )
        test_db.add(job)
        test_db.commit()

        # Old activity only
        activity = ApplicationActivity(
            job_application_id=job.id,
            user_id=user.id,
            event_type="email_sent",
            event_date=date.today() - timedelta(days=20),
        )
        test_db.add(activity)
        test_db.commit()

        assert is_stale(test_db, job) is True

    def test_job_with_no_activity_at_all_is_stale(self, test_db: Session):
        from models.jobs import JobApplication
        from models.user import User
        from services.auth_service import hash_password

        user = User(
            email="stale_test3@example.com",
            username="stale_test3",
            hashed_password=hash_password("x"),
            email_verified=True,
        )
        test_db.add(user)
        test_db.commit()

        job = JobApplication(
            user_id=user.id,
            company="Startup",
            title="Lead",
            status="applied",
            stage_entered_at=datetime.utcnow() - timedelta(days=20),
        )
        test_db.add(job)
        test_db.commit()

        assert is_stale(test_db, job) is True

    def test_terminal_status_is_never_stale(self, test_db: Session):
        from models.jobs import JobApplication
        from models.user import User
        from services.auth_service import hash_password

        user = User(
            email="stale_test4@example.com",
            username="stale_test4",
            hashed_password=hash_password("x"),
            email_verified=True,
        )
        test_db.add(user)
        test_db.commit()

        for status in ("accepted", "rejected", "withdrawn"):
            job = JobApplication(
                user_id=user.id,
                company="Fin",
                title="Analyst",
                status=status,
                stage_entered_at=datetime.utcnow() - timedelta(days=60),
            )
            test_db.add(job)
            test_db.commit()
            assert is_stale(test_db, job) is False
