"""
Integration tests for the ATS Score Checker (Spec 003, US1).

Covers: CV-only ATS upload, GET /cv/{id}/ats (200/202/403/404), the free-tier
quota boundary (R5: blocked/invalid attempts consume no slot), and the
DELETE-removes-file leakage fix.

Heavy CV parsing is patched (parse_cv / extract_layout_signals) so the
deterministic engine runs on controlled text without needing a real PDF.
"""

import os
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.config import settings
from models.user import CVSession, User
from services.auth_service import create_access_token, hash_password
from tests.fixtures.sample_cvs import CLEAN_CV_TEXT, make_signals

_PDF = b"%PDF-1.4\n%%EOF"
_PARSED = {"raw_text": CLEAN_CV_TEXT, "skills": ["Python", "Docker"], "orgs": [], "dates": []}


def _files():
    return {"cv_file": ("cv.pdf", _PDF, "application/pdf")}


@pytest.fixture()
def patched_parse():
    with patch("routers.cv.parse_cv", return_value=_PARSED), \
         patch("routers.cv.extract_layout_signals", return_value=make_signals(total_chars=len(CLEAN_CV_TEXT))):
        yield


# ---------------------------------------------------------------------------
# CV-only ATS upload
# ---------------------------------------------------------------------------

class TestAtsUpload:
    def test_ats_check_without_jd_returns_score(self, test_client, test_user, auth_headers, patched_parse):
        resp = test_client.post(
            "/cv/upload", headers=auth_headers,
            files=_files(), data={"analysis_mode": "ats_check"},
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["analysis_mode"] == "ats_check"
        assert body["ats_score"] is not None
        assert 0 <= body["ats_score"] <= 100
        assert body["match_score"] is None          # no JD ⇒ no match score

    def test_job_match_still_requires_jd(self, test_client, auth_headers, patched_parse):
        resp = test_client.post(
            "/cv/upload", headers=auth_headers,
            files=_files(), data={"analysis_mode": "job_match"},
        )
        assert resp.status_code == 422

    def test_invalid_mode_rejected(self, test_client, auth_headers):
        resp = test_client.post(
            "/cv/upload", headers=auth_headers,
            files=_files(), data={"analysis_mode": "bogus"},
        )
        assert resp.status_code == 422


# ---------------------------------------------------------------------------
# GET /cv/{id}/ats
# ---------------------------------------------------------------------------

class TestGetAtsResult:
    def test_returns_result_for_owner(self, test_client, test_user, auth_headers, patched_parse):
        up = test_client.post("/cv/upload", headers=auth_headers, files=_files(), data={"analysis_mode": "ats_check"})
        sid = up.json()["session_id"]

        resp = test_client.get(f"/cv/{sid}/ats", headers=auth_headers)
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["session_id"] == sid
        assert "categories" in body and len(body["categories"]) == 8
        assert "issues" in body
        assert body["keyword_coverage"] is None

    def test_202_when_no_ats_result(self, test_client, test_db, test_user, auth_headers):
        # A job_match session has no ATS result.
        s = CVSession(user_id=test_user.id, cv_filename="x.pdf", jd_text="role", analysis_mode="job_match")
        test_db.add(s); test_db.commit(); test_db.refresh(s)
        resp = test_client.get(f"/cv/{s.id}/ats", headers=auth_headers)
        assert resp.status_code == 202

    def test_404_unknown(self, test_client, auth_headers):
        assert test_client.get("/cv/99999/ats", headers=auth_headers).status_code == 404

    def test_other_user_cannot_access(self, test_client, test_db, test_user, auth_headers, patched_parse):
        # require_ownership returns 404 (not 403) by project convention — it
        # deliberately does not reveal that another user's session exists.
        up = test_client.post("/cv/upload", headers=auth_headers, files=_files(), data={"analysis_mode": "ats_check"})
        sid = up.json()["session_id"]

        other = User(email="other@example.com", username="other",
                     hashed_password=hash_password("TestPass123!"), email_verified=True)
        test_db.add(other); test_db.commit(); test_db.refresh(other)
        other_headers = {"Authorization": f"Bearer {create_access_token(other.id)}"}

        resp = test_client.get(f"/cv/{sid}/ats", headers=other_headers)
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Free-tier quota boundary (R5)
# ---------------------------------------------------------------------------

class TestQuotaBoundary:
    def test_free_user_gets_exactly_limit_then_blocked(self, test_client, test_user, auth_headers, patched_parse):
        limit = settings.free_tier_analysis_limit  # default 2
        for _ in range(limit):
            ok = test_client.post("/cv/upload", headers=auth_headers, files=_files(), data={"analysis_mode": "ats_check"})
            assert ok.status_code == 200, ok.text
        blocked = test_client.post("/cv/upload", headers=auth_headers, files=_files(), data={"analysis_mode": "ats_check"})
        assert blocked.status_code == 429
        assert blocked.json()["detail"]["code"] == "quota_exceeded"

    def test_invalid_attempt_does_not_consume_slot(self, test_client, test_db, test_user, auth_headers, patched_parse):
        limit = settings.free_tier_analysis_limit
        # Use up limit-1 valid checks
        for _ in range(limit - 1):
            assert test_client.post("/cv/upload", headers=auth_headers, files=_files(), data={"analysis_mode": "ats_check"}).status_code == 200
        # An invalid (non-PDF) attempt must NOT create a row / consume the last slot
        bad = test_client.post(
            "/cv/upload", headers=auth_headers,
            files={"cv_file": ("x.txt", b"not a pdf", "text/plain")},
            data={"analysis_mode": "ats_check"},
        )
        assert bad.status_code == 422
        # The remaining valid slot is still available
        ok = test_client.post("/cv/upload", headers=auth_headers, files=_files(), data={"analysis_mode": "ats_check"})
        assert ok.status_code == 200
        # Exactly `limit` sessions exist
        count = test_db.query(CVSession).filter(CVSession.user_id == test_user.id).count()
        assert count == limit


# ---------------------------------------------------------------------------
# DELETE removes the uploaded file (leakage fix)
# ---------------------------------------------------------------------------

class TestDeleteRemovesFile:
    def test_delete_removes_pdf_from_disk(self, test_client, test_user, auth_headers, patched_parse):
        up = test_client.post("/cv/upload", headers=auth_headers, files=_files(), data={"analysis_mode": "ats_check"})
        body = up.json()
        sid, fname = body["session_id"], body["cv_filename"]
        path = os.path.join(settings.upload_dir, fname)
        assert os.path.exists(path)

        resp = test_client.delete(f"/cv/{sid}", headers=auth_headers)
        assert resp.status_code == 204
        assert not os.path.exists(path)
