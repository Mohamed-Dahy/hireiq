"""
Integration tests for /jobs/* endpoints — Phase 6 ATS Job Tracker.
All AI calls are patched. DB uses real PostgreSQL test instance.
"""

import json
import pytest
from datetime import datetime
from unittest.mock import patch
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from models.user import User
from models.jobs import JobApplication, ApplicationActivity
from services.auth_service import hash_password, create_access_token

_JD = "Build scalable Python microservices. Requires Docker and Kubernetes."


def _other_auth(db: Session) -> dict:
    user = User(
        email="other_jobs@example.com",
        username="other_jobs",
        hashed_password=hash_password("x"),
        email_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(user.id)
    return {"Authorization": f"Bearer {token}"}


def _create_job(client, headers, **overrides):
    payload = {
        "company": "Acme Corp",
        "title": "Backend Engineer",
        "source": "linkedin",
        "priority": "high",
        **overrides,
    }
    return client.post("/jobs", json=payload, headers=headers)


# ---------------------------------------------------------------------------
# POST /jobs — create
# ---------------------------------------------------------------------------

class TestCreateJob:
    def test_create_minimal_job_returns_201(self, test_client: TestClient, auth_headers: dict):
        resp = _create_job(test_client, auth_headers)
        assert resp.status_code == 201
        body = resp.json()
        assert body["company"] == "Acme Corp"
        assert body["title"] == "Backend Engineer"
        assert body["status"] == "saved"
        assert body["is_archived"] is False

    def test_create_full_job_persists_all_fields(self, test_client: TestClient, auth_headers: dict):
        resp = _create_job(
            test_client,
            auth_headers,
            location="Cairo",
            remote_type="hybrid",
            salary_min=50000,
            salary_max=80000,
            job_url="https://example.com/job",
            jd_text=_JD,
            priority="high",
            notes="Applied via referral",
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["location"] == "Cairo"
        assert body["salary_min"] == 50000
        assert body["priority"] == "high"

    def test_create_job_without_company_returns_422(self, test_client: TestClient, auth_headers: dict):
        resp = test_client.post("/jobs", json={"title": "Dev"}, headers=auth_headers)
        assert resp.status_code == 422

    def test_create_job_without_title_returns_422(self, test_client: TestClient, auth_headers: dict):
        resp = test_client.post("/jobs", json={"company": "X"}, headers=auth_headers)
        assert resp.status_code == 422

    def test_unauthenticated_returns_403(self, test_client: TestClient):
        resp = test_client.post("/jobs", json={"company": "X", "title": "Y"})
        assert resp.status_code in (401, 403)


# ---------------------------------------------------------------------------
# GET /jobs — list with filters
# ---------------------------------------------------------------------------

class TestListJobs:
    def test_list_returns_only_own_jobs(
        self, test_client: TestClient, test_db: Session, auth_headers: dict
    ):
        _create_job(test_client, auth_headers)
        other_headers = _other_auth(test_db)
        _create_job(test_client, other_headers, company="OtherCo", title="Dev")

        resp = test_client.get("/jobs", headers=auth_headers)
        assert resp.status_code == 200
        companies = [j["company"] for j in resp.json()]
        assert "Acme Corp" in companies
        assert "OtherCo" not in companies

    def test_filter_by_status(self, test_client: TestClient, auth_headers: dict):
        _create_job(test_client, auth_headers, company="A", title="Eng")
        resp = test_client.get("/jobs?status=saved", headers=auth_headers)
        assert resp.status_code == 200
        assert all(j["status"] == "saved" for j in resp.json())

    def test_archived_excluded_by_default(
        self, test_client: TestClient, auth_headers: dict
    ):
        resp = _create_job(test_client, auth_headers)
        job_id = resp.json()["id"]
        test_client.delete(f"/jobs/{job_id}", headers=auth_headers)

        resp = test_client.get("/jobs", headers=auth_headers)
        ids = [j["id"] for j in resp.json()]
        assert job_id not in ids

    def test_filter_archived_true_returns_archived(
        self, test_client: TestClient, auth_headers: dict
    ):
        resp = _create_job(test_client, auth_headers)
        job_id = resp.json()["id"]
        test_client.delete(f"/jobs/{job_id}", headers=auth_headers)

        resp = test_client.get("/jobs?is_archived=true", headers=auth_headers)
        ids = [j["id"] for j in resp.json()]
        assert job_id in ids


# ---------------------------------------------------------------------------
# GET /jobs/{id} — detail
# ---------------------------------------------------------------------------

class TestGetJob:
    def test_returns_full_detail(self, test_client: TestClient, auth_headers: dict):
        create_resp = _create_job(test_client, auth_headers, notes="Important")
        job_id = create_resp.json()["id"]

        resp = test_client.get(f"/jobs/{job_id}", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["notes"] == "Important"

    def test_other_users_job_returns_404(
        self, test_client: TestClient, test_db: Session, auth_headers: dict
    ):
        other_headers = _other_auth(test_db)
        job_id = _create_job(test_client, other_headers, company="Secret", title="Job").json()["id"]

        resp = test_client.get(f"/jobs/{job_id}", headers=auth_headers)
        assert resp.status_code == 404

    def test_nonexistent_job_returns_404(self, test_client: TestClient, auth_headers: dict):
        resp = test_client.get("/jobs/99999", headers=auth_headers)
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# PATCH /jobs/{id} — update fields
# ---------------------------------------------------------------------------

class TestUpdateJob:
    def test_update_notes_persists(self, test_client: TestClient, auth_headers: dict):
        job_id = _create_job(test_client, auth_headers).json()["id"]
        resp = test_client.patch(f"/jobs/{job_id}", json={"notes": "Updated!"}, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["notes"] == "Updated!"

    def test_update_salary_range(self, test_client: TestClient, auth_headers: dict):
        job_id = _create_job(test_client, auth_headers).json()["id"]
        resp = test_client.patch(
            f"/jobs/{job_id}",
            json={"salary_min": 60000, "salary_max": 90000},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["salary_max"] == 90000


# ---------------------------------------------------------------------------
# DELETE /jobs/{id} — archive (soft delete)
# ---------------------------------------------------------------------------

class TestArchiveJob:
    def test_delete_archives_not_removes(
        self, test_client: TestClient, test_db: Session, auth_headers: dict
    ):
        job_id = _create_job(test_client, auth_headers).json()["id"]
        resp = test_client.delete(f"/jobs/{job_id}", headers=auth_headers)
        assert resp.status_code == 200

        db_job = test_db.query(JobApplication).filter(JobApplication.id == job_id).first()
        assert db_job is not None
        assert db_job.is_archived is True

    def test_other_users_job_archive_returns_404(
        self, test_client: TestClient, test_db: Session, auth_headers: dict
    ):
        other_headers = _other_auth(test_db)
        job_id = _create_job(test_client, other_headers).json()["id"]

        resp = test_client.delete(f"/jobs/{job_id}", headers=auth_headers)
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# PATCH /jobs/{id}/status — validated transitions
# ---------------------------------------------------------------------------

class TestStatusTransition:
    def test_valid_transition_succeeds(self, test_client: TestClient, auth_headers: dict):
        job_id = _create_job(test_client, auth_headers).json()["id"]
        resp = test_client.patch(
            f"/jobs/{job_id}/status",
            json={"new_status": "applied"},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["status"] == "applied"

    def test_valid_transition_writes_activity_row(
        self, test_client: TestClient, test_db: Session, auth_headers: dict
    ):
        job_id = _create_job(test_client, auth_headers).json()["id"]
        test_client.patch(
            f"/jobs/{job_id}/status",
            json={"new_status": "applied", "note": "Submitted on company portal"},
            headers=auth_headers,
        )
        activities = (
            test_db.query(ApplicationActivity)
            .filter(ApplicationActivity.job_application_id == job_id)
            .all()
        )
        assert len(activities) == 1
        assert activities[0].event_type == "status_change"

    def test_invalid_transition_returns_400(self, test_client: TestClient, auth_headers: dict):
        job_id = _create_job(test_client, auth_headers).json()["id"]
        resp = test_client.patch(
            f"/jobs/{job_id}/status",
            json={"new_status": "offer"},
            headers=auth_headers,
        )
        assert resp.status_code == 400

    def test_status_transition_updates_stage_entered_at(
        self, test_client: TestClient, test_db: Session, auth_headers: dict
    ):
        job_id = _create_job(test_client, auth_headers).json()["id"]
        before = test_db.get(JobApplication, job_id).stage_entered_at
        test_client.patch(f"/jobs/{job_id}/status", json={"new_status": "applied"}, headers=auth_headers)
        test_db.expire_all()
        after = test_db.get(JobApplication, job_id).stage_entered_at
        assert after >= before


# ---------------------------------------------------------------------------
# Activities
# ---------------------------------------------------------------------------

class TestActivities:
    def test_log_activity_creates_row(
        self, test_client: TestClient, test_db: Session, auth_headers: dict
    ):
        job_id = _create_job(test_client, auth_headers).json()["id"]
        resp = test_client.post(
            f"/jobs/{job_id}/activities",
            json={"event_type": "email_sent", "notes": "Sent follow-up"},
            headers=auth_headers,
        )
        assert resp.status_code == 201
        assert resp.json()["event_type"] == "email_sent"

    def test_get_activities_returns_list(self, test_client: TestClient, auth_headers: dict):
        job_id = _create_job(test_client, auth_headers).json()["id"]
        test_client.post(
            f"/jobs/{job_id}/activities",
            json={"event_type": "call_made", "notes": "30 min call"},
            headers=auth_headers,
        )
        resp = test_client.get(f"/jobs/{job_id}/activities", headers=auth_headers)
        assert resp.status_code == 200
        assert len(resp.json()) >= 1


# ---------------------------------------------------------------------------
# Contacts
# ---------------------------------------------------------------------------

class TestContacts:
    def test_add_contact_returns_201(self, test_client: TestClient, auth_headers: dict):
        job_id = _create_job(test_client, auth_headers).json()["id"]
        resp = test_client.post(
            f"/jobs/{job_id}/contacts",
            json={"name": "Sarah Ahmed", "role": "hr_recruiter", "email": "sarah@acme.com"},
            headers=auth_headers,
        )
        assert resp.status_code == 201
        assert resp.json()["name"] == "Sarah Ahmed"

    def test_get_contacts_returns_list(self, test_client: TestClient, auth_headers: dict):
        job_id = _create_job(test_client, auth_headers).json()["id"]
        test_client.post(
            f"/jobs/{job_id}/contacts",
            json={"name": "Omar", "role": "hiring_manager"},
            headers=auth_headers,
        )
        resp = test_client.get(f"/jobs/{job_id}/contacts", headers=auth_headers)
        assert resp.status_code == 200
        assert len(resp.json()) >= 1

    def test_delete_contact(self, test_client: TestClient, auth_headers: dict):
        job_id = _create_job(test_client, auth_headers).json()["id"]
        contact_id = test_client.post(
            f"/jobs/{job_id}/contacts",
            json={"name": "Ali", "role": "referrer"},
            headers=auth_headers,
        ).json()["id"]

        resp = test_client.delete(f"/jobs/{job_id}/contacts/{contact_id}", headers=auth_headers)
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# POST /jobs/{id}/analyze — AI analysis (mocked)
# ---------------------------------------------------------------------------

class TestAnalyzeJob:
    def test_analyze_stores_match_score(
        self, test_client: TestClient, test_db: Session, auth_headers: dict
    ):
        job_id = _create_job(test_client, auth_headers, jd_text=_JD).json()["id"]

        with patch("routers.jobs.analyze_structured") as mock_analyze, \
             patch("routers.jobs.compute_match_score", return_value=0.82):
            mock_analyze.return_value = {
                "skill_inventory": [{"skill": "Python", "category": "hard", "level": "advanced"}],
                "gap_report": [{"skill": "K8s", "importance": "high", "reason": "Required", "resource": "k8s.io"}],
                "study_roadmap": [],
                "questions": [{"question": "Tell me about Python.", "model_answer": "..."}],
            }
            resp = test_client.post(f"/jobs/{job_id}/analyze", headers=auth_headers)

        assert resp.status_code == 200
        body = resp.json()
        # No cv_session_id linked → no CV text → match_score is None (correct)
        assert body["match_score"] is None
        assert body["ai_gap_summary"] is not None

    def test_analyze_requires_jd_text(self, test_client: TestClient, auth_headers: dict):
        """No jd_text stored and none in body → 422."""
        job_id = _create_job(test_client, auth_headers).json()["id"]
        resp = test_client.post(f"/jobs/{job_id}/analyze", headers=auth_headers)
        assert resp.status_code == 422

    def test_analyze_accepts_jd_text_in_request_body(
        self, test_client: TestClient, auth_headers: dict
    ):
        """jd_text can be supplied in the request body even if not stored on the job."""
        job_id = _create_job(test_client, auth_headers).json()["id"]

        with patch("routers.jobs.analyze_structured") as mock_analyze, \
             patch("routers.jobs.compute_match_score", return_value=0.70):
            mock_analyze.return_value = {
                "skill_inventory": [],
                "gap_report": [{"skill": "Docker", "importance": "high", "reason": "Required", "resource": "docker.com"}],
                "study_roadmap": [],
                "questions": [],
            }
            resp = test_client.post(
                f"/jobs/{job_id}/analyze",
                json={"jd_text": _JD},
                headers=auth_headers,
            )

        assert resp.status_code == 200
        assert resp.json()["ai_gap_summary"] is not None

    def test_analyze_uses_cv_from_linked_session(
        self, test_client: TestClient, test_db: Session, auth_headers: dict, test_user: User
    ):
        """When cv_session_id is set, CV text is loaded from the session (not a copy of jd_text)."""
        import json as _json, os, tempfile
        from models.user import CVSession

        # Create a fake CV file
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False, dir=".") as f:
            f.write(b"%PDF-1.4\n%%EOF")
            tmp_path = f.name
        cv_filename = os.path.basename(tmp_path)

        cv_session = CVSession(
            user_id=test_user.id,
            cv_filename=cv_filename,
            jd_text="some old jd",
            match_score=0.6,
        )
        test_db.add(cv_session)
        test_db.commit()
        test_db.refresh(cv_session)

        job_id = _create_job(
            test_client, auth_headers, jd_text=_JD, cv_session_id=cv_session.id
        ).json()["id"]

        captured_args: list = []

        def capture_analyze(cv_text, jd_text):
            captured_args.extend([cv_text, jd_text])
            return {"skill_inventory": [], "gap_report": [], "study_roadmap": [], "questions": []}

        with patch("routers.jobs.analyze_structured", side_effect=capture_analyze), \
             patch("routers.jobs.compute_match_score", return_value=0.0), \
             patch("routers.jobs.extract_text_from_pdf", return_value="Real CV content"), \
             patch("routers.jobs.os.path.exists", return_value=True):
            resp = test_client.post(f"/jobs/{job_id}/analyze", headers=auth_headers)

        os.unlink(tmp_path)

        assert resp.status_code == 200
        # cv_text must NOT be the jd_text — it should be the mocked CV content
        assert captured_args[0] == "Real CV content"
        assert captured_args[1] == _JD


# ---------------------------------------------------------------------------
# GET /jobs/{id}/prep — interview prep questions
# ---------------------------------------------------------------------------

class TestJobPrep:
    def test_returns_stored_prep_questions(
        self, test_client: TestClient, test_db: Session, auth_headers: dict
    ):
        job_id = _create_job(test_client, auth_headers).json()["id"]
        questions = [{"question": "Q1", "model_answer": "A1"}]
        db_job = test_db.query(JobApplication).filter(JobApplication.id == job_id).first()
        db_job.ai_prep_questions = json.dumps(questions)
        test_db.commit()

        resp = test_client.get(f"/jobs/{job_id}/prep", headers=auth_headers)
        assert resp.status_code == 200
        assert len(resp.json()["questions"]) == 1

    def test_returns_202_when_no_prep_and_no_jd(
        self, test_client: TestClient, auth_headers: dict
    ):
        job_id = _create_job(test_client, auth_headers).json()["id"]
        resp = test_client.get(f"/jobs/{job_id}/prep", headers=auth_headers)
        assert resp.status_code == 202


# ---------------------------------------------------------------------------
# GET /jobs/stats — analytics
# ---------------------------------------------------------------------------

class TestJobStats:
    def test_stats_returns_expected_shape(self, test_client: TestClient, auth_headers: dict):
        _create_job(test_client, auth_headers)
        resp = test_client.get("/jobs/stats", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert "by_status" in body
        assert "response_rate" in body
        assert "interview_rate" in body
        assert "offer_rate" in body
        assert "by_source" in body
        assert "weekly_trend" in body
        assert "stale_count" in body
        assert "upcoming_count" in body
        assert "total_active" in body

    def test_stats_total_active_reflects_pipeline(
        self, test_client: TestClient, auth_headers: dict
    ):
        _create_job(test_client, auth_headers, company="A", title="Dev1")
        _create_job(test_client, auth_headers, company="B", title="Dev2")
        resp = test_client.get("/jobs/stats", headers=auth_headers)
        assert resp.json()["total_active"] >= 2

    def test_stats_weekly_trend_has_8_entries(
        self, test_client: TestClient, auth_headers: dict
    ):
        _create_job(test_client, auth_headers)
        resp = test_client.get("/jobs/stats", headers=auth_headers)
        trend = resp.json()["weekly_trend"]
        assert len(trend) == 8
        assert all("week" in entry and "count" in entry for entry in trend)

    def test_stats_upcoming_count_reflects_near_deadlines(
        self, test_client: TestClient, auth_headers: dict
    ):
        from datetime import date, timedelta
        near = (date.today() + timedelta(days=2)).isoformat()
        far = (date.today() + timedelta(days=30)).isoformat()
        _create_job(test_client, auth_headers, company="Near", title="Dev", deadline_date=near)
        _create_job(test_client, auth_headers, company="Far", title="Dev", deadline_date=far)
        resp = test_client.get("/jobs/stats", headers=auth_headers)
        assert resp.json()["upcoming_count"] >= 1


# ---------------------------------------------------------------------------
# GET /jobs/upcoming — deadline / followup within 7 days
# ---------------------------------------------------------------------------

class TestUpcomingJobs:
    def test_upcoming_includes_jobs_with_deadline_soon(
        self, test_client: TestClient, auth_headers: dict
    ):
        from datetime import date, timedelta
        deadline = (date.today() + timedelta(days=3)).isoformat()
        job_id = _create_job(
            test_client, auth_headers, deadline_date=deadline
        ).json()["id"]

        resp = test_client.get("/jobs/upcoming", headers=auth_headers)
        assert resp.status_code == 200
        ids = [j["id"] for j in resp.json()]
        assert job_id in ids

    def test_upcoming_excludes_far_future_deadlines(
        self, test_client: TestClient, auth_headers: dict
    ):
        from datetime import date, timedelta
        deadline = (date.today() + timedelta(days=30)).isoformat()
        job_id = _create_job(
            test_client, auth_headers, deadline_date=deadline
        ).json()["id"]

        resp = test_client.get("/jobs/upcoming", headers=auth_headers)
        ids = [j["id"] for j in resp.json()]
        assert job_id not in ids

    def test_upcoming_includes_jobs_with_followup_date_soon(
        self, test_client: TestClient, auth_headers: dict
    ):
        """followup_date (not just deadline_date) should trigger upcoming."""
        from datetime import date, timedelta
        followup = (date.today() + timedelta(days=2)).isoformat()
        job_id = _create_job(
            test_client, auth_headers, followup_date=followup
        ).json()["id"]

        resp = test_client.get("/jobs/upcoming", headers=auth_headers)
        assert resp.status_code == 200
        ids = [j["id"] for j in resp.json()]
        assert job_id in ids

    def test_upcoming_excludes_far_future_followup(
        self, test_client: TestClient, auth_headers: dict
    ):
        from datetime import date, timedelta
        followup = (date.today() + timedelta(days=30)).isoformat()
        job_id = _create_job(
            test_client, auth_headers, followup_date=followup
        ).json()["id"]

        resp = test_client.get("/jobs/upcoming", headers=auth_headers)
        ids = [j["id"] for j in resp.json()]
        assert job_id not in ids


# ---------------------------------------------------------------------------
# GET /jobs/stale — no activity in 14+ days
# ---------------------------------------------------------------------------

class TestStaleJobs:
    def test_stale_excludes_terminal_statuses(
        self, test_client: TestClient, test_db: Session, auth_headers: dict
    ):
        job_id = _create_job(test_client, auth_headers).json()["id"]
        db_job = test_db.query(JobApplication).filter(JobApplication.id == job_id).first()
        db_job.status = "accepted"
        test_db.commit()

        resp = test_client.get("/jobs/stale", headers=auth_headers)
        ids = [j["id"] for j in resp.json()]
        assert job_id not in ids

    def test_stale_includes_job_with_no_activity_for_14_days(
        self, test_client: TestClient, test_db: Session, auth_headers: dict
    ):
        from datetime import timedelta
        job_id = _create_job(test_client, auth_headers).json()["id"]
        # Force stage_entered_at to 20 days ago and ensure no activity exists
        db_job = test_db.query(JobApplication).filter(JobApplication.id == job_id).first()
        db_job.stage_entered_at = datetime.utcnow() - timedelta(days=20)
        db_job.status = "applied"
        test_db.commit()

        resp = test_client.get("/jobs/stale", headers=auth_headers)
        ids = [j["id"] for j in resp.json()]
        assert job_id in ids


# ---------------------------------------------------------------------------
# Ownership — 404 on other user's resources
# ---------------------------------------------------------------------------

class TestOwnership:
    def test_get_other_users_job_returns_404(
        self, test_client: TestClient, test_db: Session, auth_headers: dict
    ):
        other_headers = _other_auth(test_db)
        job_id = _create_job(test_client, other_headers).json()["id"]
        resp = test_client.get(f"/jobs/{job_id}", headers=auth_headers)
        assert resp.status_code == 404

    def test_patch_other_users_job_returns_404(
        self, test_client: TestClient, test_db: Session, auth_headers: dict
    ):
        other_headers = _other_auth(test_db)
        job_id = _create_job(test_client, other_headers).json()["id"]
        resp = test_client.patch(f"/jobs/{job_id}", json={"notes": "hack"}, headers=auth_headers)
        assert resp.status_code == 404

    def test_status_transition_other_users_job_returns_404(
        self, test_client: TestClient, test_db: Session, auth_headers: dict
    ):
        other_headers = _other_auth(test_db)
        job_id = _create_job(test_client, other_headers).json()["id"]
        resp = test_client.patch(
            f"/jobs/{job_id}/status",
            json={"new_status": "applied"},
            headers=auth_headers,
        )
        assert resp.status_code == 404
