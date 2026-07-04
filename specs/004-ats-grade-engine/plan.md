# Implementation Plan: ATS-Grade Engine Upgrade

**Branch**: `004-ats-grade-engine` | **Date**: 2026-07-03 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/004-ats-grade-engine/spec.md`

## Summary

Upgrade the shipped ATS Check (spec 003) from an ATS-*readiness heuristic* toward a genuinely *ATS-grade* checker, across six user stories: **`.docx` support** (US1), a **deterministic structured parsing layer** that extracts the résumé record an ATS reads (US2), a **deterministic keyword-coverage fallback** so JD matching survives AI outages (US3), an **expert-rated calibration + re-validation harness** for the score (US4), **broad multi-industry skill/action-verb vocabularies** (US5), and a **richer, tailorable, iterable result** — point impact per issue/category, before→after examples, category drill-down, a target role/industry selector, a depth toggle, and re-analyze-after-edits (US6, the user's direct feedback).

Technical approach: keep the deterministic, AI-free, resilient core of 003 and extend it. One new backend dependency (`python-docx`); spaCy, scikit-learn, and sentence-transformers (already present) power NER-based parsing and the deterministic keyword fallback. Skill/verb vocabularies and the calibration set become **data files** (updatable without code changes). **No database migration** is required — the parsed record, per-issue point impacts/examples, sub-checks, and target role all ride inside the existing `cv_sessions.ats_result` JSON column, and the depth toggle is frontend-only. All spec-003 guarantees (determinism, graceful AI degradation, owner-only access, no leakage, explainability) are preserved as explicit non-regression requirements.

## Technical Context

**Language/Version**: Python 3.11 (backend), TypeScript 5.x `strict: true` (frontend)
**Primary Dependencies**: FastAPI, SQLAlchemy 2.x, Pydantic v2, PyMuPDF (PDF), **`python-docx` (NEW — Word parsing)**, spaCy `en_core_web_sm` (NER for parsing), scikit-learn + sentence-transformers (deterministic keyword fallback), LangChain + Groq (existing AI-assisted keyword path); React 18, Vite 5, Tailwind, Vitest
**Storage**: PostgreSQL 16 (existing `cv_sessions`; **no new migration**), Redis, ChromaDB, local `uploads/`, plus **data files** under `Backend/data/` (vocabularies, calibration set)
**Testing**: pytest (unit mock-free + integration real PG/Redis), Vitest + `tsc --noEmit`, plus a repeatable **score-validation harness** (US4)
**Target Platform**: Linux container via Docker Compose
**Project Type**: Web application (FastAPI backend + React SPA)
**Performance Goals**: end-to-end ATS Check stays within current responsiveness for a standard CV (FR-024); parsing + docx add no LLM call
**Constraints**: secret-free, Docker-first, TS strict, owner-only, no public share links, deterministic core, every deduction explainable
**Scale/Scope**: small-to-medium single-developer project; <10k users
**NEEDS CLARIFICATION**: none — calibration ground truth (expert-rated), result-detail scope, and user-control scope were all resolved in Clarify 2026-07-03.

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript Strict | ✅ Pass | New result fields, target-role selector, depth toggle all typed |
| II. Test Discipline | ✅ Pass | New parsing/vocab/keyword-fallback services get unit tests; docx upload + `/ats` payload + target-role get integration tests; US4 ships a repeatable validation harness; no mocked DB |
| III. Docker-First | ✅ Pass | One new pip dep (`python-docx`) added to `requirements.txt` + image rebuild; **no new service**; data files bundled in the image |
| IV. Secret-Free | ✅ Pass | Vocabularies + calibration set are non-secret data files; no new secrets |
| V. Error Handling & Validation | ✅ Pass | docx/corrupt/password-protected files return structured errors (FR-003); engine stays total |
| VI. Spec-First | ✅ Pass | Plan follows the clarified spec |
| VII. Structure Fidelity | ✅ Pass | New code in `services/`, data in `data/`, harness in `scripts/`, tests in `tests/`; no new top-level dirs |

**Post-design re-check**: ✅ still passes — no schema/migration, no new service, and the design confines changes to existing layers. Complexity Tracking omitted.

## Project Structure

### Documentation (this feature)

```text
specs/004-ats-grade-engine/
├── plan.md              ← this file
├── spec.md              ← clarified (US1–US6, FR-001…FR-031, SC-001…SC-014)
├── research.md          ← Phase 0 (R1…R7)
├── data-model.md        ← Phase 1 (ParsedResumeRecord, extended ats_result JSON, TargetRole)
├── contracts/ats-grade.md ← Phase 1 (docx intake, target-role, richer /ats payload)
├── quickstart.md        ← Phase 1 (run/verify incl. validation harness)
├── checklists/requirements.md
└── tasks.md             ← Phase 2 (/speckit-tasks)
```

### Source Code (additions and changes)

```text
Backend/
├── requirements.txt              (add python-docx)
├── data/
│   ├── vocab/
│   │   ├── action_verbs.txt      (broad, multi-industry action verbs — US5)
│   │   ├── skills.json           (multi-industry skills taxonomy — US5)
│   │   └── keyword_synonyms.json (synonym/abbreviation map — US3 fallback)
│   └── ats_calibration/
│       ├── labeled/              (expert-rated sample CVs — US4)
│       └── labels.json           (filename → ATS-friendly|problematic + notes)
├── services/
│   ├── document_loader.py        (new: unified text+signals from PDF or DOCX; dispatch layer)
│   ├── cv_parser.py              (modify: delegate PDF to existing path; expose docx signals incl. tables/headings/images)
│   ├── resume_parser.py          (new: deterministic structured extraction — contact, experience, education, skills + confidence/gaps; US2; no LLM)
│   ├── ats_vocab.py              (new: load + query action-verb/skill/synonym vocabularies; US5)
│   ├── ats_checker.py            (modify: use vocab; add per-issue/-category point impact + before→after examples + sub-checks; fold parse-success into parseability; accept target_role weighting; US2/US5/US6)
│   └── ats_keywords.py           (modify: add deterministic fallback (vocab + TF-IDF/synonyms); AI stays primary; US3)
├── routers/cv.py                 (modify: accept .docx uploads + target_role param; enforce accepted formats; /ats returns richer payload; "what changed" vs prior session — US1/US6)
├── models/schemas.py             (modify: AtsResultResponse gains parsed_record, per-issue impact+example, category sub-checks, target_role; request gains target_role)
├── app/config.py                 (modify: vocab/calibration paths; recalibrated category weights)
├── scripts/
│   └── validate_ats_scoring.py   (new: run engine over labeled set; report group separation + pairwise ranking; US4 / FR-016)
└── tests/
    ├── unit/ (test_resume_parser.py, test_ats_vocab.py, test_document_loader.py, extend test_ats_checker.py, test_ats_keywords.py)
    └── integration/ (extend test_ats_check.py: docx upload, target_role, richer /ats payload, deterministic-keyword path)

frontend/src/
├── api.ts                        (modify: AtsResult gains parsed_record, issue.point_impact/example, category.sub_checks, target_role; upload accepts docx + targetRole)
├── pages/Upload.tsx              (modify: accept .docx; add optional target role/industry selector — US1/US6)
├── pages/Results.tsx             (modify: pass through; depth state)
└── components/AtsResultView.tsx  (modify: point impact per issue/category, before→after examples, expandable category drill-down, parsed-record "what an ATS reads" panel, quick/detailed depth toggle, "what changed" — US2/US6)
```

**Structure Decision**: Web application; in-place extension of the 003 ATS feature. No new migration, no new service, no new top-level directories.

## Key design decisions (Phase 0 — see research.md)

- **`.docx` via `python-docx`** behind a unified `document_loader` that returns the same `(text, signals)` shape the deterministic engine already consumes — so `ats_checker.evaluate()` stays format-agnostic. docx exposes tables/headings/images directly (R1).
- **Deterministic `resume_parser`** (spaCy NER + regex + section segmentation, no LLM) produces the ParsedResumeRecord with per-field confidence; low parse confidence feeds the parseability category (R2, US2/FR-008/009).
- **Deterministic keyword fallback** using the shared vocabulary + synonym map (and TF-IDF for JD term salience); AI-assisted path remains primary, deterministic guarantees availability (R3, US3).
- **Vocabularies as data files** loaded at startup and cached; updatable without code changes (R4, US5/FR-020).
- **Expert-rated calibration harness** (`scripts/validate_ats_scoring.py`) over a labeled set; tunes only category weights/thresholds in config; reports separation + ranking so regressions are caught (R5, US4). Ground truth = expert rating (decided in Clarify), **not** live-ATS or parser labels.
- **Richer result, no migration**: point impact = category weight × sub-score deduction; before→after examples are per-issue static templates; sub-checks are the already-computed category signals surfaced; target role selects a vocabulary/weight profile. All persisted inside the existing `ats_result` JSON; depth toggle is a pure frontend view over the full payload; "what changed" diffs against the user's prior ATS session (R6, US6).
- **Non-regression**: 003's deterministic scoring, graceful degradation, owner-only access, no-leakage, and explainability are preserved and re-verified (R7, FR-022/023/024).

## Phase 2 note

`/speckit-tasks` will generate `tasks.md`. Suggested slicing follows spec priority: **US1 (docx)** and **US6 (richer result + controls)** are P1 and highest user value; **US2 (parsing)** is P1 and foundational for the parsed-record view; then **US3 (keyword fallback)**, **US5 (vocab)**, **US4 (calibration)** as P2/P3. Vocabulary (US5) is a shared dependency of US2/US3/US6, so its data files land early. Each story keeps TDD ordering (failing tests → implementation) and the US4 validation harness doubles as the calibration acceptance gate.

**Risk & sizing notes for task generation:**
- **US2 (parsing) and US4 (calibration) are the risk-carrying stories** — do not let a flat task list make them look the same size as docx/vocab. US2 needs buffer (structured extraction is inherently fuzzy); design `resume_parser` core to be **testable without the spaCy model** (NER is an optional enhancer, per R2) so its TDD loop runs locally.
- **US4 must include an explicit "assemble + expert-label the calibration CV set" task** — sourcing/labeling real CVs is real work, not a given, and blocks the harness (FR-016) and SC-005.
- **`ats_checker.evaluate()` gains one input**: an `overall_parse_confidence` signal (from `resume_parser`) so parseability reflects real parse success (FR-008). This is a small `signals`-key/parameter addition — "format-agnostic" still holds, but note it in the US2 tasks.
- **Ops**: `python-docx` is a new dep and the spaCy model install already exists in the Dockerfile — the `.docx` story requires a `docker-compose up --build`, and there is **no migration** to run.
