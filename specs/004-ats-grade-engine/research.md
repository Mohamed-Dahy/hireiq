# Phase 0 Research: ATS-Grade Engine Upgrade

**Feature**: `004-ats-grade-engine` | **Date**: 2026-07-03

Builds on spec 003's shipped ATS Check. Every decision preserves the 003 core (deterministic, AI-free structural scoring; graceful AI degradation; owner-only; no leakage; explainable). One new dependency (`python-docx`); everything else reuses the existing stack.

---

## R1. `.docx` support (US1)

**Decision**: Add `python-docx` and a new `services/document_loader.py` that dispatches by format and returns the **same `(text, signals)` shape** `ats_checker.evaluate()` already consumes. PDF continues through the existing PyMuPDF path in `cv_parser`; `.docx` is read via `python-docx`.

**Rationale**: `ats_checker.evaluate(text, signals)` is already format-agnostic, so the only new work is producing a docx signal set. `python-docx` exposes exactly the signals the engine wants: `doc.tables` → `table_like` (trivial and *more reliable* than the PDF heuristic), heading styles → section detection, `doc.inline_shapes`/embedded images → image signal, run fonts → font check, paragraph text → text + non-ascii ratio. Multi-column is rare/unreliable in docx and is treated as not-detected (documented).

**Format gating**: accept PDF (`%PDF` magic) and DOCX (`PK\x03\x04` zip magic **and** a readable Word package). Reject everything else (legacy `.doc`, `.rtf`, `.txt`, images) with a structured message listing accepted formats, before consuming quota (FR-002). Corrupt/password-protected/mismatched files raise a clean "cannot read this file" error (FR-003).

**Alternatives considered**: LibreOffice/`unoconv` docx→PDF conversion (rejected — heavy new service, violates Docker-simplicity); parsing the raw OOXML zip by hand (rejected — `python-docx` is the maintained, minimal option).

---

## R2. Deterministic structured parsing (US2)

**Decision**: New `services/resume_parser.py` extracts a **ParsedResumeRecord** — contact (name, email, phone, links), work-experience entries (role, employer, dates), education entries, skills — each with an extraction‑confidence and a "could not extract" flag. Uses spaCy `en_core_web_sm` (already a dep) for PERSON/ORG/DATE entities + regex (email/phone/URL) + section segmentation (heading-anchored, reusing 003's approach). **No LLM** (FR-009).

**Rationale**: This is the capability that makes the checker "ATS-grade" — showing *what an ATS reads* and its gaps. spaCy NER + section boundaries + date regex are enough to assemble experience/education entries and detect missing fields (a role with no date range, an unreadable skills block). Confidence is heuristic (fields found / expected).

**spaCy is an OPTIONAL enhancer, not a hard dependency of the parser.** The `en_core_web_sm` model is installed in the Docker image (`Backend/Dockerfile`) and lazy-loaded (as `cv_parser` already does), but is **not** present in a bare local shell. Therefore `resume_parser` MUST be designed so its core extraction (email/phone/URL regex, heading-anchored section segmentation, date-range regex, skills-vocabulary matching) works **without** the model, and NER is layered on top only to improve name/employer/institution detection — degrading gracefully (never raising) when the model is absent. This keeps US2's TDD loop runnable locally (like the rest of the suite) and keeps the parser resilient (parity with the 003 "never crashes" principle). Full-fidelity NER extraction is validated in the Docker environment where the model exists.

**Feeds parseability (FR-008)**: overall parse confidence contributes to the `parseability` category — a CV whose key records can't be assembled scores lower there, with the reason named. This replaces part of 003's proxy check with a real "did it actually parse" signal.

**Honesty (per Clarify)**: the record is a **best-effort** extraction reflecting *this* parser — not a claim about how a specific proprietary ATS parses (FR-006).

**Alternatives considered**: full ML resume-parser model (rejected — scope/opacity/privacy; violates determinism); LLM extraction (rejected — FR-009 privacy + non-determinism).

---

## R3. Deterministic keyword-coverage fallback (US3)

**Decision**: Extend `services/ats_keywords.py` with a deterministic path: extract salient JD terms (skills-vocabulary matches + TF-IDF/noun-phrase salience via scikit-learn, already a dep), then match against the CV with **synonym/abbreviation awareness** from a maintained synonym map. The AI-assisted path stays primary when available; the deterministic path guarantees availability (FR-010/011). Coverage is marked available if **either** path succeeds; unavailable only if both fail.

**Rationale**: 003's coverage silently vanished during AI outages. A deterministic fallback makes it dependable and sends less CV data to the external AI. Synonym awareness (e.g. "k8s"↔"kubernetes", "RN"↔"registered nurse") keeps it useful rather than exact-string only (FR-012).

**Alternatives considered**: embeddings-only similarity (usable via sentence-transformers, but heavier and fuzzier for discrete keyword match — kept as a possible enhancement, not the primary fallback).

---

## R4. Broad multi-industry vocabularies (US5)

**Decision**: Move skill/action-verb recognition out of hardcoded Python lists into **data files** under `Backend/data/vocab/`: `action_verbs.txt`, `skills.json` (multi-industry), `keyword_synonyms.json`. A new `services/ats_vocab.py` loads + caches them at startup and serves lookups to `ats_checker`, `resume_parser`, and `ats_keywords`. Files are updatable without touching scoring logic (FR-020).

**Rationale**: 003's ~26-verb list and tiny skills set biased results toward tech and mislabeled non-technical CVs. Broad vocabularies (curated and/or seeded from an open taxonomy such as ESCO/O*NET/EMSI-style skill lists) make feedback correct across fields. Broadening MUST NOT suppress genuine weaknesses — the "few/no verbs or skills" checks still fire on truly weak CVs (FR-021).

**Alternatives considered**: an NLP skill-extraction model (rejected for now — heavier; a maintained vocabulary is simpler, transparent, and updatable).

---

## R5. Expert-rated calibration + validation harness (US4)

**Decision**: Assemble a modest **expert-rated validation set** under `Backend/data/ats_calibration/` (`labeled/` CVs + `labels.json` marking ATS-friendly | ATS-problematic). Add `scripts/validate_ats_scoring.py` that scores the set and reports **group separation** (mean gap) and **pairwise ranking accuracy**, asserting the SC-005 targets. Calibration then tunes only category weights/thresholds in `config.py`.

**Rationale (decided in Clarify 2026-07-03)**: Ground truth = **expert human rating**, the achievable/verifiable option. The spec explicitly does **not** claim calibration against live proprietary-ATS outcomes (unobservable for a solo team, and circular). Tuning only weights preserves explainability (FR-015) — no unexplained score adjustments. The harness is the repeatable regression gate (FR-016) and doubles as the US4 acceptance test.

**Alternatives considered**: open-source-parser-based labels (closer to real behavior, larger scope — **deferred** to a future iteration); a trained ML scorer (rejected — opacity breaks explainability).

---

## R6. Richer, tailorable, iterable result (US6) — no migration

**Decision**: Extend the result payload **inside the existing `ats_result` JSON** (no DB migration):
- **Point impact** per issue and per category = category weight × sub-score deduction, surfaced numerically (FR-025).
- **Before→after example** per issue = a static, per-issue-type template (illustrative, never fabricating the user's content) (FR-026).
- **Sub-checks** = the individual signals the engine already computes per category, surfaced for drill-down (FR-027).
- **Target role/industry** = optional upload param selecting a vocabulary/weight profile that tailors which skills/keywords/checks are relevant; sensible default when unset (FR-028). Persisted in `ats_result`.
- **Depth toggle** = pure frontend view (summary vs full) over the same payload — no backend change (FR-029).
- **Re-analyze after edits** = user re-uploads edited CV (existing flow → new session); "what changed" diffs the new score/issues against the user's most recent prior ATS session (best-effort) (FR-030).

**Rationale**: Directly addresses the user's "results too vague / not enough options" feedback while keeping everything deterministic and explainable (FR-031). Riding the JSON column avoids a migration and keeps historical results readable (they simply lack the new fields).

---

## R7. Non-regression & performance (FR-022/023/024)

**Decision**: All 003 behaviors are preserved and re-verified: deterministic structural scoring, graceful AI degradation, owner-only `/ats`, no public share links, admin aggregate-only, delete-removes-file + stored-CV cascade, and every deduction mapping to a named fault. Pre-004 results remain viewable (new fields optional/defaulted). The added parsing + docx work stays within current responsiveness (no LLM added to the structural/parse path; spaCy NER is local and bounded).

---

## Summary of decisions

| # | Decision |
|---|----------|
| R1 | `.docx` via `python-docx` behind a `document_loader`; engine stays format-agnostic; strict format gating |
| R2 | Deterministic `resume_parser` (spaCy NER + regex + sections); parse confidence feeds parseability; best-effort, no LLM |
| R3 | Deterministic keyword fallback (vocab + synonyms + TF-IDF); AI stays primary; available if either works |
| R4 | Skill/verb/synonym vocabularies as updatable data files via `ats_vocab` |
| R5 | Expert-rated calibration set + `validate_ats_scoring.py` harness; tune weights only; parser-based labels deferred |
| R6 | Richer result (point impact, examples, sub-checks, target role, depth, what-changed) inside existing `ats_result` JSON — no migration |
| R7 | All 003 guarantees preserved and re-verified; no LLM added to the structural/parse path |
