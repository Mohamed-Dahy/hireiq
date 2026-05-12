"""
Unit tests for services/llm_analyzer.py — analyze_structured()
Tests run with a mocked LLM chain; no Groq API calls made.
"""

import json
import pytest
from unittest.mock import patch

VALID_STRUCTURED = {
    "skill_inventory": [
        {"skill": "Python", "category": "hard", "level": "advanced"},
        {"skill": "Communication", "category": "soft", "level": "intermediate"},
    ],
    "gap_report": [
        {
            "skill": "Kubernetes",
            "importance": "high",
            "reason": "Required for production deployments",
            "resource": "kubernetes.io/docs",
        }
    ],
    "study_roadmap": [
        {
            "topic": "Container Orchestration",
            "priority": "high",
            "estimated_hours": 20,
            "resources": ["Kubernetes docs", "KodeKloud course"],
        }
    ],
    "questions": [
        {
            "question": "Describe your experience with distributed systems.",
            "model_answer": "I have worked on microservices using Docker Compose.",
        }
    ],
}


class TestAnalyzeStructured:
    def test_returns_dict_with_all_required_keys(self):
        from services.llm_analyzer import analyze_structured

        with patch("services.llm_analyzer.structured_chain") as mock_chain:
            mock_chain.invoke.return_value = json.dumps(VALID_STRUCTURED)
            result = analyze_structured("cv text", "jd text")

        assert isinstance(result, dict)
        assert "skill_inventory" in result
        assert "gap_report" in result
        assert "study_roadmap" in result
        assert "questions" in result

    def test_strips_json_markdown_fence(self):
        from services.llm_analyzer import analyze_structured

        fenced = f"```json\n{json.dumps(VALID_STRUCTURED)}\n```"
        with patch("services.llm_analyzer.structured_chain") as mock_chain:
            mock_chain.invoke.return_value = fenced
            result = analyze_structured("cv text", "jd text")

        assert result["skill_inventory"][0]["skill"] == "Python"

    def test_strips_plain_code_fence(self):
        from services.llm_analyzer import analyze_structured

        fenced = f"```\n{json.dumps(VALID_STRUCTURED)}\n```"
        with patch("services.llm_analyzer.structured_chain") as mock_chain:
            mock_chain.invoke.return_value = fenced
            result = analyze_structured("cv text", "jd text")

        assert "gap_report" in result

    def test_returns_empty_fallback_on_invalid_json(self):
        from services.llm_analyzer import analyze_structured

        with patch("services.llm_analyzer.structured_chain") as mock_chain:
            mock_chain.invoke.return_value = "not valid json at all"
            result = analyze_structured("cv text", "jd text")

        assert result["skill_inventory"] == []
        assert result["gap_report"] == []
        assert result["study_roadmap"] == []
        assert result["questions"] == []

    def test_returns_empty_fallback_on_llm_exception(self):
        from services.llm_analyzer import analyze_structured

        with patch("services.llm_analyzer.structured_chain") as mock_chain:
            mock_chain.invoke.side_effect = RuntimeError("Groq timeout")
            result = analyze_structured("cv text", "jd text")

        assert isinstance(result, dict)
        assert result["skill_inventory"] == []

    def test_skill_inventory_items_have_expected_fields(self):
        from services.llm_analyzer import analyze_structured

        with patch("services.llm_analyzer.structured_chain") as mock_chain:
            mock_chain.invoke.return_value = json.dumps(VALID_STRUCTURED)
            result = analyze_structured("cv text", "jd text")

        item = result["skill_inventory"][0]
        assert "skill" in item
        assert "category" in item
        assert "level" in item

    def test_gap_report_items_have_expected_fields(self):
        from services.llm_analyzer import analyze_structured

        with patch("services.llm_analyzer.structured_chain") as mock_chain:
            mock_chain.invoke.return_value = json.dumps(VALID_STRUCTURED)
            result = analyze_structured("cv text", "jd text")

        gap = result["gap_report"][0]
        assert "skill" in gap
        assert "importance" in gap
        assert "reason" in gap
        assert "resource" in gap

    def test_roadmap_items_have_expected_fields(self):
        from services.llm_analyzer import analyze_structured

        with patch("services.llm_analyzer.structured_chain") as mock_chain:
            mock_chain.invoke.return_value = json.dumps(VALID_STRUCTURED)
            result = analyze_structured("cv text", "jd text")

        item = result["study_roadmap"][0]
        assert "topic" in item
        assert "priority" in item
        assert "estimated_hours" in item
        assert "resources" in item

    def test_question_items_have_expected_fields(self):
        from services.llm_analyzer import analyze_structured

        with patch("services.llm_analyzer.structured_chain") as mock_chain:
            mock_chain.invoke.return_value = json.dumps(VALID_STRUCTURED)
            result = analyze_structured("cv text", "jd text")

        q = result["questions"][0]
        assert "question" in q
        assert "model_answer" in q

    def test_invoke_called_with_cv_and_jd(self):
        from services.llm_analyzer import analyze_structured

        with patch("services.llm_analyzer.structured_chain") as mock_chain:
            mock_chain.invoke.return_value = json.dumps(VALID_STRUCTURED)
            analyze_structured("my cv content", "my jd content")

        mock_chain.invoke.assert_called_once_with(
            {"cv_text": "my cv content", "jd_text": "my jd content"}
        )
