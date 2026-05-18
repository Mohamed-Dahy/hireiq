"""
Integration tests for the Interview Bank feature (Phase 9).
Uses the shared test_db / test_client fixtures from conftest.py (no mocks,
real PostgreSQL test database).
"""
import pytest
from sqlalchemy.orm import Session

from models.content import InterviewQuestion, UserQuestionProgress


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def sample_question(test_db: Session) -> InterviewQuestion:
    q = InterviewQuestion(
        role="Software Engineer",
        level="mid",
        category="data_structures",
        question_text="What is a binary search tree?",
        model_answer="A BST is a binary tree where each node's left subtree contains only nodes with keys less than the node's key, and the right subtree only nodes with keys greater.",
        content_hash="test_hash_bst_001",
        source="test",
    )
    test_db.add(q)
    test_db.commit()
    test_db.refresh(q)
    return q


@pytest.fixture()
def second_question(test_db: Session) -> InterviewQuestion:
    q = InterviewQuestion(
        role="Software Engineer",
        level="mid",
        category="algorithms",
        question_text="Explain the difference between BFS and DFS.",
        model_answer="BFS explores neighbors level by level using a queue; DFS goes deep first using a stack or recursion.",
        content_hash="test_hash_bfsdfs_002",
        source="test",
    )
    test_db.add(q)
    test_db.commit()
    test_db.refresh(q)
    return q


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_get_roles(test_client, sample_question):
    response = test_client.get("/interview-bank/roles")
    assert response.status_code == 200
    data = response.json()
    assert "roles" in data
    assert isinstance(data["roles"], list)
    assert "Software Engineer" in data["roles"]


def test_get_questions_grouped_by_category(test_client, sample_question):
    response = test_client.get(
        "/interview-bank/questions",
        params={"role": "Software Engineer", "level": "mid"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["role"] == "Software Engineer"
    assert data["level"] == "mid"
    assert "categories" in data
    assert isinstance(data["categories"], dict)
    assert data["total_questions"] > 0
    for category, questions in data["categories"].items():
        assert isinstance(questions, list)
        assert len(questions) > 0
        for q in questions:
            assert "id" in q
            assert "question_text" in q
            assert "model_answer" in q
            assert "practiced" in q


def test_get_questions_includes_all_level(test_client, test_db):
    """Questions with level='all' should appear for any level filter."""
    universal_q = InterviewQuestion(
        role="Software Engineer",
        level="all",
        category="general",
        question_text="Tell me about yourself.",
        model_answer="Briefly describe background, skills, and why you are a good fit.",
        content_hash="test_hash_universal_003",
        source="test",
    )
    test_db.add(universal_q)
    test_db.commit()

    response = test_client.get(
        "/interview-bank/questions",
        params={"role": "Software Engineer", "level": "junior"},
    )
    assert response.status_code == 200
    data = response.json()
    all_q_ids = [q["id"] for cat in data["categories"].values() for q in cat]
    assert universal_q.id in all_q_ids


def test_search_returns_matching_questions(test_client, sample_question):
    keyword = "binary search"
    response = test_client.get(
        "/interview-bank/search",
        params={"q": keyword},
    )
    assert response.status_code == 200
    data = response.json()
    assert "results" in data
    assert "total" in data
    assert data["total"] > 0
    for result in data["results"]:
        assert keyword.lower() in result["question_text"].lower()


def test_search_no_results_returns_empty(test_client, sample_question):
    response = test_client.get(
        "/interview-bank/search",
        params={"q": "xyzzy_impossible_term_12345"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["total"] == 0
    assert data["results"] == []


def test_mark_practiced_persists(test_client, test_db: Session, auth_headers, test_user, sample_question):
    question_id = sample_question.id

    # Mark as practiced
    response = test_client.post(
        "/interview-bank/progress",
        json={"question_id": question_id, "practiced": True},
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["question_id"] == question_id
    assert data["practiced"] is True

    # Verify DB row exists
    test_db.expire_all()
    row = (
        test_db.query(UserQuestionProgress)
        .filter(
            UserQuestionProgress.user_id == test_user.id,
            UserQuestionProgress.question_id == question_id,
        )
        .first()
    )
    assert row is not None

    # Unmark
    response = test_client.post(
        "/interview-bank/progress",
        json={"question_id": question_id, "practiced": False},
        headers=auth_headers,
    )
    assert response.status_code == 200
    assert response.json()["practiced"] is False

    # Verify DB row removed
    test_db.expire_all()
    row = (
        test_db.query(UserQuestionProgress)
        .filter(
            UserQuestionProgress.user_id == test_user.id,
            UserQuestionProgress.question_id == question_id,
        )
        .first()
    )
    assert row is None


def test_mark_practiced_requires_auth(test_client, sample_question):
    response = test_client.post(
        "/interview-bank/progress",
        json={"question_id": sample_question.id, "practiced": True},
    )
    assert response.status_code in (401, 403)


def test_mark_practiced_unknown_question_returns_404(test_client, auth_headers):
    response = test_client.post(
        "/interview-bank/progress",
        json={"question_id": 99999999, "practiced": True},
        headers=auth_headers,
    )
    assert response.status_code == 404


def test_progress_calculation_correct(
    test_client, test_db: Session, auth_headers, test_user, sample_question, second_question
):
    role = "Software Engineer"
    level = "mid"

    # Mark sample_question as practiced
    test_db.add(UserQuestionProgress(user_id=test_user.id, question_id=sample_question.id))
    test_db.commit()

    response = test_client.get(
        "/interview-bank/progress",
        params={"role": role, "level": level},
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["role"] == role
    assert data["level"] == level
    assert "overall_readiness_pct" in data
    assert isinstance(data["overall_readiness_pct"], int)
    assert 0 <= data["overall_readiness_pct"] <= 100
    assert "by_category" in data
    # At least one category should show progress
    assert data["overall_readiness_pct"] > 0


def test_progress_requires_auth(test_client, sample_question):
    response = test_client.get(
        "/interview-bank/progress",
        params={"role": "Software Engineer", "level": "mid"},
    )
    assert response.status_code in (401, 403)


def test_progress_empty_role_returns_zero(test_client, auth_headers):
    response = test_client.get(
        "/interview-bank/progress",
        params={"role": "NonExistentRole", "level": "mid"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    data = response.json()
    assert data["overall_readiness_pct"] == 0
    assert data["by_category"] == {}
