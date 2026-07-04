"""
ats_vocab.py
------------
Loads and caches the maintained ATS vocabularies (spec 004, US5) and serves
lookups to ats_checker, resume_parser, and ats_keywords:

  - action verbs      (data/vocab/action_verbs.txt)
  - skills            (data/vocab/skills.json, grouped by domain, flattened)
  - keyword synonyms  (data/vocab/keyword_synonyms.json)

Vocabularies are DATA — updatable without touching scoring logic (FR-020).
Loading is resilient: a missing/unreadable file yields an empty set for that
part and never raises (parity with the engine's "never crash" principle).
"""

from __future__ import annotations

import functools
import json
import logging
import os
import re

from app.config import settings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Loading (cached once; call reload_vocab() in tests to pick up changes)
# ---------------------------------------------------------------------------

def _load_action_verbs(path: str) -> frozenset[str]:
    try:
        with open(path, encoding="utf-8") as f:
            return frozenset(
                line.strip().lower()
                for line in f
                if line.strip() and not line.lstrip().startswith("#")
            )
    except Exception:
        logger.warning("ATS vocab: could not load action verbs from %s", path)
        return frozenset()


def _load_skills(path: str) -> frozenset[str]:
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        skills: set[str] = set()
        for key, group in data.items():
            if key.startswith("_"):
                continue
            if isinstance(group, list):
                skills.update(str(s).strip().lower() for s in group if str(s).strip())
        return frozenset(skills)
    except Exception:
        logger.warning("ATS vocab: could not load skills from %s", path)
        return frozenset()


def _load_synonyms(path: str) -> dict[str, frozenset[str]]:
    """Return canonical -> {synonyms}, plus each synonym -> {canonical + siblings}
    so matching is bidirectional."""
    try:
        with open(path, encoding="utf-8") as f:
            raw = json.load(f)
    except Exception:
        logger.warning("ATS vocab: could not load synonyms from %s", path)
        return {}

    groups: list[set[str]] = []
    for canonical, syns in raw.items():
        if canonical.startswith("_") or not isinstance(syns, list):
            continue
        group = {canonical.strip().lower()} | {str(s).strip().lower() for s in syns if str(s).strip()}
        groups.append(group)

    out: dict[str, set[str]] = {}
    for group in groups:
        for term in group:
            out.setdefault(term, set()).update(group)
    return {k: frozenset(v) for k, v in out.items()}


@functools.lru_cache(maxsize=1)
def _vocab() -> dict:
    base = settings.ats_vocab_dir
    verbs = _load_action_verbs(os.path.join(base, "action_verbs.txt"))
    skills = _load_skills(os.path.join(base, "skills.json"))
    synonyms = _load_synonyms(os.path.join(base, "keyword_synonyms.json"))
    # Precompile a boundary-aware pattern per skill for match_skills().
    patterns = {s: re.compile(r"(?<![a-z0-9+#.])" + re.escape(s) + r"(?![a-z0-9+#])", re.IGNORECASE) for s in skills}
    return {"action_verbs": verbs, "skills": skills, "synonyms": synonyms, "skill_patterns": patterns}


def reload_vocab() -> None:
    """Clear the cache so the next call reloads from disk (used by tests)."""
    _vocab.cache_clear()


# ---------------------------------------------------------------------------
# Public query API
# ---------------------------------------------------------------------------

def action_verbs() -> frozenset[str]:
    return _vocab()["action_verbs"]


def is_action_verb(word: str) -> bool:
    return bool(word) and word.strip().lower() in _vocab()["action_verbs"]


def count_action_verbs(text: str) -> int:
    """Distinct action verbs present in the text (word-boundary, case-insensitive)."""
    if not text:
        return 0
    words = {w.lower() for w in re.findall(r"[A-Za-z']+", text)}
    return len(_vocab()["action_verbs"] & words)


def skills() -> frozenset[str]:
    return _vocab()["skills"]


def match_skills(text: str) -> list[str]:
    """Skills from the vocabulary that appear in the text (sorted, de-duplicated)."""
    if not text:
        return []
    patterns = _vocab()["skill_patterns"]
    return sorted(s for s, pat in patterns.items() if pat.search(text))


def synonyms_of(term: str) -> frozenset[str]:
    """All equivalent surface forms of a term (the term itself + known synonyms)."""
    if not term:
        return frozenset()
    t = term.strip().lower()
    return _vocab()["synonyms"].get(t, frozenset({t}))


def term_present(term: str, text: str) -> bool:
    """True if the term OR any of its synonyms/abbreviations appears in the text."""
    if not (term and text):
        return False
    low = text.lower()
    for form in synonyms_of(term):
        if re.search(r"(?<![a-z0-9+#.])" + re.escape(form) + r"(?![a-z0-9+#])", low):
            return True
    return False
