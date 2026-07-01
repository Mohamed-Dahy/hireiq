# Implementation Plan: ATS Score Checker

**Branch**: `003-ats-score-checker` | **Date**: 2026-07-01 (updated post-MVP for US5) | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `specs/003-ats-score-checker/spec.md`

## Summary

Reshape "Analyze CV" into a mode chooser and add a production ATS compatibility check (CV-only capable; JD optional adds keyword coverage), preserving the existing job-match analysis. The ATS structural engine is deterministic and AI-free; only keyword coverage + written suggestions use the LLM and degrade gracefully.

**Status**: Phases 1–4 (US1 CV-only ATS check + US2 mode chooser) are **implemented and verified** (24 ATS tests green, `tsc` clean). This revision adds **User Story 5 — score recalibration + richer guidance** (FR-033–FR-040), a P1 correctness fix: the shipped engine saturates near 98–100 and gives thin feedback. US3 (keyword coverage), US4 (preserve job-match), and Phase 7 polish remain.

## Technical Context

**Language/Version**: Python 3.11 (backend), TypeScript 5.x `strict: true` (frontend)
**Primary Dependencies**: FastAPI, SQLAlchemy 2.x, Alembic, Pydantic v2, PyMuPDF (`fitz`), spaCy, scikit-learn, sentence-transformers, LangChain + Groq (existing); React 18, Vite 5, Tailwind v3, Framer Motion, Vitest + Testing Library
**Storage**: PostgreSQL 16 (`cv_sessions`, migration head 019), Redis 7, ChromaDB, local `uploads/`
**Testing**: pytest (unit mock-free + integration real PG/Redis); Vitest + `tsc --noEmit`
**Target Platform**: Linux container via Docker Compose
**Project Type**: Web application (FastAPI backend + React SPA)
**Performance Goals**: deterministic ATS check within current analysis responsiveness (SC-007); recalibration adds no LLM call
**Constraints**: Secret-free, Docker-first, TS strict, structured errors, owner-only access, no public share links
**Scale/Scope**: small-to-medium single-developer project; <10k users
**NEEDS CLARIFICATION**: none — the scope decision (recalibrate + enrich, extend spec 003) was made with the user on 2026-07-01.

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript Strict | ✅ Pass | New result fields typed; no `any` |
| II. Test Discipline | ✅ Pass | US5 adds unit tests proving discrimination (strong vs weak CV) + accurate detection; component test for new result sections; no mocked DB |
| III. Docker-First | ✅ Pass | No new services; recalibration is code-only |
| IV. Secret-Free | ✅ Pass | New calibration thresholds go to `.env.example` only |
| V. Error Handling & Validation | ✅ Pass | Engine stays total (never raises); structured payload |
| VI. Spec-First | ✅ Pass | US5 added to spec before this plan |
| VII. Structure Fidelity | ✅ Pass | Changes confined to `services/`, `models/`, `pages/`, `components/`; no new dirs |

**Post-design re-check**: ✅ still passes — US5 refines existing modules and the `ats_result` payload shape (no schema/migration change needed: `ats_result` is already a JSON text column, so new fields require no migration). Complexity Tracking omitted.

## Project Structure

### Documentation (this feature)

```text
specs/003-ats-score-checker/
├── plan.md              ← this file (updated for US5)
├── spec.md              ← includes US5 + FR-033–FR-040 + SC-013–SC-016
├── research.md          ← R1–R7 (MVP) + R8 (recalibration) + R9 (enriched output)
├── data-model.md        ← ats_result JSON extended with strengths/next_steps/score_explanation
├── contracts/ats-check.md
├── quickstart.md        ← + US5 verification
└── tasks.md             ← T001–T037 (T001–T021 done); US5 tasks appended by /speckit-tasks
```

### Source Code (US5 changes — all refinements of shipped code)

```text
Backend/
├── app/config.py                 (add calibration thresholds: quantified/contact/section strictness, band cutoffs)
├── services/
│   ├── cv_parser.py              (IMPLEMENT the dead table_like signal + stronger multi-column detection via
│   │                              PyMuPDF find_tables()/block geometry)
│   └── ats_checker.py            (recalibrate: fix _QUANTIFIED_RE (no bare years), _PHONE_RE (no date ranges),
│                                  heading-anchored section detection, real formatting deductions, graded
│                                  sub-scores; ADD strengths[], next_steps[], score_explanation to evaluate())
├── models/schemas.py             (AtsResultResponse: add strengths, next_steps, score_explanation)
└── tests/
    ├── unit/test_ats_checker.py          (extend: strong-vs-weak spread ≥25pts; years-only+no-phone flagged;
    │                                      table/column now trigger; strengths/next_steps/explanation present)
    └── fixtures/sample_cvs.py            (add a weak CV fixture + a table/multi-column signal fixture)

frontend/src/
├── api.ts                        (AtsResult: add strengths, next_steps, score_explanation)
├── components/AtsResultView.tsx  (render Strengths, "What to do next", and score-explanation sections;
│                                  ATS-ready state when no material weaknesses)
└── pages/__tests__/AtsResultView.test.tsx  (new component test for the enriched sections)
```

**Structure Decision**: Web application; changes are in-place refinements. No migration (the `ats_result` JSON column absorbs the new fields), no new services, no new top-level directories.

## Key design decisions (US5 — see research.md R8/R9)

- **Recalibrate for discrimination (FR-033/034/040)**: replace binary/over-permissive checks with accurate, partially-graded ones. Concretely: quantified detection requires a real metric (%, currency, ×N, magnitudes/units, "N+ years/users/…") and excludes bare 4-digit years; contact requires a genuine phone token (≥7 digits, not a `YYYY–YYYY` range); section detection is heading-anchored (a standalone heading line matching a canonical synonym) not any substring. Weights unchanged (sum 1.0); discrimination now emerges from checks that actually find faults.
- **Implement the dead structural checks (FR-035)**: compute `table_like` (PyMuPDF `find_tables()` when available, else block-grid heuristic) and strengthen multi-column detection so parse-hostile layouts actually deduct.
- **Enrich the result (FR-036/037/038/039)**: `evaluate()` additionally returns `strengths` (categories scoring strongly, phrased positively), `next_steps` (top-N highest-impact recommendations, deduped from issues, ranked by severity×weight), and `score_explanation` (plain-language band + top drivers). When no material weaknesses exist, emit an explicit "ATS-ready" strengths-based result rather than an empty one.
- **No migration / no contract break**: new fields live inside the existing `ats_result` JSON and are additive on `AtsResultResponse`/`AtsResult` (optional, defaulted), so history and the shipped endpoints stay compatible.

## Phase notes

- Phase 0/1 for the MVP are complete (research R1–R7, data-model, contracts, quickstart). This revision **appends** R8/R9 to research.md, **extends** the `ats_result` shape in data-model.md, and **adds** US5 checks to quickstart.md — it does not rewrite prior artifacts.
- `/speckit-tasks` will append US5 implementation + test tasks (T038+) to tasks.md, ordered: fixtures → failing unit tests (spread + accurate detection + enriched fields) → `cv_parser` structural signals → `ats_checker` recalibration + enrichment → schema/api types → `AtsResultView` sections → component test → full validation (SC-013–SC-016).
