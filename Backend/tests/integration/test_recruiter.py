"""
Integration tests for /recruiter/* endpoints — Phase 7 Recruiter Dashboard.
All tests use real PostgreSQL test DB. No external services mocked.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from models.user import User, CVSession
from models.jobs import RecruiterList, RecruiterCandidate
from services.auth_service import hash_password, create_access_token


def _other_auth(db: Session) -> dict:
    user = User(
        email="other_recruiter@example.com",
        username="other_recruiter",
        hashed_password=hash_password("x"),
        email_verified=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(user.id)
    return {"Authorization": f"Bearer {token}"}


def _make_cv_session(db: Session, user: User, score: float = 78.5) -> CVSession:
    session = CVSession(
        user_id=user.id,
        cv_filename=f"test_cv_{id(user)}_{score}.pdf",
        jd_text="Senior Python engineer wanted",
        match_score=score,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def _create_list(client, headers, **overrides):
    payload = {"name": "Backend Engineers", "job_title": "Senior Backend Engineer", **overrides}
    return client.post("/recruiter/lists", json=payload, headers=headers)


# ---------------------------------------------------------------------------
# POST /recruiter/lists / GET /recruiter/lists / DELETE /recruiter/lists/{id}
# ---------------------------------------------------------------------------

class TestRecruiterListCRUD:
    def test_create_list_returns_201(self, test_client: TestClient, auth_headers: dict):
        resp = _create_list(test_client, auth_headers)
        assert resp.status_code == 201
        body = resp.json()
        assert body["name"] == "Backend Engineers"
        assert body["job_title"] == "Senior Backend Engineer"
        assert "id" in body
        assert "created_at" in body

    def test_create_list_without_job_title(self, test_client: TestClient, auth_headers: dict):
        resp = test_client.post("/recruiter/lists", json={"name": "Simple List"}, headers=auth_headers)
        assert resp.status_code == 201
        assert resp.json()["job_title"] is None

    def test_create_list_requires_name(self, test_client: TestClient, auth_headers: dict):
        resp = test_client.post("/recruiter/lists", json={"job_title": "Dev"}, headers=auth_headers)
        assert resp.status_code == 422

    def test_list_returns_only_own_lists(
        self, test_client: TestClient, test_db: Session, auth_headers: dict
    ):
        _create_list(test_client, auth_headers, name="My List")
        other_headers = _other_auth(test_db)
        _create_list(test_client, other_headers, name="Other List")

        resp = test_client.get("/recruiter/lists", headers=auth_headers)
        assert resp.status_code == 200
        names = [item["name"] for item in resp.json()]
        assert "My List" in names
        assert "Other List" not in names

    def test_list_includes_candidate_count(
        self, test_client: TestClient, test_db: Session, auth_headers: dict, test_user: User
    ):
        list_id = _create_list(test_client, auth_headers).json()["id"]
        session = _make_cv_session(test_db, test_user)
        test_client.post(
            f"/recruiter/lists/{list_id}/candidates",
            json={"session_id": session.id},
            headers=auth_headers,
        )
        resp = test_client.get("/recruiter/lists", headers=auth_headers)
        found = next(item for item in resp.json() if item["id"] == list_id)
        assert found["candidate_count"] == 1

    def test_delete_list_returns_204(self, test_client: TestClient, auth_headers: dict):
        list_id = _create_list(test_client, auth_headers).json()["id"]
        resp = test_client.delete(f"/recruiter/lists/{list_id}", headers=auth_headers)
        assert resp.status_code == 204

    def test_delete_removes_from_db(
        self, test_client: TestClient, test_db: Session, auth_headers: dict
    ):
        list_id = _create_list(test_client, auth_headers).json()["id"]
        test_client.delete(f"/recruiter/lists/{list_id}", headers=auth_headers)
        assert test_db.get(RecruiterList, list_id) is None

    def test_delete_other_users_list_returns_404(
        self, test_client: TestClient, test_db: Session, auth_headers: dict
    ):
        other_headers = _other_auth(test_db)
        list_id = _create_list(test_client, other_headers).json()["id"]
        resp = test_client.delete(f"/recruiter/lists/{list_id}", headers=auth_headers)
        assert resp.status_code == 404

    def test_unauthenticated_returns_401_or_403(self, test_client: TestClient):
        resp = test_client.post("/recruiter/lists", json={"name": "X"})
        assert resp.status_code in (401, 403)


# ---------------------------------------------------------------------------
# POST /recruiter/lists/{id}/candidates — add candidate
# ---------------------------------------------------------------------------

class TestAddCandidate:
    def test_add_candidate_returns_201(
        self, test_client: TestClient, test_db: Session, auth_headers: dict, test_user: User
    ):
        list_id = _create_list(test_client, auth_headers).json()["id"]
        session = _make_cv_session(test_db, test_user)
        resp = test_client.post(
            f"/recruiter/lists/{list_id}/candidates",
            json={"session_id": session.id},
            headers=auth_headers,
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["session_id"] == session.id
        assert body["match_score"] == session.match_score

    def test_add_duplicate_candidate_returns_409(
        self, test_client: TestClient, test_db: Session, auth_headers: dict, test_user: User
    ):
        list_id = _create_list(test_client, auth_headers).json()["id"]
        session = _make_cv_session(test_db, test_user)
        test_client.post(
            f"/recruiter/lists/{list_id}/candidates",
            json={"session_id": session.id},
            headers=auth_headers,
        )
        resp = test_client.post(
            f"/recruiter/lists/{list_id}/candidates",
            json={"session_id": session.id},
            headers=auth_headers,
        )
        assert resp.status_code == 409

    def test_add_session_without_match_score_returns_422(
        self, test_client: TestClient, test_db: Session, auth_headers: dict, test_user: User
    ):
        list_id = _create_list(test_client, auth_headers).json()["id"]
        no_score = CVSession(
            user_id=test_user.id, cv_filename="no_score.pdf",
            jd_text="jd", match_score=None,
        )
        test_db.add(no_score)
        test_db.commit()
        test_db.refresh(no_score)
        resp = test_client.post(
            f"/recruiter/lists/{list_id}/candidates",
            json={"session_id": no_score.id},
            headers=auth_headers,
        )
        assert resp.status_code == 422

    def test_enforce_20_candidate_limit(
        self, test_client: TestClient, test_db: Session, auth_headers: dict, test_user: User
    ):
        list_id = _create_list(test_client, auth_headers).json()["id"]
        for i in range(20):
            s = CVSession(
                user_id=test_user.id,
                cv_filename=f"cv_limit_{i}.pdf",
                jd_text="jd",
                match_score=float(50 + i),
            )
            test_db.add(s)
            test_db.commit()
            test_db.refresh(s)
            r = test_client.post(
                f"/recruiter/lists/{list_id}/candidates",
                json={"session_id": s.id},
                headers=auth_headers,
            )
            assert r.status_code == 201, f"Failed to add candidate {i}: {r.json()}"

        extra = CVSession(
            user_id=test_user.id, cv_filename="cv_extra.pdf",
            jd_text="jd", match_score=99.0,
        )
        test_db.add(extra)
        test_db.commit()
        test_db.refresh(extra)
        resp = test_client.post(
            f"/recruiter/lists/{list_id}/candidates",
            json={"session_id": extra.id},
            headers=auth_headers,
        )
        assert resp.status_code == 422

    def test_add_other_users_session_returns_422(
        self, test_client: TestClient, test_db: Session, auth_headers: dict
    ):
        list_id = _create_list(test_client, auth_headers).json()["id"]
        _other_auth(test_db)
        other_user = test_db.query(User).filter(User.email == "other_recruiter@example.com").first()
        foreign_session = _make_cv_session(test_db, other_user)
        resp = test_client.post(
            f"/recruiter/lists/{list_id}/candidates",
            json={"session_id": foreign_session.id},
            headers=auth_headers,
        )
        assert resp.status_code == 422

    def test_add_to_other_users_list_returns_404(
        self, test_client: TestClient, test_db: Session, auth_headers: dict, test_user: User
    ):
        other_headers = _other_auth(test_db)
        list_id = _create_list(test_client, other_headers).json()["id"]
        session = _make_cv_session(test_db, test_user)
        resp = test_client.post(
            f"/recruiter/lists/{list_id}/candidates",
            json={"session_id": session.id},
            headers=auth_headers,
        )
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# GET /recruiter/lists/{id}/candidates — list + sorting
# ---------------------------------------------------------------------------

class TestGetCandidates:
    def test_candidates_sorted_by_score_desc(
        self, test_client: TestClient, test_db: Session, auth_headers: dict, test_user: User
    ):
        list_id = _create_list(test_client, auth_headers).json()["id"]
        s1 = _make_cv_session(test_db, test_user, score=60.0)
        s2 = _make_cv_session(test_db, test_user, score=90.0)
        s3 = _make_cv_session(test_db, test_user, score=75.0)
        for s in (s1, s2, s3):
            test_client.post(
                f"/recruiter/lists/{list_id}/candidates",
                json={"session_id": s.id},
                headers=auth_headers,
            )
        resp = test_client.get(f"/recruiter/lists/{list_id}/candidates", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body["list_id"] == list_id
        scores = [c["match_score"] for c in body["candidates"]]
        assert scores == sorted(scores, reverse=True)

    def test_get_other_users_candidates_returns_404(
        self, test_client: TestClient, test_db: Session, auth_headers: dict
    ):
        other_headers = _other_auth(test_db)
        list_id = _create_list(test_client, other_headers).json()["id"]
        resp = test_client.get(f"/recruiter/lists/{list_id}/candidates", headers=auth_headers)
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# PATCH /recruiter/lists/{id}/candidates/{cid} — rank update
# ---------------------------------------------------------------------------

class TestRankUpdate:
    def test_update_rank_returns_200(
        self, test_client: TestClient, test_db: Session, auth_headers: dict, test_user: User
    ):
        list_id = _create_list(test_client, auth_headers).json()["id"]
        session = _make_cv_session(test_db, test_user)
        candidate_id = test_client.post(
            f"/recruiter/lists/{list_id}/candidates",
            json={"session_id": session.id},
            headers=auth_headers,
        ).json()["id"]

        resp = test_client.patch(
            f"/recruiter/lists/{list_id}/candidates/{candidate_id}",
            json={"rank": 3},
            headers=auth_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["rank"] == 3

    def test_update_rank_nonexistent_candidate_returns_404(
        self, test_client: TestClient, auth_headers: dict
    ):
        list_id = _create_list(test_client, auth_headers).json()["id"]
        resp = test_client.patch(
            f"/recruiter/lists/{list_id}/candidates/99999",
            json={"rank": 1},
            headers=auth_headers,
        )
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# DELETE /recruiter/lists/{id}/candidates/{cid} — remove candidate
# ---------------------------------------------------------------------------

class TestRemoveCandidate:
    def test_remove_candidate_returns_204(
        self, test_client: TestClient, test_db: Session, auth_headers: dict, test_user: User
    ):
        list_id = _create_list(test_client, auth_headers).json()["id"]
        session = _make_cv_session(test_db, test_user)
        candidate_id = test_client.post(
            f"/recruiter/lists/{list_id}/candidates",
            json={"session_id": session.id},
            headers=auth_headers,
        ).json()["id"]

        resp = test_client.delete(
            f"/recruiter/lists/{list_id}/candidates/{candidate_id}",
            headers=auth_headers,
        )
        assert resp.status_code == 204

    def test_removed_candidate_no_longer_in_list(
        self, test_client: TestClient, test_db: Session, auth_headers: dict, test_user: User
    ):
        list_id = _create_list(test_client, auth_headers).json()["id"]
        session = _make_cv_session(test_db, test_user)
        candidate_id = test_client.post(
            f"/recruiter/lists/{list_id}/candidates",
            json={"session_id": session.id},
            headers=auth_headers,
        ).json()["id"]

        test_client.delete(
            f"/recruiter/lists/{list_id}/candidates/{candidate_id}",
            headers=auth_headers,
        )
        resp = test_client.get(f"/recruiter/lists/{list_id}/candidates", headers=auth_headers)
        ids = [c["id"] for c in resp.json()["candidates"]]
        assert candidate_id not in ids


# ---------------------------------------------------------------------------
# GET /recruiter/lists/{id}/export — PDF export
# ---------------------------------------------------------------------------

class TestPDFExport:
    def test_export_returns_pdf(
        self, test_client: TestClient, test_db: Session, auth_headers: dict, test_user: User
    ):
        list_id = _create_list(test_client, auth_headers).json()["id"]
        session = _make_cv_session(test_db, test_user)
        test_client.post(
            f"/recruiter/lists/{list_id}/candidates",
            json={"session_id": session.id},
            headers=auth_headers,
        )
        resp = test_client.get(f"/recruiter/lists/{list_id}/export", headers=auth_headers)
        assert resp.status_code == 200
        assert "application/pdf" in resp.headers["content-type"]
        assert resp.content[:4] == b"%PDF"

    def test_export_empty_list_still_returns_pdf(
        self, test_client: TestClient, auth_headers: dict
    ):
        list_id = _create_list(test_client, auth_headers).json()["id"]
        resp = test_client.get(f"/recruiter/lists/{list_id}/export", headers=auth_headers)
        assert resp.status_code == 200
        assert resp.content[:4] == b"%PDF"

    def test_export_other_users_list_returns_404(
        self, test_client: TestClient, test_db: Session, auth_headers: dict
    ):
        other_headers = _other_auth(test_db)
        list_id = _create_list(test_client, other_headers).json()["id"]
        resp = test_client.get(f"/recruiter/lists/{list_id}/export", headers=auth_headers)
        assert resp.status_code == 404
