"""
Unit tests for the deterministic ATS engine (services.ats_checker).

These are pure (no DB, no I/O, no LLM): they call evaluate(text, signals)
with crafted fixtures and assert on the score, categories, and issues.
"""

from services import ats_checker
from tests.fixtures.sample_cvs import (
    CLEAN_CV,
    MISSING_SKILLS_CV,
    IMAGE_ONLY_CV,
    NONSTANDARD_HEADINGS_CV,
    make_signals,
)


def _issue_categories(result: dict) -> set[str]:
    return {i["category"] for i in result["issues"]}


def _category(result: dict, key: str) -> dict:
    return next(c for c in result["categories"] if c["key"] == key)


class TestOverallShape:
    def test_returns_expected_keys(self):
        text, signals = CLEAN_CV
        result = ats_checker.evaluate(text, signals)
        assert set(result) >= {"overall_score", "categories", "issues", "keyword_coverage", "ai_sections_available"}
        assert 0 <= result["overall_score"] <= 100
        assert result["keyword_coverage"] is None          # no JD ⇒ no coverage (FR-019)
        assert result["ai_sections_available"] is True

    def test_clean_cv_scores_high(self):
        text, signals = CLEAN_CV
        result = ats_checker.evaluate(text, signals)
        assert result["overall_score"] >= 80

    def test_eight_deterministic_categories_present(self):
        text, signals = CLEAN_CV
        result = ats_checker.evaluate(text, signals)
        keys = {c["key"] for c in result["categories"]}
        assert keys == {
            "parseability", "sections", "headings", "contact",
            "formatting", "unfriendly_elements", "content_quality", "dates",
        }
        # deterministic categories are never AI-dependent
        assert all(c["ai_dependent"] is False for c in result["categories"])


class TestParseability:
    def test_image_only_cv_flagged_and_low_score(self):
        text, signals = IMAGE_ONLY_CV
        result = ats_checker.evaluate(text, signals)
        assert _category(result, "parseability")["score"] < 0.3
        assert result["overall_score"] < 50
        para_issues = [i for i in result["issues"] if i["category"] == "parseability"]
        assert any(i["severity"] == "high" for i in para_issues)


class TestSections:
    def test_missing_skills_section_flagged(self):
        text, signals = MISSING_SKILLS_CV
        result = ats_checker.evaluate(text, signals)
        assert "sections" in _issue_categories(result)
        msgs = " ".join(i["message"].lower() for i in result["issues"] if i["category"] == "sections")
        assert "skills" in msgs

    def test_clean_cv_has_all_sections(self):
        text, signals = CLEAN_CV
        result = ats_checker.evaluate(text, signals)
        assert _category(result, "sections")["score"] == 1.0


class TestHeadings:
    def test_nonstandard_heading_detected(self):
        text, signals = NONSTANDARD_HEADINGS_CV
        result = ats_checker.evaluate(text, signals)
        head_issues = [i for i in result["issues"] if i["category"] == "headings"]
        assert head_issues
        # recommends a canonical name
        assert any("Experience" in i["recommendation"] for i in head_issues)


class TestContact:
    def test_missing_contact_flagged_high(self):
        text = "Experienced professional.\nSkills: Python\nExperience: lots\nEducation: a degree"
        result = ats_checker.evaluate(text, make_signals())
        contact_issues = [i for i in result["issues"] if i["category"] == "contact"]
        assert any(i["severity"] == "high" for i in contact_issues)
        assert _category(result, "contact")["score"] == 0.0

    def test_email_and_phone_full_score(self):
        text, signals = CLEAN_CV
        result = ats_checker.evaluate(text, signals)
        assert _category(result, "contact")["score"] == 1.0


class TestUnfriendlyElements:
    def test_decorative_glyphs_and_bad_font_flagged(self):
        text, signals = NONSTANDARD_HEADINGS_CV
        result = ats_checker.evaluate(text, signals)
        assert "unfriendly_elements" in _issue_categories(result)
        assert _category(result, "unfriendly_elements")["score"] < 1.0


class TestFormatting:
    def test_multi_column_flagged(self):
        result = ats_checker.evaluate(CLEAN_CV[0], make_signals(multi_column=True))
        fmt_issues = [i for i in result["issues"] if i["category"] == "formatting"]
        assert any("column" in i["message"].lower() for i in fmt_issues)


class TestContentQuality:
    def test_short_cv_without_metrics_flagged(self):
        text = "John Doe\njohn@x.com | 555 1234\nExperience\nDid stuff.\nSkills\nthings\nEducation\nschool"
        result = ats_checker.evaluate(text, make_signals(total_chars=len(text)))
        cq_issues = [i for i in result["issues"] if i["category"] == "content_quality"]
        assert cq_issues  # too short / no action verbs / no quantified achievements

    def test_quantified_clean_cv_not_flagged_for_metrics(self):
        text, signals = CLEAN_CV
        result = ats_checker.evaluate(text, signals)
        cq_msgs = " ".join(i["message"].lower() for i in result["issues"] if i["category"] == "content_quality")
        assert "quantified" not in cq_msgs


class TestIssueOrdering:
    def test_issues_sorted_high_severity_first(self):
        text, signals = IMAGE_ONLY_CV
        result = ats_checker.evaluate(text, signals)
        ranks = {"high": 0, "medium": 1, "low": 2}
        seq = [ranks[i["severity"]] for i in result["issues"]]
        assert seq == sorted(seq)
