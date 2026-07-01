---
description: "Task list for ATS Score Checker implementation"
---

# Tasks: ATS Score Checker

**Input**: Design documents from `specs/003-ats-score-checker/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ats-check.md, quickstart.md

**Tests**: REQUIRED — the project constitution (Principle II, NON-NEGOTIABLE) mandates a unit test and an integration test for every backend endpoint, and component tests for new frontend interaction paths. Test tasks are included and follow TDD (write → fail → implement → pass).

**Organization**: Tasks are grouped by user story. Paths follow the existing repo layout (`Backend/...`, `frontend/src/...`) per plan.md.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on incomplete tasks)
- **[Story]**: US1, US2, US3, US4 (Setup/Foundational/Polish have no story label)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Configuration and test fixtures needed before implementation

- [X] T001 Add ATS scoring config to `Backend/app/config.py` — non-secret settings `ats_category_weights` (dict), `ats_min_words`, `ats_max_pages`, `ats_action_verbs` source; with sane defaults
- [X] T002 [P] Document the new ATS env vars (weights/thresholds) with placeholder values in `Backend/.env.example`
- [X] T003 [P] Add CV test fixtures in `Backend/tests/fixtures/` — `clean_cv.pdf`, `image_only_cv.pdf`, `missing_skills_cv.pdf`, `nonstandard_headings_cv.pdf` (used by US1/US3 tests)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Schema + model + response-shape changes every story depends on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 Create Alembic migration `Backend/migrations/versions/019_ats_check.py` — alter `cv_sessions.jd_text` to nullable; add `analysis_mode` (String(20), NOT NULL, server_default `'job_match'`), `ats_score` (Float, nullable), `ats_result` (Text, nullable), `from_stored_cv` (Boolean, NOT NULL, server_default `false`); downgrade drops the 4 columns and restores `jd_text NOT NULL`
- [X] T005 Update `CVSession` model in `Backend/models/user.py` — add `analysis_mode`, `ats_score`, `ats_result`, `from_stored_cv` columns and a `has_ats_result` property (mirrors `has_gap_report`)
- [X] T006 [P] Update response schemas in `Backend/models/schemas.py` — make `CVUploadResponse.match_score` Optional and add `analysis_mode` + `ats_score`; add `analysis_mode`, `ats_score`, `has_ats_result` to `CVSessionResponse`; add new `AtsResultResponse` (categories, issues, keyword_coverage per data-model.md)
- [X] T007 [P] Add ATS result TypeScript types to `frontend/src/api.ts` — `AtsCategory`, `AtsIssue`, `AtsKeywordCoverage`, `AtsResult`; extend `CVUploadResponse` (`analysis_mode`, optional `match_score`, `ats_score`); extend `CVSessionResponse`/history type with `analysis_mode` + `ats_score`

**Checkpoint**: Migration applies cleanly (`alembic upgrade head`), existing job-match sessions still load (FR-024). User story work can now begin.

---

## Phase 3: User Story 1 - CV-only ATS readiness check (Priority: P1) 🎯 MVP

**Goal**: Produce a complete ATS result (0–100 score, category breakdown, prioritized issues + recommendations) from a CV alone, persisted and retrievable, with quota and leakage controls.

**Independent Test**: `POST /cv/upload` with a PDF and `analysis_mode=ats_check` and **no** `jd_text` returns an `ats_score` and issues; `GET /cv/{id}/ats` returns the stored result; another user gets 403; deleting the session removes the PDF from disk.

### Tests for User Story 1 (write first, ensure they FAIL) ⚠️

- [X] T008 [P] [US1] Unit tests for the deterministic engine in `Backend/tests/unit/test_ats_checker.py` — scoring math/weighting, standard-section detection, non-standard-heading detection (FR-010a), contact email/phone regex (FR-011), action-verb + quantified-achievement detection (FR-013), date-consistency (FR-014), parseability on image-only text, and that the no-JD path produces `keyword_coverage = null`
- [X] T009 [US1] Integration tests in `Backend/tests/integration/test_ats_check.py` — CV-only upload returns `ats_score` + issues; `GET /cv/{id}/ats` (200) and 202-when-pending; owner-only 403 (FR-029); **quota boundary (R5)**: free user limit=2 → 2 succeed, 3rd → 429, invalid/blocked attempt consumes no slot (FR-025/026); `DELETE /cv/{id}` removes the uploaded PDF file from `uploads/` (leakage fix)

### Implementation for User Story 1

- [X] T010 [US1] Extend `Backend/services/cv_parser.py` — expose PyMuPDF layout/font/image signals (per-page text length, image-vs-text ratio, text-block geometry/column count, font names, link annotations, header/footer zones) for the engine; keep `parse_cv` backward-compatible
- [X] T011 [US1] Implement deterministic engine `Backend/services/ats_checker.py` — categories: parseability, sections, headings, contact, formatting, unfriendly_elements (FR-012a), content_quality, dates; returns weighted 0–100 `overall_score` + severity-ranked `issues` (FR-016) + per-category confidence tier; never calls an LLM (FR-027/032)
- [X] T012 [US1] Make `POST /cv/upload` mode-aware in `Backend/routers/cv.py` — accept `analysis_mode` (default `job_match`) + optional `jd_text`; for `ats_check`: enforce quota **before** row insert (`count >= limit`, R5), create session, run `ats_checker`, persist `ats_score`/`ats_result`, return `CVUploadResponse`; guard so `compute_match_score`/`store_embeddings` are NOT called on the no-JD path (R3)
- [X] T013 [US1] Add `GET /cv/{session_id}/ats` in `Backend/routers/cv.py` — owner-only (`require_ownership`), returns `AtsResultResponse`, 202 when not yet computed
- [X] T014 [US1] Fix `DELETE /cv/{session_id}` in `Backend/routers/cv.py` — also delete the uploaded file `uploads/<cv_filename>` (existence-guarded) alongside the row/cache/embeddings (leakage fix; FR-029/031)
- [X] T015 [P] [US1] Create `frontend/src/components/AtsResultView.tsx` — score gauge (0–100), category breakdown with confidence, prioritized issues each with its recommendation (keyword-coverage section stubbed, filled in US3)
- [X] T016 [US1] Branch `frontend/src/pages/Results.tsx` on `analysis_mode` — render `AtsResultView` for `ats_check` sessions; existing job-match stream untouched for `job_match`
- [X] T017 [US1] Add `frontend/src/api.ts` calls — `uploadCV` accepts optional `jd` + `analysis_mode`; add `getAtsResult(sessionId)`

**Checkpoint**: ATS Check works end-to-end from a CV alone (API + result view); quota, ownership, and file-deletion verified. MVP demoable.

---

## Phase 4: User Story 2 - Choose an analysis mode (subsections) (Priority: P1)

**Goal**: Present selectable subsections inside the Analyze CV area; selecting a mode shows only its inputs (JD optional for ATS, required for Job Match); switching modes preserves an uploaded CV.

**Independent Test**: Open Analyze CV → both modes shown with descriptions; selecting ATS Check makes the run control enabled with only a CV; selecting Job Match requires CV + JD; switching modes keeps the uploaded CV.

### Tests for User Story 2 (write first, ensure they FAIL) ⚠️

- [X] T018 [P] [US2] Component test in `frontend/src/pages/__tests__/Upload.test.tsx` — mode chooser renders both modes; ATS mode enables submit with CV only (no JD); Job Match requires JD; switching modes retains the selected/uploaded CV (FR-001–004)

### Implementation for User Story 2

- [X] T019 [US2] Add the mode chooser ("subsections") to `frontend/src/pages/Upload.tsx` — selectable ATS Check / Job Match cards with one-line descriptions; track selected mode in state
- [X] T020 [US2] Make inputs mode-aware in `frontend/src/pages/Upload.tsx` — JD field marked optional + submit enabled with CV only in ATS mode; JD required in Job Match mode; preserve `file`/stored-CV selection across mode switches; pass `analysis_mode` (and optional `jd`) to the upload call
- [X] T021 [US2] Update step indicator / copy in `frontend/src/pages/Upload.tsx` so the "Job Description" step reflects optional vs required per mode

**Checkpoint**: A user can pick either subsection and run the matching flow; US1 + US2 together deliver the full P1 experience in the UI.

---

## Phase 5: User Story 3 - ATS check with a job description (keyword coverage) (Priority: P2)

**Goal**: When a JD is supplied in ATS Check mode, add keyword/skill coverage (matched + missing) via the AI path, shown distinctly from CV-only categories, degrading gracefully when AI is down and never charging a degraded run.

**Independent Test**: ATS Check with a CV + JD returns `keyword_coverage` (matched/missing); with no JD the section is absent; with AI unavailable the structural score still returns and `ai_sections_available=false` with no quota charge.

### Tests for User Story 3 (write first, ensure they FAIL) ⚠️

- [X] T022 [P] [US3] Unit tests in `Backend/tests/unit/test_ats_keywords.py` — JD keyword extraction + matched/missing computation; empty/junk JD treated as no-JD (FR-019); fallback payload when AI raises
- [X] T023 [US3] Integration tests in `Backend/tests/integration/test_ats_check.py` (extend) — ATS+JD upload produces `keyword_coverage`; `GET /analyze/ats-keywords` streams coverage; AI-failure path sets `ai_sections_available=false` and does NOT consume quota (FR-028); no-JD ATS omits coverage

### Implementation for User Story 3

- [X] T024 [P] [US3] Add keyword-coverage prompt template in `Backend/rag/prompts.py` (JD keyword extraction + coverage assessment)
- [X] T025 [US3] Implement `Backend/services/ats_keywords.py` — AI-assisted matched/missing keyword coverage + optional written suggestions; raises-safe with a graceful fallback payload (FR-028); estimates tokens from `cv_text`(+JD)
- [ ] T026 ⏸️ DEFERRED (gold-plating beyond matched/missing FRs; see contracts §4) — [US3] Add `GET /analyze/ats-keywords` SSE in `Backend/routers/analysis.py` — reuse the existing query-token auth + JTI/`sessions_revoked_at` checks; stream suggestions then `event: keyword_coverage`; on failure emit `event: ai_unavailable` and do not charge; 400 if session has no JD
- [X] T027 [US3] In `Backend/routers/cv.py` ATS path, when `jd_text` present: compute `match_score`, attempt keyword coverage, merge into `ats_result` (set `ai_sections_available`/`keyword_coverage.available`), log tokens via `token_tracker` with `operation_type="ats_keyword_coverage"`
- [X] T028 [P] [US3] Fill the keyword-coverage section in `frontend/src/components/AtsResultView.tsx` — matched/missing lists shown distinctly from structural categories (FR-018); "AI unavailable" state when degraded
- [ ] T029 ⏸️ DEFERRED (gold-plating beyond matched/missing FRs; see contracts §4) — [US3] Add the `/analyze/ats-keywords` SSE client wiring in `frontend/src/pages/Results.tsx` / `frontend/src/api.ts` for ATS sessions that have a JD

**Checkpoint**: ATS Check with a JD adds keyword coverage; resilience and quota-non-charge on AI failure verified.

---

## Phase 6: User Story 4 - Preserve the existing job-match analysis (Priority: P2)

**Goal**: Job Match Analysis (CV + JD) keeps producing match score, skill gaps, interview questions, roadmap with zero regression; history distinguishes ATS vs job-match.

**Independent Test**: Job Match mode with CV + JD yields the same outputs as before; pre-existing sessions remain viewable; history shows a mode badge + ATS score where applicable.

### Tests for User Story 4 (write first, ensure they FAIL) ⚠️

- [X] T030 [P] [US4] Regression integration test in `Backend/tests/integration/test_ats_check.py` (extend) — `job_match` upload still requires JD, computes `match_score`, stores embeddings, and `/analyze` SSE + `/cv/{id}/analysis` behave unchanged (FR-023); a pre-existing (`analysis_mode='job_match'`) session loads (FR-024)

### Implementation for User Story 4

- [X] T031 [US4] Verify/keep `Backend/routers/analysis.py` `/analyze` and `Backend/routers/cv.py` job-match path unchanged for `job_match`; confirm `GET /cv/sessions` now returns `analysis_mode`/`ats_score`/`has_ats_result` (FR-021)
- [X] T032 [US4] Show mode badge + ATS score in `frontend/src/pages/History.tsx` session list (distinguish ATS vs job-match results — FR-021)

**Checkpoint**: Both modes coexist; no job-match regression; history is mode-aware.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Leakage/retention guarantees spanning modes, report export, and final validation

- [X] T033 [P] Stored-CV deletion cascade — update `Backend/services/profile_service.py` `delete_stored_cv` to also delete the caller's `from_stored_cv = True` sessions (rows, files, embeddings, ATS results); cover with an integration test in `Backend/tests/integration/test_profile.py` (FR-031)
- [X] T034 Make `POST /cv/use-stored` mode-aware in `Backend/routers/cv.py` — accept `analysis_mode` + optional `jd_text`, set `from_stored_cv=True`, run the ATS path for `ats_check` (same quota/guards as T012)
- [X] T035 [P] Extend `Backend/services/report_generator.py` to render ATS score, category breakdown, issues/recommendations, and keyword coverage for `ats_check` sessions; keep export an authenticated owner-only attachment (no public URL — FR-022)
- [X] T036 [P] Add an admin-aggregate-only assertion test (no endpoint exposes CV content or individual ATS results — FR-030) in `Backend/tests/integration/test_admin.py`
- [X] T037 Run full validation — `pytest` (unit + integration) green, `cd frontend && npx tsc --noEmit` clean, and walk the `quickstart.md` acceptance checklist (SC-001…SC-012)

---

## Phase 8: User Story 5 - Meaningful score + strengths & next steps (Priority: P1)

**Goal**: Recalibrate the ATS score so it discriminates CV quality (every deduction traces to a real, named fault) and enrich the result with strengths, a prioritized "what to do next" summary, and a plain-language score explanation. No migration (the `ats_result` column is already JSON; new fields are additive). See research R8/R9.

**Independent Test**: A deliberately strong vs. weak CV score ≥ 25 points apart (SC-013); a years-only + no-phone CV is flagged for both (SC-016); every result shows strengths + next-steps + explanation, including an explicit "ATS-ready" state at high scores (SC-015); running the recalibrated engine on the user's real uploads yields deductions that each map to a named fault (SC-014).

### Tests for User Story 5 (write first, ensure they FAIL) ⚠️

- [X] T038 [P] [US5] Add fixtures to `Backend/tests/fixtures/sample_cvs.py` — a **weak CV** (missing sections, no metrics/quantified, no phone, decorative formatting) and signal fixtures for `table_like=True` and `multi_column=True`
- [X] T039 [US5] Extend unit tests in `Backend/tests/unit/test_ats_checker.py` — **score spread** strong vs weak ≥ 25 pts (SC-013); quantified detection rejects bare years but accepts `%`/`$`/`10k`/`3x`/`N+ years` (SC-016); contact rejects `YYYY–YYYY` date ranges as phones (SC-016); section detection is heading-anchored (a keyword only inside body text does NOT count); `table_like`/`multi_column` signals produce formatting deductions (FR-035); result always contains non-empty `strengths`, `next_steps`, `score_explanation`, and an "ATS-ready" next_steps message when there are no material faults (FR-036–039)

### Implementation for User Story 5

- [X] T040 [P] [US5] Add calibration thresholds to `Backend/app/config.py` (+ `Backend/.env.example`) — quantified/contact strictness knobs, score band cutoffs; non-secret
- [X] T041 [US5] Implement structural signals in `Backend/services/cv_parser.py` — compute `table_like` via PyMuPDF `find_tables()` (guarded for availability) and strengthen `multi_column` via body-text x-position clustering (replace the dead `table_like=False`)
- [X] T042 [US5] Recalibrate `Backend/services/ats_checker.py` detection — fix `_QUANTIFIED_RE` (no bare 4-digit years; require real metric), fix `_PHONE_RE` (reject date ranges; require ≥7-digit phone token), make section detection heading-anchored, and wire the new `table_like` into `_eval_formatting`; keep sub-scores graded so faults cost points (FR-033/034/035/040)
- [X] T043 [US5] Enrich `Backend/services/ats_checker.py` `evaluate()` output — add `strengths` (categories scoring ≥ 0.9, phrased positively), `next_steps` (top-N recommendations ranked by severity × weight, deduped; "ATS-ready" affirmation when none), and `score_explanation` (plain-language band + top drivers) (FR-036–039)
- [X] T044 [US5] Extend `AtsResultResponse` in `Backend/models/schemas.py` and the `GET /cv/{id}/ats` mapping in `Backend/routers/cv.py` — add `strengths`, `next_steps`, `score_explanation` (additive/defaulted; pre-US5 results deserialize cleanly)
- [X] T045 [P] [US5] Add `strengths`, `next_steps`, `score_explanation` to the `AtsResult` type in `frontend/src/api.ts`
- [X] T046 [US5] Render the enriched result in `frontend/src/components/AtsResultView.tsx` — a Strengths section, a "What to do next" section, and the score explanation near the gauge; explicit "ATS-ready" state when no material weaknesses (FR-036–039)
- [X] T047 [P] [US5] Add component test `frontend/src/pages/__tests__/AtsResultView.test.tsx` — asserts strengths, next-steps, and explanation render, and the ATS-ready state shows when issues are empty
- [X] T048 [US5] Real-CV verification — run the recalibrated engine on the user's actual uploads (e.g. `Backend/uploads/Mohamed Dahy CV.pdf`, `..._AI_Architect.pdf`); confirm each deduction maps to a named fault and the enriched output makes any high score informative (SC-014); record the observed scores

**Checkpoint**: ATS scores are earned and explainable; every result gives strengths + concrete next steps; verified on synthetic fixtures AND the real uploaded CVs.

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: no dependencies
- **Foundational (Phase 2)**: depends on Setup — **BLOCKS all user stories** (migration + model + schemas + FE types)
- **US1 (Phase 3)**: depends on Foundational — the MVP; delivers the deterministic engine other stories reuse
- **US2 (Phase 4)**: depends on Foundational; pairs with US1 for the full P1 UX (can be built in parallel with US1 backend, but its E2E demo needs T012/T016)
- **US3 (Phase 5)**: depends on US1 (reuses `ats_checker` + `ats_result` persistence + `AtsResultView`)
- **US4 (Phase 6)**: depends on Foundational only (mostly regression-guarding existing behavior)
- **Polish (Phase 7)**: depends on US1 (T033/T034 reuse the ATS path) and US3 (T035 renders coverage)
- **US5 (Phase 8)**: depends on US1 (recalibrates/enriches the shipped `ats_checker` + `AtsResultView`). Independent of US2/US3/US4 — can be done right after US1. No migration. Priority P1 (correctness fix), so schedule it ahead of the P2 stories if fixing the score is the immediate goal.

### Within each story

- Tests written first and failing → `cv_parser` signals → `ats_checker` → routers → frontend
- Models/schemas (Foundational) before services; services before endpoints; endpoints before UI wiring

### Parallel opportunities

- Setup: T002, T003 in parallel
- Foundational: T006 (schemas) and T007 (FE types) in parallel after T004/T005
- US1: T008 (unit) ∥ T009 (integration) while authoring; T015 (component) ∥ backend T010–T014
- US3: T022 ∥ T024; T028 (FE) ∥ backend T025–T027
- US5: T038 ∥ T040; T045/T047 (FE) ∥ backend T041–T044
- Polish: T033, T035, T036 in parallel

---

## Parallel Example: User Story 1

```bash
# Author the failing tests together:
Task: "Unit tests for ats_checker in Backend/tests/unit/test_ats_checker.py"      # T008
Task: "Integration tests in Backend/tests/integration/test_ats_check.py"          # T009

# Frontend result view can proceed alongside backend engine:
Task: "Create AtsResultView component in frontend/src/components/AtsResultView.tsx" # T015
```

---

## Implementation Strategy

### MVP first (US1)

1. Phase 1 Setup → 2. Phase 2 Foundational (migration/model/schemas) → 3. Phase 3 US1 → **STOP & validate** the CV-only ATS check via API + result view → demo.

### Incremental delivery

1. Setup + Foundational → foundation ready
2. US1 (backend ATS + result view) → validate via API → MVP
3. US2 (mode chooser) → full P1 UX in the UI
4. US3 (keyword coverage with JD) → validate resilience/quota
5. US4 (preserve job-match) → regression-verified coexistence
6. US5 (recalibrate + enrich the score) → validate on synthetic fixtures + real uploaded CVs
7. Polish (leakage cascade, use-stored, report export, admin assertion, full validation)

> **Note**: US5 is a P1 correctness fix that depends only on US1. If fixing the "always 98 / no detail" problem is the priority, do US5 immediately after US1/US2 — ahead of the P2 stories (US3/US4).

---

## Notes

- [P] = different files, no dependency on incomplete tasks
- Every backend endpoint task is paired with unit + integration coverage (Constitution II, non-negotiable)
- The quota boundary (T009, R5) and the no-charge-on-AI-failure case (T023) are explicit acceptance gates
- Commit after each task or logical group; do not skip the "tests fail first" step
- No new Docker services, secrets, or top-level directories (Constitution III/IV/VII)
