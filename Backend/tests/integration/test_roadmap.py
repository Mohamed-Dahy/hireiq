"""Integration tests for career roadmap endpoints — Phase 11, US11"""
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


@pytest.fixture()
def test_cv_session(test_db: Session, test_user: User) -> CVSession:
    session = CVSession(
        user_id=test_user.id,
        cv_filename="test.pdf",
        jd_text="Sample JD",
        match_score=75.0,
        skill_inventory=json.dumps([{"skill": "Python", "category": "hard", "level": "intermediate"}]),
    )
    test_db.add(session)
    test_db.commit()
    test_db.refresh(session)
    return session


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
    def test_generate_with_valid_session_returns_200(self, test_client: TestClient, auth_headers: dict, test_cv_session: CVSession):
        with patch("services.roadmap_service._roadmap_chain") as mock_chain:
            mock_chain.invoke = MagicMock(return_value=_VALID_LLM_RESPONSE)
            resp = test_client.post(
                "/roadmap/generate",
                json={"cv_session_id": test_cv_session.id, "target_role": "Data Engineer"},
                headers=auth_headers,
            )
            assert resp.status_code == 200
            data = resp.json()
            assert "id" in data
            assert data["target_role"] == "Data Engineer"
            assert len(data["phases"]) == 1
            assert "career_insight" in data
            assert len(data["quick_wins"]) == 1

    def test_generate_another_users_session_returns_403(self, test_client: TestClient, other_headers: dict, test_cv_session: CVSession):
        resp = test_client.post(
            "/roadmap/generate",
            json={"cv_session_id": test_cv_session.id, "target_role": "DE"},
            headers=other_headers,
        )
        assert resp.status_code == 403

    def test_generate_nonexistent_session_returns_404(self, test_client: TestClient, auth_headers: dict):
        resp = test_client.post(
            "/roadmap/generate",
            json={"cv_session_id": 99999, "target_role": "DE"},
            headers=auth_headers,
        )
        assert resp.status_code == 404

    def test_generate_without_auth_returns_403(self, test_client: TestClient, test_cv_session: CVSession):
        resp = test_client.post(
            "/roadmap/generate",
            json={"cv_session_id": test_cv_session.id, "target_role": "DE"},
        )
        assert resp.status_code == 403


class TestListRoadmaps:
    def test_list_returns_only_own(self, test_client: TestClient, auth_headers: dict, test_cv_session: CVSession):
        with patch("services.roadmap_service._roadmap_chain") as mock_chain:
            mock_chain.invoke = MagicMock(return_value=_VALID_LLM_RESPONSE)
            test_client.post("/roadmap/generate", json={"cv_session_id": test_cv_session.id, "target_role": "DE"}, headers=auth_headers)
        resp = test_client.get("/roadmap", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert data[0]["target_role"] == "DE"
        assert "total_estimated_weeks" in data[0]


class TestGetRoadmap:
    def test_get_returns_full_roadmap(self, test_client: TestClient, auth_headers: dict, test_cv_session: CVSession):
        with patch("services.roadmap_service._roadmap_chain") as mock_chain:
            mock_chain.invoke = MagicMock(return_value=_VALID_LLM_RESPONSE)
            gen = test_client.post("/roadmap/generate", json={"cv_session_id": test_cv_session.id, "target_role": "DE"}, headers=auth_headers)
        roadmap_id = gen.json()["id"]
        resp = test_client.get(f"/roadmap/{roadmap_id}", headers=auth_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == roadmap_id
        assert len(data["phases"]) == 1
        assert "career_insight" in data

    def test_get_another_users_roadmap_returns_404(self, test_client: TestClient, auth_headers: dict, other_headers: dict, test_cv_session: CVSession):
        with patch("services.roadmap_service._roadmap_chain") as mock_chain:
            mock_chain.invoke = MagicMock(return_value=_VALID_LLM_RESPONSE)
            gen = test_client.post("/roadmap/generate", json={"cv_session_id": test_cv_session.id, "target_role": "DE"}, headers=auth_headers)
        roadmap_id = gen.json()["id"]
        resp = test_client.get(f"/roadmap/{roadmap_id}", headers=other_headers)
        assert resp.status_code == 404
