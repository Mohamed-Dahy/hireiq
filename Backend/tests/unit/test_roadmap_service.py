"""Unit tests for career roadmap service — Phase 11 / Phase 4 (US9)"""

from unittest.mock import patch, MagicMock
import json

import pytest
from sqlalchemy.orm import Session

from models.user import User, CVSession
from services.roadmap_service import generate_career_roadmap, save_roadmap, get_roadmap, list_roadmaps


_VALID_LLM_RESPONSE = json.dumps({
    "phases": [
        {
            "name": "Test Phase",
            "estimated_weeks": 4,
            "skills_covered": ["Python", "SQL"],
            "resources": [
                {
                    "name": "Python for Everybody",
                    "url": "https://www.coursera.org/specializations/python",
                    "type": "course",
                    "is_free": True,
                    "estimated_hours": 40,
                }
            ],
            "project_to_build": "Build a CLI tool",
            "milestone": "Can write Python scripts",
        }
    ],
    "career_insight": {
        "salary_range_local": "25,000–45,000 EGP/month",
        "salary_range_remote": "$3,000–$7,000/month USD",
        "top_companies": ["Company A", "Company B", "Company C", "Company D", "Company E"],
        "hot_skills": ["Python", "SQL", "Docker", "AWS", "Kubernetes"],
        "market_demand": "high",
    },
    "quick_wins": [
        {
            "action": "Complete CS50P week 0-3",
            "why": "Builds Python foundation",
            "time_required": "2-3 hours",
        }
    ],
})

_SAMPLE_GAP_REPORT = [
    {"skill": "Kubernetes", "importance": "high", "reason": "Required for platform work"},
    {"skill": "System Design", "importance": "medium", "reason": "Expected at senior level"},
]

_SAMPLE_SKILLS = [{"skill": "Python", "category": "hard", "level": "advanced"}]


# ---------------------------------------------------------------------------
# Mode: CV-based (gap_report present) — uses _roadmap_chain
# ---------------------------------------------------------------------------

class TestCvBasedMode:
    def test_valid_llm_returns_all_required_keys(self):
        with patch("services.roadmap_service._roadmap_chain") as mock_chain:
            mock_chain.invoke = MagicMock(return_value=_VALID_LLM_RESPONSE)
            result = generate_career_roadmap(
                current_skills=_SAMPLE_SKILLS,
                target_role="Data Engineer",
                jd_text="We need a data engineer with Python and Kubernetes",
                gap_report=_SAMPLE_GAP_REPORT,
            )
            assert "phases" in result
            assert "career_insight" in result
            assert "quick_wins" in result

    def test_phase_has_required_fields(self):
        with patch("services.roadmap_service._roadmap_chain") as mock_chain:
            mock_chain.invoke = MagicMock(return_value=_VALID_LLM_RESPONSE)
            result = generate_career_roadmap([], "DE", "some JD", gap_report=_SAMPLE_GAP_REPORT)
            phase = result["phases"][0]
            assert "name" in phase
            assert "estimated_weeks" in phase
            assert "skills_covered" in phase
            assert "resources" in phase
            assert "project_to_build" in phase
            assert "milestone" in phase

    def test_resource_has_required_fields(self):
        with patch("services.roadmap_service._roadmap_chain") as mock_chain:
            mock_chain.invoke = MagicMock(return_value=_VALID_LLM_RESPONSE)
            result = generate_career_roadmap([], "DE", "some JD", gap_report=_SAMPLE_GAP_REPORT)
            resource = result["phases"][0]["resources"][0]
            assert "name" in resource
            assert "url" in resource
            assert "type" in resource
            assert "is_free" in resource
            assert "estimated_hours" in resource

    def test_llm_exception_returns_fallback(self):
        with patch("services.roadmap_service._roadmap_chain") as mock_chain:
            mock_chain.invoke = MagicMock(side_effect=Exception("LLM down"))
            result = generate_career_roadmap([], "DE", "some JD", gap_report=_SAMPLE_GAP_REPORT)
            assert result["phases"] == []
            assert "career_insight" in result
            assert result["quick_wins"] == []

    def test_malformed_json_returns_fallback(self):
        with patch("services.roadmap_service._roadmap_chain") as mock_chain:
            mock_chain.invoke = MagicMock(return_value="not valid json {{{")
            result = generate_career_roadmap([], "DE", "some JD", gap_report=_SAMPLE_GAP_REPORT)
            assert result["phases"] == []

    def test_response_missing_phases_key_returns_fallback(self):
        incomplete = json.dumps({"career_insight": {}})
        with patch("services.roadmap_service._roadmap_chain") as mock_chain:
            mock_chain.invoke = MagicMock(return_value=incomplete)
            result = generate_career_roadmap([], "DE", "some JD", gap_report=_SAMPLE_GAP_REPORT)
            assert result["phases"] == []


# ---------------------------------------------------------------------------
# Mode: JD-only (session has JD text but no gap_report) — uses _roadmap_chain
# ---------------------------------------------------------------------------

class TestJdOnlyMode:
    def test_jd_only_uses_roadmap_chain(self):
        with patch("services.roadmap_service._roadmap_chain") as mock_chain, \
             patch("services.roadmap_service._roadmap_role_only_chain") as mock_role_chain:
            mock_chain.invoke = MagicMock(return_value=_VALID_LLM_RESPONSE)
            result = generate_career_roadmap([], "Data Engineer", "We need a senior DE with Spark")
            assert mock_chain.invoke.called
            assert not mock_role_chain.invoke.called
            assert "phases" in result

    def test_jd_only_exception_returns_fallback(self):
        with patch("services.roadmap_service._roadmap_chain") as mock_chain:
            mock_chain.invoke = MagicMock(side_effect=Exception("LLM timeout"))
            result = generate_career_roadmap([], "DE", "some JD text here")
            assert result["phases"] == []


# ---------------------------------------------------------------------------
# Mode: Role-only (no session, no jd_text) — uses _roadmap_role_only_chain
# ---------------------------------------------------------------------------

class TestRoleOnlyMode:
    def test_role_only_uses_role_only_chain(self):
        with patch("services.roadmap_service._roadmap_role_only_chain") as mock_role_chain, \
             patch("services.roadmap_service._roadmap_chain") as mock_chain:
            mock_role_chain.invoke = MagicMock(return_value=_VALID_LLM_RESPONSE)
            result = generate_career_roadmap([], "DevOps Engineer", "", role_description="Focus on AWS and Kubernetes")
            assert mock_role_chain.invoke.called
            assert not mock_chain.invoke.called
            assert "phases" in result

    def test_role_only_no_description_still_works(self):
        with patch("services.roadmap_service._roadmap_role_only_chain") as mock_role_chain:
            mock_role_chain.invoke = MagicMock(return_value=_VALID_LLM_RESPONSE)
            result = generate_career_roadmap([], "ML Engineer", "")
            assert "phases" in result

    def test_role_only_exception_returns_fallback(self):
        with patch("services.roadmap_service._roadmap_role_only_chain") as mock_role_chain:
            mock_role_chain.invoke = MagicMock(side_effect=Exception("LLM down"))
            result = generate_career_roadmap([], "DE", "", role_description="Some description")
            assert result["phases"] == []


# ---------------------------------------------------------------------------
# DB helpers: save / get / list
# ---------------------------------------------------------------------------

class TestSaveAndGetRoadmap:
    def test_save_and_get_roadmap(self, test_db: Session, test_user: User):
        roadmap_data = {"phases": [], "career_insight": {}, "quick_wins": [], "total_estimated_weeks": 0}
        rm = save_roadmap(test_db, test_user.id, None, "Data Engineer", roadmap_data)
        assert rm.id is not None
        assert rm.target_role == "Data Engineer"

        fetched = get_roadmap(test_db, rm.id, test_user.id)
        assert fetched.id == rm.id

    def test_get_roadmap_wrong_user_returns_404(self, test_db: Session, test_user: User):
        other = User(email="other@t.com", username="other", hashed_password="pw")
        test_db.add(other)
        test_db.commit()
        roadmap_data = {"phases": [], "career_insight": {}, "quick_wins": [], "total_estimated_weeks": 0}
        rm = save_roadmap(test_db, other.id, None, "DE", roadmap_data)
        from fastapi import HTTPException
        with pytest.raises(HTTPException) as exc:
            get_roadmap(test_db, rm.id, test_user.id)
        assert exc.value.status_code == 404

    def test_list_roadmaps_returns_only_own(self, test_db: Session, test_user: User):
        roadmap_data = {"phases": [], "career_insight": {}, "quick_wins": [], "total_estimated_weeks": 0}
        save_roadmap(test_db, test_user.id, None, "Role A", roadmap_data)
        save_roadmap(test_db, test_user.id, None, "Role B", roadmap_data)
        other = User(email="o@t.com", username="o", hashed_password="pw")
        test_db.add(other)
        test_db.commit()
        save_roadmap(test_db, other.id, None, "Other Role", roadmap_data)
        user_rms = list_roadmaps(test_db, test_user.id)
        assert len(user_rms) == 2
        other_rms = list_roadmaps(test_db, other.id)
        assert len(other_rms) == 1
