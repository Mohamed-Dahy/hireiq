"""
Integration tests for /recruiter/* endpoints — Phase 7 Recruiter Dashboard.
All tests use real PostgreSQL test DB. No external services mocked.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from models.user import User
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


def _create_list(client, headers, **overrides):
    payload = {"name": "Backend Engineers", "job_title": "Senior Backend Engineer", **overrides}
    return client.post("/recruiter/lists", json=payload, headers=headers)


def _add_candidate(client, headers, list_id: int, name: str = "Test Candidate") -> dict:
    """Add a standalone candidate via Form data (current API). Returns response JSON."""
    resp = client.post(
        f"/recruiter/lists/{list_id}/candidates",
        data={"candidate_name": name},
        headers=headers,
    )
    assert resp.status_code == 201, f"add_candidate failed: {resp.json()}"
    return resp.json()


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
        # Standalone candidate via Form (session_id no longer accepted — Form-based API)
        test_client.post(
            f"/recruiter/lists/{list_id}/candidates",
            data={"candidate_name": "Alice Smith"},
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
        self, test_client: TestClient, auth_headers: dict
    ):
        list_id = _create_list(test_client, auth_headers).json()["id"]
        resp = test_client.post(
            f"/recruiter/lists/{list_id}/candidates",
            data={"candidate_name": "Alice Smith", "applied_position": "Backend Engineer"},
            headers=auth_headers,
        )
        assert resp.status_code == 201
        body = resp.json()
        assert body["candidate_name"] == "Alice Smith"
        assert body["applied_position"] == "Backend Engineer"

    def test_add_candidate_requires_name(
        self, test_client: TestClient, auth_headers: dict
    ):
        list_id = _create_list(test_client, auth_headers).json()["id"]
        resp = test_client.post(
            f"/recruiter/lists/{list_id}/candidates",
            data={},
            headers=auth_headers,
        )
        assert resp.status_code == 422

    def test_enforce_candidate_limit(
        self, test_client: TestClient, test_db: Session, auth_headers: dict, test_user: User
    ):
        list_id = _create_list(test_client, auth_headers).json()["id"]
        # Fill the pipeline to 50 via DB directly (fast — no HTTP overhead for setup)
        from models.jobs import RecruiterCandidate as RC
        for i in range(50):
            test_db.add(RC(recruiter_list_id=list_id, candidate_name=f"Seed {i}", status="new"))
        test_db.commit()

        # 51st candidate via API must be rejected
        resp = test_client.post(
            f"/recruiter/lists/{list_id}/candidates",
            data={"candidate_name": "One Too Many"},
            headers=auth_headers,
        )
        assert resp.status_code == 422

    def test_add_to_other_users_list_returns_404(
        self, test_client: TestClient, test_db: Session, auth_headers: dict
    ):
        other_headers = _other_auth(test_db)
        list_id = _create_list(test_client, other_headers).json()["id"]
        resp = test_client.post(
            f"/recruiter/lists/{list_id}/candidates",
            data={"candidate_name": "Intruder"},
            headers=auth_headers,
        )
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# GET /recruiter/lists/{id}/candidates — list + sorting
# ---------------------------------------------------------------------------

class TestGetCandidates:
    def test_candidates_list_returns_correct_structure(
        self, test_client: TestClient, auth_headers: dict
    ):
        list_id = _create_list(test_client, auth_headers).json()["id"]
        _add_candidate(test_client, auth_headers, list_id, "Alice")
        _add_candidate(test_client, auth_headers, list_id, "Bob")
        resp = test_client.get(f"/recruiter/lists/{list_id}/candidates", headers=auth_headers)
        assert resp.status_code == 200
        body = resp.json()
        assert body["list_id"] == list_id
        assert len(body["candidates"]) == 2
        names = {c["candidate_name"] for c in body["candidates"]}
        assert names == {"Alice", "Bob"}

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
        self, test_client: TestClient, auth_headers: dict
    ):
        list_id = _create_list(test_client, auth_headers).json()["id"]
        candidate_id = _add_candidate(test_client, auth_headers, list_id)["id"]

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
        self, test_client: TestClient, auth_headers: dict
    ):
        list_id = _create_list(test_client, auth_headers).json()["id"]
        candidate_id = _add_candidate(test_client, auth_headers, list_id)["id"]

        resp = test_client.delete(
            f"/recruiter/lists/{list_id}/candidates/{candidate_id}",
            headers=auth_headers,
        )
        assert resp.status_code == 204

    def test_removed_candidate_no_longer_in_list(
        self, test_client: TestClient, auth_headers: dict
    ):
        list_id = _create_list(test_client, auth_headers).json()["id"]
        candidate_id = _add_candidate(test_client, auth_headers, list_id)["id"]

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
        self, test_client: TestClient, auth_headers: dict
    ):
        list_id = _create_list(test_client, auth_headers).json()["id"]
        _add_candidate(test_client, auth_headers, list_id, "Jane Doe")
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
