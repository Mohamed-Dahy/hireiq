"""
ats_checker.py
--------------
Deterministic, AI-free ATS (Applicant Tracking System) compatibility engine.

Given a CV's extracted text + layout signals (from cv_parser), it produces an
overall 0-100 ATS score, a per-category breakdown, and a severity-ranked list of
issues, each with an actionable recommendation. It NEVER calls an LLM, so it
stays available during AI outages (FR-027) and keeps CV content on the server
(FR-032). Keyword coverage (JD-dependent, AI-assisted) is layered on elsewhere.

Public API:
    run_ats_check(file_path)        -> dict   # parse a PDF then evaluate
    evaluate(text, signals)         -> dict   # pure, unit-testable core
"""

from __future__ import annotations

import re

from app.config import settings
from services.cv_parser import extract_text_from_pdf, extract_layout_signals

# ---------------------------------------------------------------------------
# Wordlists / patterns
# ---------------------------------------------------------------------------

_SECTION_SYNONYMS: dict[str, list[str]] = {
    "experience": ["experience", "work experience", "employment", "professional experience", "work history", "career history"],
    "education": ["education", "academic background", "academic", "qualifications"],
    "skills": ["skills", "technical skills", "core competencies", "competencies", "technologies", "tech stack"],
}

# Common "creative" headings that ATS parsers don't recognize → canonical name
_NONSTANDARD_HEADINGS: dict[str, str] = {
    "my journey": "Experience",
    "professional journey": "Experience",
    "career journey": "Experience",
    "where i've worked": "Experience",
    "where i have worked": "Experience",
    "my story": "Experience",
    "what i've done": "Experience",
    "what i know": "Skills",
    "my toolkit": "Skills",
    "things i'm good at": "Skills",
    "where i studied": "Education",
    "my education journey": "Education",
}

_ACTION_VERBS = {
    "led", "built", "designed", "developed", "implemented", "created", "managed",
    "improved", "increased", "reduced", "launched", "shipped", "architected",
    "optimized", "automated", "delivered", "drove", "owned", "scaled", "migrated",
    "mentored", "spearheaded", "established", "streamlined", "engineered", "deployed",
}

_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
_PHONE_RE = re.compile(r"(?:(?:\+|00)\d{1,3}[\s.\-]?)?(?:\(?\d{2,4}\)?[\s.\-]?){2,4}\d{2,4}")
_QUANTIFIED_RE = re.compile(r"\b\d+(?:[.,]\d+)?\s?(?:%|percent|k\b|m\b|x\b)|[$€£]\s?\d|\b\d{3,}\b")
_YEAR_RE = re.compile(r"\b(?:19|20)\d{2}\b")

# uncommon / decorative fonts that hurt ATS parsing
_BAD_FONT_HINTS = ("comic", "brush", "script", "wingding", "papyrus", "curlz", "jokerman")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _weight(key: str) -> float:
    return float(settings.ats_category_weights.get(key, 0.0))


def _category(key: str, label: str, score: float, *, confidence: str = "high", ai_dependent: bool = False) -> dict:
    return {
        "key": key,
        "label": label,
        "score": round(max(0.0, min(1.0, score)), 3),
        "weight": _weight(key),
        "ai_dependent": ai_dependent,
        "confidence": confidence,
    }


def _issue(category: str, severity: str, message: str, recommendation: str) -> dict:
    return {"category": category, "severity": severity, "message": message, "recommendation": recommendation}


_SEVERITY_RANK = {"high": 0, "medium": 1, "low": 2}


# ---------------------------------------------------------------------------
# Individual category evaluations — each returns (category_dict, [issues])
# ---------------------------------------------------------------------------

def _eval_parseability(text: str, signals: dict) -> tuple[dict, list[dict]]:
    issues: list[dict] = []
    pages = max(signals.get("page_count", 1) or 1, 1)
    total = signals.get("total_chars", len(text.strip()))
    avg = total / pages
    threshold = settings.ats_min_parse_chars_per_page

    if total < 50:
        score = 0.05
        issues.append(_issue(
            "parseability", "high",
            "Almost no machine-readable text could be extracted — the CV looks image-only or scanned.",
            "Export your CV as a text-based PDF (not a scan or exported image). ATS software cannot read text inside images.",
        ))
    elif avg < threshold:
        score = max(0.2, avg / threshold * 0.6)
        issues.append(_issue(
            "parseability", "high",
            "Very little extractable text relative to the page count — parts of the CV may be images.",
            "Ensure all content is selectable text, not embedded images or graphics.",
        ))
    else:
        score = 1.0
        if signals.get("image_count", 0) > 0:
            score = 0.9
            issues.append(_issue(
                "parseability", "low",
                "The CV contains image(s); any text inside them will not be parsed.",
                "Keep important information as text rather than inside logos, charts, or screenshots.",
            ))
    return _category("parseability", "Parseability", score, confidence="high"), issues


def _eval_sections(text_lower: str) -> tuple[dict, list[dict]]:
    issues: list[dict] = []
    present = 0
    total = len(_SECTION_SYNONYMS)
    for canonical, synonyms in _SECTION_SYNONYMS.items():
        if any(s in text_lower for s in synonyms):
            present += 1
        else:
            issues.append(_issue(
                "sections", "high" if canonical in ("experience", "skills") else "medium",
                f"No recognizable '{canonical.title()}' section was found.",
                f"Add a clearly labelled '{canonical.title()}' section with a standard heading.",
            ))
    score = present / total if total else 1.0
    return _category("sections", "Standard sections", score, confidence="high"), issues


def _eval_headings(text: str) -> tuple[dict, list[dict]]:
    issues: list[dict] = []
    lower = text.lower()
    found = 0
    for bad, canonical in _NONSTANDARD_HEADINGS.items():
        if bad in lower:
            found += 1
            issues.append(_issue(
                "headings", "medium",
                f"Non-standard section heading detected ('{bad}').",
                f"Rename it to the conventional '{canonical}' so ATS parsers recognize the section.",
            ))
    score = 1.0 if found == 0 else max(0.3, 1.0 - 0.25 * found)
    return _category("headings", "Heading conventions", score, confidence="medium"), issues


def _eval_contact(text: str) -> tuple[dict, list[dict]]:
    issues: list[dict] = []
    has_email = bool(_EMAIL_RE.search(text))
    has_phone = bool(_PHONE_RE.search(text))
    if has_email and has_phone:
        score = 1.0
    elif has_email or has_phone:
        score = 0.6
        missing = "phone number" if has_email else "email address"
        issues.append(_issue(
            "contact", "medium",
            f"No {missing} was detected in the CV.",
            f"Add a reachable {missing} near the top of the CV.",
        ))
    else:
        score = 0.0
        issues.append(_issue(
            "contact", "high",
            "No email address or phone number was detected.",
            "Add contact details (email and phone) at the top of the CV so recruiters and ATS can reach you.",
        ))
    return _category("contact", "Contact information", score, confidence="high"), issues


def _eval_formatting(signals: dict) -> tuple[dict, list[dict]]:
    issues: list[dict] = []
    score = 1.0
    if signals.get("multi_column"):
        score -= 0.4
        issues.append(_issue(
            "formatting", "high",
            "The layout appears to use multiple columns, which many ATS parsers read out of order.",
            "Use a single-column layout so content is parsed top-to-bottom.",
        ))
    if signals.get("table_like"):
        score -= 0.3
        issues.append(_issue(
            "formatting", "medium",
            "Table-like structures were detected; some ATS systems cannot read tables reliably.",
            "Replace tables with simple text lines or bullet points.",
        ))
    hf = (signals.get("header_footer_text") or "").strip()
    if len(hf) > 40:
        score -= 0.2
        issues.append(_issue(
            "formatting", "medium",
            "Substantial content appears in the page header/footer region, which ATS often ignores.",
            "Move important details (contact info, skills) into the main body, not headers/footers.",
        ))
    return _category("formatting", "Parse-friendly formatting", max(0.0, score), confidence="best_effort"), issues


def _eval_unfriendly_elements(signals: dict) -> tuple[dict, list[dict]]:
    issues: list[dict] = []
    score = 1.0
    if signals.get("non_ascii_ratio", 0.0) > 0.01:
        score -= 0.4
        issues.append(_issue(
            "unfriendly_elements", "medium",
            "Decorative or special characters/glyphs were detected.",
            "Replace decorative symbols (★, ◆, etc.) with plain text or standard bullets (•).",
        ))
    fonts = [str(f).lower() for f in signals.get("fonts", [])]
    if any(any(h in f for h in _BAD_FONT_HINTS) for f in fonts):
        score -= 0.4
        issues.append(_issue(
            "unfriendly_elements", "medium",
            "An uncommon or decorative font was detected.",
            "Use a standard, widely-supported font (Arial, Calibri, Helvetica, Times New Roman).",
        ))
    return _category("unfriendly_elements", "ATS-friendly elements", max(0.0, score), confidence="medium"), issues


def _eval_content_quality(text: str) -> tuple[dict, list[dict]]:
    issues: list[dict] = []
    words = re.findall(r"[A-Za-z']+", text)
    word_count = len(words)
    lower_words = {w.lower() for w in words}
    deductions = 0.0

    if word_count < settings.ats_min_words:
        deductions += 0.35
        issues.append(_issue(
            "content_quality", "high",
            f"The CV is quite short ({word_count} words).",
            f"Expand with concrete accomplishments — aim for at least {settings.ats_min_words} words.",
        ))

    distinct_verbs = len(_ACTION_VERBS & lower_words)
    if distinct_verbs < settings.ats_min_action_verbs:
        deductions += 0.25
        issues.append(_issue(
            "content_quality", "medium",
            f"Few strong action verbs detected ({distinct_verbs}).",
            "Start bullet points with action verbs (Led, Built, Improved, Reduced) to convey impact.",
        ))

    if not _QUANTIFIED_RE.search(text):
        deductions += 0.25
        issues.append(_issue(
            "content_quality", "medium",
            "No quantified achievements were detected.",
            "Add measurable results (e.g., 'reduced latency by 40%', 'handled 2M requests/day').",
        ))

    return _category("content_quality", "Content quality", 1.0 - deductions, confidence="medium"), issues


def _eval_dates(text: str, signals: dict) -> tuple[dict, list[dict]]:
    issues: list[dict] = []
    years = _YEAR_RE.findall(text)
    score = 1.0
    if not years:
        score = 0.4
        issues.append(_issue(
            "dates", "medium",
            "No dates were detected in the experience/education history.",
            "Add start and end dates (month and year) for each role and degree.",
        ))
    else:
        # Mixed date formats: presence of both 'Mon YYYY' and bare 'YYYY' alone is fine,
        # but slash formats mixed with month-name formats signal inconsistency.
        has_slash = bool(re.search(r"\b\d{1,2}/\d{4}\b", text))
        has_monthname = bool(re.search(r"\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+\d{4}\b", text))
        if has_slash and has_monthname:
            score = 0.7
            issues.append(_issue(
                "dates", "low",
                "Inconsistent date formats detected (e.g., '01/2019' alongside 'Jan 2019').",
                "Use one consistent date format throughout (e.g., 'Jan 2019 – Dec 2020').",
            ))
    return _category("dates", "Date consistency", score, confidence="medium"), issues


def _length_issue(signals: dict) -> list[dict]:
    pages = signals.get("page_count", 0) or 0
    if pages > settings.ats_max_pages:
        return [_issue(
            "content_quality", "low",
            f"The CV spans {pages} pages.",
            f"Keep the CV concise — {settings.ats_max_pages} page(s) is ideal for most roles.",
        )]
    return []


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def evaluate(text: str, signals: dict) -> dict:
    """Pure, deterministic ATS evaluation. Returns the ats_result payload."""
    text = text or ""
    text_lower = text.lower()
    signals = signals or {}

    evaluations = [
        _eval_parseability(text, signals),
        _eval_sections(text_lower),
        _eval_headings(text),
        _eval_contact(text),
        _eval_formatting(signals),
        _eval_unfriendly_elements(signals),
        _eval_content_quality(text),
        _eval_dates(text, signals),
    ]

    categories = [c for c, _ in evaluations]
    issues: list[dict] = []
    for _, errs in evaluations:
        issues.extend(errs)
    issues.extend(_length_issue(signals))

    total_weight = sum(c["weight"] for c in categories) or 1.0
    overall = sum(c["weight"] * c["score"] for c in categories) / total_weight * 100.0

    # Sort issues: severity, then by the weight of the category they belong to (desc)
    cat_weight = {c["key"]: c["weight"] for c in categories}
    issues.sort(key=lambda i: (_SEVERITY_RANK.get(i["severity"], 3), -cat_weight.get(i["category"], 0.0)))

    from datetime import datetime, timezone
    return {
        "overall_score": round(overall, 1),
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "ai_sections_available": True,
        "categories": categories,
        "issues": issues,
        "keyword_coverage": None,  # populated by the AI-assisted layer when a JD is supplied
    }


def run_ats_check(file_path: str) -> dict:
    """Parse a PDF from disk and run the deterministic ATS evaluation."""
    text = extract_text_from_pdf(file_path)
    signals = extract_layout_signals(file_path)
    return evaluate(text, signals)
