"""
Unit tests for services.ats_keywords — AI keyword coverage with graceful
degradation (spec 003, US3 / FR-017–019, FR-028).

The LLM chain is patched; no network. Verifies JSON parsing, empty-JD handling,
and that every failure mode degrades to {available: False} without raising.
"""

from unittest.mock import MagicMock, patch

from services import ats_keywords


def _fake_chain(return_value=None, side_effect=None):
    m = MagicMock()
    if side_effect is not None:
        m.invoke.side_effect = side_effect
    else:
        m.invoke.return_value = return_value
    return m


class TestKeywordCoverage:
    def test_valid_json_is_parsed(self):
        fake = _fake_chain('```json\n{"matched":["python","docker"],"missing":["kubernetes"]}\n```')
        with patch.object(ats_keywords, "_chain", fake):
            r = ats_keywords.compute_keyword_coverage("cv text python docker", "jd python docker kubernetes")
        assert r["available"] is True
        assert "python" in r["matched"] and "docker" in r["matched"]
        assert r["missing"] == ["kubernetes"]

    def test_empty_jd_is_unavailable_without_calling_llm(self):
        fake = _fake_chain('{"matched":[],"missing":[]}')
        with patch.object(ats_keywords, "_chain", fake):
            r = ats_keywords.compute_keyword_coverage("cv", "   ")
        assert r == {"matched": [], "missing": [], "available": False}
        fake.invoke.assert_not_called()

    def test_llm_error_degrades_gracefully(self):
        fake = _fake_chain(side_effect=RuntimeError("groq down"))
        with patch.object(ats_keywords, "_chain", fake):
            r = ats_keywords.compute_keyword_coverage("cv", "jd python")
        assert r == {"matched": [], "missing": [], "available": False}

    def test_bad_json_degrades_gracefully(self):
        fake = _fake_chain("this is not json")
        with patch.object(ats_keywords, "_chain", fake):
            r = ats_keywords.compute_keyword_coverage("cv", "jd python")
        assert r["available"] is False

    def test_lists_are_bounded_and_stringified(self):
        payload = '{"matched": %s, "missing": []}' % list(range(60))
        fake = _fake_chain(payload)
        with patch.object(ats_keywords, "_chain", fake):
            r = ats_keywords.compute_keyword_coverage("cv", "jd")
        assert r["available"] is True
        assert len(r["matched"]) == 40                      # capped
        assert all(isinstance(x, str) for x in r["matched"])  # stringified
