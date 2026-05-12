"""
Integration tests for /cv/* endpoints — Phase 5 additions.
Tests for GET /cv/{id}/analysis and LinkedIn detection in upload.
All AI heavy-lifters are patched out.
"""

import io
import json
import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from models.user import CVSession, User
from services.auth_service import hash_password

_PDF_STUB = b"%PDF-1.4\n%%EOF"
_JD = "software engineer"

STRUCTURED_DATA = {
    "skill_inventory": [{"skill": "Python", "category": "hard", "level": "advanced"}],
    "gap_report": [
        {"skill": "Kubernetes", "importance": "high", "reason": "Required", "resource": "k8s.io"}
    ],
    "study_roadmap": [
        {"topic": "Containers", "priority": "high", "estimated_hours": 20, "resources": []}
    ],
    "questions": [{"question": "Tell me about yourself.", "model_answer": "I am..."}],
}


def _make_session(db: Session, user: User, **kwargs) -> CVSession:
    s = CVSession(
        user_id=user.id,
        cv_filename="test.pdf",
        jd_text=_JD,
        match_score=0.72,
        **kwargs,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


# ---------------------------------------------------------------------------
# GET /cv/{id}/analysis
# ---------------------------------------------------------------------------

class TestGetAnalysis:
    def test_returns_202_when_no_structured_data(
        self, test_client: TestClient, test_db: Session, test_user: User, auth_headers: dict
    ):
        session = _make_session(test_db, test_user)
        resp = test_client.get(f"/cv/{session.id}/analysis", headers=auth_headers)
        assert resp.status_code == 202
        assert resp.json()["status"] == "pending"

    def test_returns_200_with_skill_inventory(
        self, test_client: TestClient, test_db: Session, test_user: User, auth_headers: dict
    ):
        session = _make_session(
            test_db,
            test_user,
            skill_inventory=json.dumps(STRUCTURED_DATA["skill_inventory"]),
            gap_report=json.dumps(STRUCTURED_DATA["gap_report"]),
            study_roadmap=json.dumps(STRUCTURED_DATA["study_roadmap"]),
        )
        resp = test_client.get(f"/cv/{session.id}/analysis", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert "skill_inventory" in body
        assert body["skill_inventory"][0]["skill"] == "Python"

    def test_returns_200_with_gap_report(
        self, test_client: TestClient, test_db: Session, test_user: User, auth_headers: dict
    ):
        session = _make_session(
            test_db,
            test_user,
            skill_inventory=json.dumps(STRUCTURED_DATA["skill_inventory"]),
            gap_report=json.dumps(STRUCTURED_DATA["gap_report"]),
            study_roadmap=json.dumps(STRUCTURED_DATA["study_roadmap"]),
        )
        resp = test_client.get(f"/cv/{session.id}/analysis", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body["gap_report"][0]["skill"] == "Kubernetes"
        assert body["gap_report"][0]["importance"] == "high"

    def test_returns_200_with_study_roadmap(
        self, test_client: TestClient, test_db: Session, test_user: User, auth_headers: dict
    ):
        session = _make_session(
            test_db,
            test_user,
            skill_inventory=json.dumps(STRUCTURED_DATA["skill_inventory"]),
            gap_report=json.dumps(STRUCTURED_DATA["gap_report"]),
            study_roadmap=json.dumps(STRUCTURED_DATA["study_roadmap"]),
        )
        resp = test_client.get(f"/cv/{session.id}/analysis", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body["study_roadmap"][0]["topic"] == "Containers"
        assert body["study_roadmap"][0]["estimated_hours"] == 20

    def test_returns_404_for_unknown_session(
        self, test_client: TestClient, auth_headers: dict
    ):
        resp = test_client.get("/cv/99999/analysis", headers=auth_headers)
        assert resp.status_code == 404

    def test_returns_404_for_other_users_session(
        self, test_client: TestClient, test_db: Session, auth_headers: dict
    ):
        other = User(
            email="other_analysis@example.com",
            username="other_analysis_user",
            hashed_password=hash_password("OtherPass1!"),
            email_verified=True,
        )
        test_db.add(other)
        test_db.commit()
        test_db.refresh(other)

        session = _make_session(test_db, other)
        resp = test_client.get(f"/cv/{session.id}/analysis", headers=auth_headers)
        assert resp.status_code == 404

    def test_unauthenticated_returns_403(
        self, test_client: TestClient, test_db: Session, test_user: User
    ):
        session = _make_session(test_db, test_user)
        # Remove auth header — test_client has X-Requested-With but no Bearer
        resp = test_client.get(f"/cv/{session.id}/analysis")
        assert resp.status_code in (401, 403)


# ---------------------------------------------------------------------------
# POST /cv/upload — LinkedIn detection
# ---------------------------------------------------------------------------

_UPLOAD_PATCHES = [
    patch("routers.cv.compute_match_score", return_value=0.75),
    patch("routers.cv.store_embeddings"),
    patch("routers.cv.set_cached_score"),
    patch("routers.cv.parse_cv", return_value={"raw_text": "John Doe Python developer", "skills": ["Python"]}),
]


class TestUploadLinkedInDetection:
    def test_linkedin_upload_returns_is_linkedin_true(
        self, test_client: TestClient, auth_headers: dict
    ):
        with patch("routers.cv.compute_match_score", return_value=0.75), \
             patch("routers.cv.store_embeddings"), \
             patch("routers.cv.set_cached_score"), \
             patch("routers.cv.parse_cv", return_value={"raw_text": "John", "skills": []}), \
             patch("routers.cv.is_linkedin_pdf", return_value=True):

            resp = test_client.post(
                "/cv/upload",
                files={"cv_file": ("cv.pdf", io.BytesIO(_PDF_STUB), "application/pdf")},
                data={"jd_text": _JD},
                headers=auth_headers,
            )

        assert resp.status_code == 200
        assert resp.json()["is_linkedin"] is True

    def test_regular_upload_returns_is_linkedin_false(
        self, test_client: TestClient, auth_headers: dict
    ):
        with patch("routers.cv.compute_match_score", return_value=0.75), \
             patch("routers.cv.store_embeddings"), \
             patch("routers.cv.set_cached_score"), \
             patch("routers.cv.parse_cv", return_value={"raw_text": "John", "skills": []}), \
             patch("routers.cv.is_linkedin_pdf", return_value=False):

            resp = test_client.post(
                "/cv/upload",
                files={"cv_file": ("cv.pdf", io.BytesIO(_PDF_STUB), "application/pdf")},
                data={"jd_text": _JD},
                headers=auth_headers,
            )

        assert resp.status_code == 200
        assert resp.json()["is_linkedin"] is False

    def test_linkedin_flag_persisted_in_db(
        self, test_client: TestClient, test_db: Session, auth_headers: dict
    ):
        with patch("routers.cv.compute_match_score", return_value=0.75), \
             patch("routers.cv.store_embeddings"), \
             patch("routers.cv.set_cached_score"), \
             patch("routers.cv.parse_cv", return_value={"raw_text": "John", "skills": []}), \
             patch("routers.cv.is_linkedin_pdf", return_value=True):

            resp = test_client.post(
                "/cv/upload",
                files={"cv_file": ("cv.pdf", io.BytesIO(_PDF_STUB), "application/pdf")},
                data={"jd_text": _JD},
                headers=auth_headers,
            )

        session_id = resp.json()["session_id"]
        db_session = test_db.query(CVSession).filter(CVSession.id == session_id).first()
        assert db_session is not None
        assert db_session.is_linkedin is True
