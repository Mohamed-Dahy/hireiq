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
    WEAK_CV,
    YEARS_ONLY_CV,
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


# ── US5: recalibration (score discriminates; accurate detection) ──────────────

class TestRecalibration:
    def test_strong_vs_weak_spread_at_least_25(self):
        strong = ats_checker.evaluate(*CLEAN_CV)["overall_score"]
        weak = ats_checker.evaluate(*WEAK_CV)["overall_score"]
        assert strong - weak >= 25, f"strong={strong} weak={weak}"

    def test_bare_years_are_not_quantified_achievements(self):
        assert ats_checker._QUANTIFIED_RE.search("2016 2018 2020") is None
        assert ats_checker._QUANTIFIED_RE.search("reduced cost by 40%")
        assert ats_checker._QUANTIFIED_RE.search("handled 2M requests")
        assert ats_checker._QUANTIFIED_RE.search("led 5 engineers")
        assert ats_checker._QUANTIFIED_RE.search("made it 3x faster")

    def test_phone_detection_rejects_date_ranges(self):
        assert ats_checker._has_phone("2012 - 2016") is False
        assert ats_checker._has_phone("Jan 2019 - Dec 2020") is False
        assert ats_checker._has_phone("+1 555 123 4567") is True
        assert ats_checker._has_phone("555-123-4567") is True

    def test_years_only_cv_flags_quantified_and_contact(self):
        r = ats_checker.evaluate(*YEARS_ONLY_CV)
        cats = {i["category"] for i in r["issues"]}
        assert "content_quality" in cats   # bare years are not achievements
        assert "contact" in cats           # no phone (years are not a phone)

    def test_section_detection_is_heading_anchored(self):
        # 'experience'/'skills'/'education' appear only inside a sentence, not as headings
        text = "Summary\nI have experience and skills gained during my education.\ncontact me at a@b.com"
        r = ats_checker.evaluate(text, make_signals(total_chars=200))
        sect = next(c for c in r["categories"] if c["key"] == "sections")
        assert sect["score"] < 1.0

    def test_table_and_multicolumn_are_flagged(self):
        r = ats_checker.evaluate(CLEAN_CV[0], make_signals(table_like=True, multi_column=True))
        fmt = " ".join(i["message"].lower() for i in r["issues"] if i["category"] == "formatting")
        assert "table" in fmt and "column" in fmt


# ── US5: enriched output (strengths / next steps / explanation) ───────────────

class TestEnrichment:
    def test_enriched_fields_present(self):
        r = ats_checker.evaluate(*CLEAN_CV)
        assert isinstance(r["strengths"], list) and len(r["strengths"]) >= 1
        assert all("category" in s and "message" in s for s in r["strengths"])
        assert isinstance(r["next_steps"], list) and len(r["next_steps"]) >= 1
        assert isinstance(r["score_explanation"], str) and r["score_explanation"]

    def test_next_steps_ats_ready_when_no_issues(self):
        assert "ATS-ready" in ats_checker._build_next_steps([])[0]

    def test_weak_cv_has_actionable_next_steps(self):
        r = ats_checker.evaluate(*WEAK_CV)
        assert 1 <= len(r["next_steps"]) <= 3
        assert r["strengths"] is not None  # even weak CVs may have some strengths (e.g. parseability)
