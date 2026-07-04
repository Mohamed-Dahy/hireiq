---
description: "Task list for ATS-Grade Engine Upgrade"
---

# Tasks: ATS-Grade Engine Upgrade

**Input**: Design documents from `specs/004-ats-grade-engine/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ats-grade.md, quickstart.md

**Tests**: REQUIRED — constitution Principle II (NON-NEGOTIABLE) mandates unit + integration tests for every backend endpoint and component tests for new frontend interaction paths. TDD ordering (write → fail → implement → pass).

**Organization**: Tasks grouped by user story. Paths follow the existing repo layout (`Backend/...`, `frontend/src/...`).

**Key constraints from the plan**: NO database migration (new data rides in `cv_sessions.ats_result` JSON); no new service; one new dependency (`python-docx`). The spaCy `en_core_web_sm` model exists in Docker but NOT in a bare local shell — so `resume_parser`'s core must be testable without it (NER is an optional enhancer).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on incomplete tasks)
- **[Story]**: US1–US6 (Setup/Foundational/Polish have no story label)

---

## Phase 1: Setup (Shared Infrastructure)

- [X] T001 Add `python-docx` to `Backend/requirements.txt` (new dependency for US1; note `docker-compose up --build` required — no migration)
- [X] T002 [P] Create data directories + config paths in `Backend/app/config.py` — `ats_vocab_dir` (`Backend/data/vocab/`), `ats_calibration_dir` (`Backend/data/ats_calibration/`); create the dirs with a `.gitkeep`
- [X] T003 [P] Add test fixtures in `Backend/tests/fixtures/` — a small valid `sample_cv.docx`, a corrupt/renamed file, and text fixtures for parsing (contact/experience/education/skills variants incl. an unparseable-entry case)

---

## Phase 2: Foundational (Blocking Prerequisites)

**⚠️ CRITICAL**: Shared vocabulary + payload schema must exist before the stories that consume them (US2/US3/US5/US6).

- [X] T004 Implement `Backend/services/ats_vocab.py` — load + cache `action_verbs.txt`, `skills.json`, `keyword_synonyms.json` at startup; expose `is_action_verb()`, `match_skills(text)`, `synonyms_of(term)`; degrade to empty vocab (never crash) if a file is missing
- [X] T005 Seed baseline vocabulary data files — `Backend/data/vocab/action_verbs.txt`, `skills.json`, `keyword_synonyms.json` (broad starter set; expanded to full multi-industry in US5)
- [X] T006 Extend response/request schemas in `Backend/models/schemas.py` — `AtsResultResponse` gains `parsed_record`, `target_role`, `changed_since_previous`; category schema gains `point_impact` + `sub_checks`; issue schema gains `point_impact` + `example`; `keyword_coverage` gains `source`; upload request gains optional `target_role`. All additive/defaulted (pre-004 results deserialize cleanly)
- [X] T007 [P] Extend `frontend/src/api.ts` types — `AtsResult` gains `parsed_record`, `target_role`, `changed_since_previous`; `AtsCategory` gains `point_impact`/`sub_checks`; `AtsIssue` gains `point_impact`/`example`; `AtsKeywordCoverage` gains `source`; `uploadCV`/`useStoredCv` accept optional `targetRole` and `.docx`

**Checkpoint**: vocab loads, schemas compile, `tsc` clean. Stories can begin.

---

## Phase 3: User Story 1 - `.docx` support (Priority: P1) 🎯

**Goal**: Accept Word `.docx` CVs and produce an equivalent ATS result to PDF.

**Independent Test**: Upload a `.docx` CV (no JD) → full result; upload a corrupt/unsupported file → clear rejection, no quota spent.

### Tests (write first) ⚠️

- [ ] T008 [P] [US1] Unit tests `Backend/tests/unit/test_document_loader.py` — docx → text + signals (tables→`table_like`, headings, images, fonts, non_ascii); PDF path unchanged; corrupt/password-protected/renamed file raises a clean error
- [ ] T009 [US1] Integration test `Backend/tests/integration/test_ats_check.py` (extend) — `.docx` upload in `ats_check` mode returns `ats_score` + full result; unsupported type → 422 with accepted-formats message and NO quota consumed (patch parser to avoid heavy parse)

### Implementation

- [ ] T010 [US1] Create `Backend/services/document_loader.py` — dispatch by format; return the same `(text, signals)` shape `ats_checker.evaluate()` consumes; DOCX via `python-docx`
- [ ] T011 [US1] Extend `Backend/services/cv_parser.py` — expose docx signal extraction (paragraphs→text, `doc.tables`→`table_like`, heading styles→sections, images→image signal, run fonts); keep PDF path intact and `parse_cv` backward-compatible
- [ ] T012 [US1] Make `Backend/routers/cv.py` upload/use-stored accept `.docx` — format gating via magic bytes (`%PDF` / `PK\x03\x04` + Word package check), reject others with 422 before quota; route to `document_loader`
- [ ] T013 [P] [US1] Update `frontend/src/pages/Upload.tsx` — accept `.docx` in the file input/drop zone and accepted-format copy

**Checkpoint**: docx CVs work end-to-end, equivalent to PDF.

---

## Phase 4: User Story 6 - Richer, tailorable result (Priority: P1) 🎯

**Goal**: Point impact per issue/category, before→after examples, category drill-down, target role/industry selector, depth toggle, re-analyze-after-edits. (Directly addresses "results too vague / not enough options".)

**Independent Test**: A result shows point impacts + examples + expandable sub-checks; changing target role shifts relevant skills/keywords; depth toggles summary↔full; re-running after a fix raises the score and shows what changed.

### Tests (write first) ⚠️

- [ ] T014 [P] [US6] Extend `Backend/tests/unit/test_ats_checker.py` — **category** `point_impact` is exact and sums to `100 − score`; **per-issue** `point_impact` is an indicative apportionment (not additive-exact); every issue has an `example`; every category exposes `sub_checks`
- [ ] T015 [US6] Extend `Backend/tests/integration/test_ats_check.py` — `target_role` accepted on upload and echoed in `/ats`; richer payload present; `changed_since_previous` populated on a second run for the same user (null when no prior)
- [ ] T016 [P] [US6] Component test `frontend/src/components/__tests__/AtsResultView.test.tsx` (extend) — renders per-issue point impact + before→after example, expandable category sub-checks, and the depth toggle (summary vs full)

### Implementation

- [ ] T017 [US6] Extend `Backend/services/ats_checker.py` — compute category `point_impact` (exact = weight×(1−score)×100), per-issue apportioned impact, attach `example` per issue-type (static templates), surface `sub_checks` per category, and apply an optional `target_role` weight/vocabulary profile
- [ ] T018 [US6] Update `Backend/routers/cv.py` — accept `target_role`, persist it in `ats_result`, and compute `changed_since_previous` by diffing against the user's most recent prior `ats_check` session (best-effort)
- [ ] T019 [US6] Update `frontend/src/components/AtsResultView.tsx` — per-issue point impact + before→after example, expandable category drill-down, quick/detailed **depth toggle**, and a "what changed" banner
- [ ] T020 [P] [US6] Add an optional **target role/industry** selector to `frontend/src/pages/Upload.tsx` and pass it through the upload call

**Checkpoint**: the result is concrete, explainable, tailorable, and iterable.

---

## Phase 5: User Story 2 - Structured parsing "what an ATS reads" (Priority: P1) ⚠️ risk-heavy — allow buffer

**Goal**: Deterministically extract contact / experience / education / skills with confidence + gap flags; feed parse success into parseability.

**Independent Test**: Result shows the parsed record; a deliberately unparseable entry (missing dates / unreadable skills) is flagged and lowers parseability with a named reason.

### Tests (write first) ⚠️

- [ ] T021 [P] [US2] Unit tests `Backend/tests/unit/test_resume_parser.py` — contact (email/phone/URL) extraction, heading-anchored section segmentation, date-range parsing, skills-vocab matching, per-field confidence, and gap flags — **all runnable WITHOUT the spaCy model** (NER is an optional enhancer)
- [ ] T022 [US2] Integration test `Backend/tests/integration/test_ats_check.py` (extend) — `/ats` includes `parsed_record`; a CV with an unparseable experience entry surfaces the gap and reduces the parseability category with a named reason

### Implementation

- [ ] T023 [US2] Implement `Backend/services/resume_parser.py` — deterministic core (regex + section segmentation + `ats_vocab` skills) building the `ParsedResumeRecord` with confidence/gaps; layer spaCy NER (via a lazy loader like `cv_parser._get_nlp`) as an optional enhancer that degrades gracefully when the model is absent; no LLM
- [ ] T024 [US2] Wire parse success into scoring — pass `overall_parse_confidence` into `Backend/services/ats_checker.py` (`signals` key) so the parseability category reflects real parse success (FR-008); include the record in the persisted `ats_result`
- [ ] T025 [P] [US2] Add a "What an ATS reads from your CV" panel to `frontend/src/components/AtsResultView.tsx` — contact, experience/education entries, skills, and "could not extract" warnings

**Checkpoint**: users see the parsed record and its gaps; parseability is a real signal.

---

## Phase 6: User Story 3 - Deterministic keyword-coverage fallback (Priority: P2)

**Goal**: Matched/missing keywords always available — deterministic path when AI is down.

**Independent Test**: With AI disabled, ATS+JD still returns coverage (`source:"deterministic"`), not charged.

### Tests (write first) ⚠️

- [ ] T026 [P] [US3] Unit tests `Backend/tests/unit/test_ats_keywords.py` (extend) — deterministic coverage: JD salient-term extraction (vocab + TF-IDF), synonym/abbreviation matching, empty/junk JD → omitted
- [ ] T027 [US3] Integration test `Backend/tests/integration/test_ats_check.py` (extend) — AI patched to fail → coverage still returned with `source:"deterministic"`, `available:true`, and no `ats_keyword_coverage` token charged

### Implementation

- [ ] T028 [US3] Extend `Backend/services/ats_keywords.py` — deterministic fallback (vocab + `keyword_synonyms` + TF-IDF salience); AI-assisted stays primary; set `source` and `available` (true if either path works)
- [ ] T029 [US3] Update `Backend/routers/cv.py` merge + `frontend/src/components/AtsResultView.tsx` — surface `keyword_coverage.source` (AI-assisted vs deterministic) in the UI

**Checkpoint**: keyword coverage is dependable regardless of AI availability.

---

## Phase 7: User Story 5 - Broad multi-industry vocabularies (Priority: P2/P3)

**Goal**: Recognize skills/action verbs across industries, without suppressing genuine weaknesses.

**Independent Test**: CVs from ≥4 non-technical fields get real skills/verbs recognized; a genuinely weak CV is still flagged low.

### Tests (write first) ⚠️

- [ ] T030 [P] [US5] Unit tests `Backend/tests/unit/test_ats_vocab.py` + extend `test_ats_checker.py` — nursing/finance/marketing/trades sample texts recognize field skills/verbs; a no-skills/no-verbs CV is still flagged (no false "all good")

### Implementation

- [ ] T031 [US5] Expand `Backend/data/vocab/action_verbs.txt` + `skills.json` + `keyword_synonyms.json` to broad multi-industry coverage (curated and/or seeded from an open taxonomy); keep them data-only (no code change to scoring — FR-020)
- [ ] T032 [US5] Confirm `ats_checker`, `resume_parser`, and `ats_keywords` all consume `ats_vocab` (not local lists) and that the "few/no action verbs or skills" checks still fire on genuinely weak CVs (FR-021)

**Checkpoint**: feedback is accurate for any field; weaknesses still surface.

---

## Phase 8: User Story 4 - Validated (calibrated) score (Priority: P2) ⚠️ risk-heavy — sourcing labels is real work

**Goal**: The 0–100 score is validated against an expert-rated set; a repeatable harness catches regressions.

**Independent Test**: Harness reports friendly CVs scoring materially higher than problematic ones and correct ranking on ≥90% of clear pairs; exits non-zero below target.

### Implementation

- [ ] T033 [US4] Assemble + **expert-label** the calibration CV set — populate `Backend/data/ats_calibration/labeled/` with real/curated CVs and `labels.json` (`friendly`|`problematic` + notes). *(Explicit sourcing/labeling task — not a given.)*
- [ ] T034 [US4] Implement `Backend/scripts/validate_ats_scoring.py` — score the labeled set; report group-mean separation + pairwise ranking accuracy; exit non-zero if below SC-005 targets (FR-016)
- [ ] T035 [US4] Tune category weights/thresholds in `Backend/app/config.py` using the harness until targets met — weights only, preserving explainability (FR-015); re-run `test_ats_checker` to confirm no regression
- [ ] T036 [US4] Document calibration results + the re-validation command in `specs/004-ats-grade-engine/quickstart.md`; confirm the harness is runnable in Docker as a release gate

**Checkpoint**: the score is validated and its accuracy is re-checkable on demand.

---

## Phase 9: Polish & Cross-Cutting Concerns

- [ ] T037 [P] Extend `Backend/services/report_generator.py` ATS report — include the parsed-record summary and (detailed) point impacts + examples; keep it an owner-only attachment (FR-022)
- [ ] T038 [P] Update `Backend/.env.example` with any new non-secret config (vocab/calibration paths) and note the `python-docx` dep + `docker-compose up --build`
- [ ] T039 Full validation — `pytest` (unit + integration) green, `cd frontend && npx tsc --noEmit` + `npm run test`, run `validate_ats_scoring.py`, and walk the `quickstart.md` acceptance checklist (SC-001…SC-014); confirm zero spec-003 regressions (FR-022/SC-008)
- [ ] T040 [P] Update `README`/docs — `.docx` support, target-role selector, richer result, and the honesty framing (best-effort parse; expert-rated calibration, not live-ATS)

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)** → **Foundational (Phase 2)**: `ats_vocab` + seed vocab + schema/type extensions block all consuming stories.
- **US1 (Phase 3)**: depends on Foundational; independent of other stories.
- **US6 (Phase 4)**: depends on Foundational (schema + vocab); works on PDF or docx (independent of US1).
- **US2 (Phase 5)**: depends on Foundational (vocab); its `overall_parse_confidence` feeds `ats_checker` (coordinate with US6's `ats_checker` edits — same file, sequence T017 before T024).
- **US3 (Phase 6)**: depends on Foundational (vocab + synonyms).
- **US5 (Phase 7)**: expands the Foundational vocab; US2/US3/US6 benefit automatically once expanded.
- **US4 (Phase 8)**: depends on the engine being feature-complete (US2/US5 affect scores) — calibrate last.
- **Polish (Phase 9)**: after the desired stories.

### Same-file coordination (avoid conflicts)

- `ats_checker.py`: T017 (US6) then T024 (US2) then T035 (US4 weights) — sequential, same file.
- `cv.py`: T012 (US1) then T018 (US6) then T029 (US3) — sequential.
- `AtsResultView.tsx`: T019 (US6) then T025 (US2) then T029 (US3) — sequential.
- `test_ats_check.py`: T009/T015/T022/T027 all extend it — sequential.

### Parallel opportunities

- Setup: T002 ∥ T003
- Foundational: T007 (FE types) ∥ T004/T005 (backend vocab)
- US1: T008 ∥ T013 alongside backend T010–T012
- US6: T014 ∥ T016 ∥ T020 while authoring T017–T019
- US2: T021 (unit) ∥ T025 (FE panel) alongside T023
- Polish: T037 ∥ T038 ∥ T040

---

## Implementation Strategy

### MVP-first, incremental delivery

1. Setup + Foundational → vocab + schema ready.
2. **US1 (docx)** → widest real-world coverage gain; ship.
3. **US6 (richer result + controls)** → directly fixes the "vague / no options" complaint; ship.
4. **US2 (parsing)** → the "what an ATS reads" capability (allow buffer; NER optional).
5. **US3 (keyword fallback)** → dependable JD matching.
6. **US5 (broad vocab)** → accurate across industries.
7. **US4 (calibration)** → validate the score last, once the engine is feature-complete.
8. Polish → report, docs, full validation.

---

## Notes

- [P] = different files, no dependency on incomplete tasks.
- Every backend endpoint change is paired with unit + integration coverage (Constitution II).
- **No migration** — new data lives in the existing `ats_result` JSON.
- `resume_parser` core (US2) MUST be unit-testable without the spaCy model; NER degrades gracefully.
- Per-issue `point_impact` is indicative (apportioned); only **category** impact is exact/reconciling — do not present per-issue numbers as exactly additive.
- Preserve all spec-003 guarantees: determinism, graceful AI degradation, owner-only, no leakage, explainability.
