"""Integration tests for career roadmap endpoints — Phase 11 / Phase 4 (US9)"""
import json
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from models.user import User, CVSession
from services.auth_service import hash_password, create_access_token

_VALID_LLM_RESPONSE = json.dumps({
    "phases": [
        {
            "name": "Foundation Phase",
            "estimated_weeks": 4,
            "skills_covered": ["Python"],
            "resources": [{"name": "Python for Everybody", "url": "https://coursera.org/python", "type": "course", "is_free": True, "estimated_hours": 40}],
            "project_to_build": "CLI tool",
            "milestone": "Write Python scripts",
        }
    ],
    "career_insight": {
        "salary_range_local": "25,000 EGP/month",
        "salary_range_remote": "$3,000/month USD",
        "top_companies": ["A", "B", "C", "D", "E"],
        "hot_skills": ["Python", "SQL"],
        "market_demand": "high",
    },
    "quick_wins": [{"action": "Do X", "why": "Y", "time_required": "2h"}],
})

_SAMPLE_GAP = [{"skill": "Kubernetes", "importance": "high", "reason": "Missing from CV"}]


@pytest.fixture()
def session_no_gap(test_db: Session, test_user: User) -> CVSession:
    """Session with JD text but no structured analysis (no gap_report)."""
    s = CVSession(
        user_id=test_user.id,
        cv_filename="test.pdf",
        jd_text="Sample JD requiring Python and Kubernetes",
        match_score=75.0,
        skill_inventory=json.dumps([{"skill": "Python", "category": "hard", "level": "intermediate"}]),
    )
    test_db.add(s)
    test_db.commit()
    test_db.refresh(s)
    return s


@pytest.fixture()
def session_with_gap(test_db: Session, test_user: User) -> CVSession:
    """Session with full structured analysis (gap_report present)."""
    s = CVSession(
        user_id=test_user.id,
        cv_filename="analysed.pdf",
        jd_text="Senior DE role requiring Kubernetes and Spark",
        match_score=60.0,
        skill_inventory=json.dumps([{"skill": "Python", "category": "hard", "level": "advanced"}]),
        gap_report=json.dumps(_SAMPLE_GAP),
    )
    test_db.add(s)
    test_db.commit()
    test_db.refresh(s)
    return s


@pytest.fixture()
def other_user(test_db: Session) -> User:
    u = User(email="other@t.com", username="other", hashed_password=hash_password("pass"))
    test_db.add(u)
    test_db.commit()
    test_db.refresh(u)
    return u


@pytest.fixture()
def other_headers(other_user: User) -> dict:
    token = create_access_token(other_user.id)
    return {"Authorization": f"Bearer {token}"}


class TestGenerateRoadmap:
    def test_generate_with_session_no_gap_uses_jd_mode(
        self, test_client: TestClient, auth_headers: dict, session_no_gap: CVSession
    ):
        """Session without gap_report falls back to JD-based generation (not 400)."""
        with patch("services.roadmap_service._roadmap_chain") as mock_chain:
            mock_chain.invoke = MagicMock(return_value=_VALID_LLM_RESPONSE)
            resp = test_client.post(
                "/roadmap/generate",
                json={"cv_session_id": session_no_gap.id, "target_role": "Data Engineer"},
                headers=auth_headers,
            )
            assert resp.status_code == 200
            data = resp.json()
            assert "id" in data
            assert data["target_role"] == "Data Engineer"
            assert len(data["phases"]) == 1
            assert "career_insight" in data

    def test_generate_with_analysed_session_uses_gap_mode(
        self, test_client: TestClient, auth_headers: dict, session_with_gap: CVSession
    ):
        """Session with gap_report uses full CV-based generation."""
        with patch("services.roadmap_service._roadmap_chain") as mock_chain:
            mock_chain.invoke = MagicMock(return_value=_VALID_LLM_RESPONSE)
            resp = test_client.post(
                "/roadmap/generate",
                json={"cv_session_id": session_with_gap.id, "target_role": "Senior DE"},
                headers=auth_headers,
            )
            assert resp.status_code == 200
            assert mock_chain.invoke.called

    def test_generate_role_only_no_session(
        self, test_client: TestClient, auth_headers: dict
    ):
        """No cv_session_id → role-only mode using _roadmap_role_only_chain."""
        with patch("services.roadmap_service._roadmap_role_only_chain") as mock_role_chain:
            mock_role_chain.invoke = MagicMock(return_value=_VALID_LLM_RESPONSE)
            resp = test_client.post(
                "/roadmap/generate",
                json={
                    "cv_session_id": None,
                    "target_role": "DevOps Engineer",
                    "role_description": "Focus on AWS, Kubernetes, and CI/CD",
                },
                headers=auth_headers,
            )
            assert resp.status_code == 200
            data = resp.json()
            assert data["target_role"] == "DevOps Engineer"
            assert mock_role_chain.invoke.called

    def test_generate_role_only_no_description(
        self, test_client: TestClient, auth_headers: dict
    ):
        """Role-only with no description still succeeds."""
        with patch("services.roadmap_service._roadmap_role_only_chain") as mock_role_chain:
            mock_role_chain.invoke = MagicMock(return_value=_VALID_LLM_RESPONSE)
            resp = test_client.post(
                "/roadmap/generate",
                json={"cv_session_id": None, "target_role": "ML Engineer"},
                headers=auth_headers,
            )
            assert resp.status_code == 200

    def test_generate_another_users_session_returns_403(
        self, test_client: TestClient, other_headers: dict, session_no_gap: CVSession
    ):
        resp = test_client.post(
            "/roadmap/generate",
            json={"cv_session_id": session_no_gap.id, "target_role": "DE"},
            headers=other_headers,
        )
        assert resp.status_code == 403

    def test_generate_nonexistent_session_returns_404(
        self, test_client: TestClient, auth_headers: dict
    ):
        resp = test_client.post(
            "/roadmap/generate",
            json={"cv_session_id": 99999, "target_role": "DE"},
            headers=auth_headers,
        )
        assert resp.status_code == 404

    def test_generate_without_auth_returns_403(
        self, test_client: TestClient, session_no_gap: CVSession
    ):
        resp = test_client.post(
            "/roadmap/generate",
            json={"cv_session_id": session_no_gap.id, "target_role": "DE"},
        )
        assert resp.status_code in (401, 403)


class TestListRoadmaps:
    def test_list_returns_only_own(
        self, test_client: TestClient, auth_headers: dict, session_no_gap: CVSession
    ):
        with patch("services.roadmap_service._roadmap_chain") as mock_chain:
            mock_chain.invoke = MagicMock(return_value=_VALID_LLM_RESPONSE)
            test_client.post(
                "/roadmap/generate",
                json={"cv_session_id": session_no_gap.id, "target_role": "DE"},
                headers=auth_headers,
            )
        resp = test_client.get("/roadmap", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert data[0]["target_role"] == "DE"
        assert "total_estimated_weeks" in data[0]

    def test_list_requires_auth(self, test_client: TestClient):
        resp = test_client.get("/roadmap")
        assert resp.status_code in (401, 403)


class TestGetRoadmap:
    def test_get_returns_full_roadmap(
        self, test_client: TestClient, auth_headers: dict, session_no_gap: CVSession
    ):
        with patch("services.roadmap_service._roadmap_chain") as mock_chain:
            mock_chain.invoke = MagicMock(return_value=_VALID_LLM_RESPONSE)
            gen = test_client.post(
                "/roadmap/generate",
                json={"cv_session_id": session_no_gap.id, "target_role": "DE"},
                headers=auth_headers,
            )
        roadmap_id = gen.json()["id"]
        resp = test_client.get(f"/roadmap/{roadmap_id}", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == roadmap_id
        assert len(data["phases"]) == 1
        assert "career_insight" in data

    def test_get_another_users_roadmap_returns_404(
        self, test_client: TestClient, auth_headers: dict, other_headers: dict, session_no_gap: CVSession
    ):
        with patch("services.roadmap_service._roadmap_chain") as mock_chain:
            mock_chain.invoke = MagicMock(return_value=_VALID_LLM_RESPONSE)
            gen = test_client.post(
                "/roadmap/generate",
                json={"cv_session_id": session_no_gap.id, "target_role": "DE"},
                headers=auth_headers,
            )
        roadmap_id = gen.json()["id"]
        resp = test_client.get(f"/roadmap/{roadmap_id}", headers=other_headers)
        assert resp.status_code == 404
