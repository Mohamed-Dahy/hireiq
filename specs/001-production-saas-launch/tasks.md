---
description: "Task list for HireIQ Production SaaS Launch — Revised Phase Order v2"
---

# Tasks: HireIQ Production SaaS Launch

**Input**: Design documents from `specs/001-production-saas-launch/`
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅

**Tests**: Required per constitution (Principle II) — unit + integration for every new endpoint.

**Phase Status**: Phases 1–7 ✅ COMPLETE (192 tests pass, 1 skipped) | Phase 8 ✅ COMPLETE (T106–T115 + T180–T193) | Phases 9–14 pending

**Organization**: Phases 1–2 shared foundations. Phases 3–4 security hardening. Phases 5–8 core product features. Phases 9–11 growth & platform features (new). Phase 12 subscriptions & payments. Phase 13 full system testing. Phase 14 polish.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1–US11 maps to spec user stories
- Every task includes an exact file path

---

## Phase 1: Setup (Shared Infrastructure) ✅ COMPLETE

**Purpose**: Test runners, dependency updates, TypeScript enforcement. No business logic.

- [X] T001 Verify `strict: true` is set in `frontend/tsconfig.json`; add it if missing and fix any resulting type errors
- [X] T002 [P] Add backend test dependencies to `Backend/requirements.txt`: `pytest>=8`, `httpx`, `pytest-asyncio`, `pytest-cov`, `loguru`, `resend`
- [X] T003 [P] Add frontend test dependencies to `frontend/package.json`: `vitest`, `@testing-library/react`, `@testing-library/user-event`, `jsdom`
- [X] T004 Create `Backend/tests/__init__.py`, `Backend/tests/unit/__init__.py`, `Backend/tests/integration/__init__.py`
- [X] T005 [P] Create `Backend/tests/conftest.py` with fixtures: `test_db` (transaction rollback), `test_client` (FastAPI TestClient), `auth_headers` (pre-authenticated user), `subscribed_headers` (Professional-tier user)
- [X] T006 [P] Add `vitest.config.ts` to `frontend/` configuring jsdom environment and coverage

---

## Phase 2: Foundational (Blocking Prerequisites) ✅ COMPLETE

**Purpose**: Infrastructure that every user story depends on. MUST be complete before any story work.

- [X] T007 Fix `Backend/.env.docker` — remove hardcoded `DATABASE_URL`; replace with `DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}`
- [X] T008 Fix `Backend/app/config.py` — indent the `Config` inner class inside the `Settings` class body so `.env` loading works correctly; add all new env var fields (`RESEND_API_KEY`, `FROM_EMAIL`, `APP_BASE_URL`, `PAYMOB_API_KEY`, `PAYMOB_INTEGRATION_ID`, `PAYMOB_HMAC_SECRET`, `PAYMOB_IFRAME_ID`, `ADMINER_PASSWORD`)
- [X] T009 Add `postgres` service (`postgres:16-alpine`, named volume, env vars from `.env`) and `adminer` service (port 8080, SSH-tunnel-only access) to `docker-compose.yml`; remove `host.docker.internal` reference
- [X] T010 Initialise Alembic: run `alembic init Backend/migrations`; configure `Backend/migrations/env.py` to import `Base` from all models and set `target_metadata = Base.metadata`; update `Backend/migrations/alembic.ini` to read `sqlalchemy.url` from env
- [X] T011 Create migration `Backend/migrations/versions/001_initial.py` — baseline snapshot of existing `users`, `cv_sessions`, `interview_results` tables
- [X] T012 Update `Backend/app/main.py`: remove `create_tables()` startup call; add `alembic upgrade head` as a Docker `CMD` pre-step (or startup event using `subprocess`)
- [X] T013 [P] Replace all `print()` calls in `Backend/` with `from loguru import logger` statements; configure loguru JSON sink when `LOG_FORMAT=json` env var is set (in `Backend/app/config.py`)
- [X] T014 [P] Create `Backend/middleware/security_headers.py` — `SecurityHeadersMiddleware` class that injects `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Content-Security-Policy`, `Referrer-Policy` on every response
- [X] T015 Register `SecurityHeadersMiddleware` in `Backend/app/main.py` before the CORS middleware
- [X] T016 Fix `user_id` column in `Backend/models/user.py` CVSession — change `nullable=True` to `nullable=False`
- [X] T017 [P] Create `Backend/models/security.py` — `SecurityAuditLog` model with columns: `id`, `event_type`, `user_id` (no FK), `source_ip`, `outcome`, `detail`, `created_at`
- [X] T018 [P] Create `Backend/services/security_service.py` — `write_audit_log(db, event_type, source_ip, outcome, user_id=None, detail=None)` and `verify_paymob_hmac(payload, received_hmac)` helpers
- [X] T019 Add global exception handler to `Backend/app/main.py` that catches unhandled exceptions and returns `{"detail": "Internal server error", "ref": "<uuid>"}` — never exposing stack traces

---

## Phase 3: User Story 1 — Secure, Verified Registration & Login ✅ COMPLETE

**Goal**: Email verification, password reset, account lockout, session invalidation.

### Tests for User Story 1

- [X] T020 [P] [US1] Integration tests (registration + verification flow) in `Backend/tests/integration/test_auth.py`
- [X] T021 [P] [US1] Integration tests (password reset flow) in `Backend/tests/integration/test_auth.py`
- [X] T022 [P] [US1] Unit tests for lockout logic in `Backend/tests/unit/test_auth_service.py`

### Implementation for User Story 1

- [X] T023 [P] [US1] Add `email_verified`, `failed_login_count`, `locked_until` columns to `User` in `Backend/models/user.py`
- [X] T024 [P] [US1] Add `EmailVerificationToken` model to `Backend/models/user.py`
- [X] T025 [P] [US1] Add `PasswordResetToken` model to `Backend/models/user.py`
- [X] T026 [US1] Create `Backend/migrations/versions/002_auth_hardening.py`
- [X] T027 [P] [US1] Add verification + reset + lockout schemas to `Backend/models/schemas.py`
- [X] T028 [US1] Extend `Backend/services/auth_service.py` — add token helpers, lockout helpers
- [X] T029 [US1] Extend `Backend/services/auth_service.py` — add JWT blacklist via Redis
- [X] T030 [P] [US1] Create `Backend/services/email_service.py`
- [X] T031 [US1] Add `POST /auth/verify-email` to `Backend/routers/auth.py`
- [X] T032 [US1] Add `POST /auth/resend-verification` to `Backend/routers/auth.py`
- [X] T033 [US1] Add `POST /auth/forgot-password` to `Backend/routers/auth.py`
- [X] T034 [US1] Add `POST /auth/reset-password` to `Backend/routers/auth.py`
- [X] T035 [US1] Update `POST /auth/login` in `Backend/routers/auth.py`
- [X] T036 [US1] Update `POST /auth/refresh` in `Backend/routers/auth.py`
- [X] T037 [US1] Add `DELETE /auth/logout` to `Backend/routers/auth.py`
- [X] T038 [US1] Add email verification banner to `frontend/src/pages/Auth.tsx`

---

## Phase 4: User Story 6 — Platform Security & Attack Prevention ✅ COMPLETE

**Goal**: OWASP controls, file upload hardening, IDOR prevention, audit trail, account deletion.

### Tests for User Story 6

- [X] T039 [P] [US6] Unit tests in `Backend/tests/unit/test_security_service.py`: HMAC verification, audit log persistence
- [X] T040 [P] [US6] Integration security test suite in `Backend/tests/integration/test_security.py`: SQL injection, XSS, IDOR, malicious upload, security headers, CSRF, audit log persistence

### Implementation for User Story 6

- [X] T041 [US6] `security_audit_logs` table already created in `Backend/migrations/versions/002_auth_hardening.py`
- [X] T042 [US6] MIME-type magic-byte validation + 10 MB limit + UUID filename in `Backend/routers/cv.py`
- [X] T043 [US6] Add `require_ownership(resource_user_id, current_user_id)` to `Backend/services/auth_service.py`
- [X] T044 [US6] Apply `require_ownership` to all `GET /cv/{id}/*` and `DELETE /cv/{id}` endpoints
- [X] T045 [US6] Add `write_audit_log()` calls to all auth endpoints in `Backend/routers/auth.py`
- [X] T046 [US6] Add `DELETE /auth/account` to `Backend/routers/auth.py`
- [X] T047 [US6] Add CSRF middleware in `Backend/middleware/csrf.py`; add `X-Requested-With` header to `frontend/src/api.ts`

**Checkpoint**: 80 tests pass, 1 skipped (Paymob webhook pending Phase 12). All OWASP attack scenarios blocked.

---

## Phase 5: User Story 4 — Enhanced AI Analysis & Interview Intelligence (Priority: P2) ✅ COMPLETE

**Goal**: Structured skills inventory, gap report, study roadmap, LinkedIn PDF import.

**Independent Test**: Upload a CV → request enhanced analysis → receive skills inventory with ≥15 skills, gap report, 10+ questions with model answers, study roadmap — all within 30 seconds. Upload a LinkedIn PDF export → same result.

### Tests for User Story 4

- [X] T070 [P] [US4] Unit test for enhanced LLM analyzer in `Backend/tests/unit/test_llm_analyzer.py`: structured output schema validation, fallback on AI error, credit not consumed on error
- [X] T071 [P] [US4] Integration test for enhanced CV analysis in `Backend/tests/integration/test_cv.py`: skills inventory populated, gap report returned, LinkedIn PDF detected correctly

### Implementation for User Story 4

- [X] T072 [US4] Update LLM prompt in `Backend/rag/prompts.py` — add structured output instructions for skills inventory (hard skills + experience level), gap report (skill, importance, resources), study roadmap (topic, priority, estimated hours, resources)
- [X] T073 [US4] Extend `Backend/services/llm_analyzer.py` — `analyze_structured(cv_text, jd_text)` returns parsed JSON dict with `skill_inventory`, `gap_report`, `study_roadmap`, `questions`; handles malformed LLM output gracefully
- [X] T074 [P] [US4] Create `Backend/services/linkedin_service.py` — `is_linkedin_pdf(file_bytes)` (checks first page for "LinkedIn" keyword), reuses `cv_parser.py` pipeline for text extraction
- [X] T075 [US4] Create `Backend/migrations/versions/003_cv_session_extended.py` (`down_revision="002"`) — add `skill_inventory` (Text/JSON), `gap_report` (Text/JSON), `study_roadmap` (Text/JSON), `is_linkedin` (Boolean) to `cv_sessions`; note: later subscriptions migration becomes 004, jobs migration becomes 005
- [X] T076 [US4] Add `GET /cv/{id}/analysis` endpoint to `Backend/routers/cv.py` — returns stored analysis or 202 if still processing
- [X] T077 [US4] Extend `GET /analyze` SSE stream in `Backend/routers/analysis.py` — emit `skill_inventory`, `gap_report`, `study_roadmap` events; save results to `CVSession` columns
- [X] T078 [US4] Extend `POST /cv/upload` in `Backend/routers/cv.py` — call `linkedin_service.is_linkedin_pdf()`; tag session if LinkedIn source
- [X] T079 [P] [US4] Create `frontend/src/components/SkillsInventory.tsx` — renders hard/soft skills as tagged badges with experience level indicators
- [X] T080 [P] [US4] Create `frontend/src/components/SkillGapChart.tsx` — horizontal bar chart showing gap importance per missing skill
- [X] T081 [P] [US4] Create `frontend/src/components/StudyRoadmap.tsx` — vertical timeline of roadmap topics with priority badges and resource links
- [X] T082 [US4] Extend `frontend/src/pages/Results.tsx` — render `SkillsInventory`, `SkillGapChart`, `StudyRoadmap`
- [X] T083 [US4] Extend `frontend/src/pages/Upload.tsx` — add LinkedIn badge display in Results.tsx (LinkedIn detection happens server-side)
- [X] T084 [US4] Add enhanced analysis calls to `frontend/src/api.ts`: `getEnhancedAnalysis(sessionId)`, `StructuredAnalysis` type

**Checkpoint**: 100 tests pass (20 new for Phase 5), 1 skipped. All OWASP controls intact.

---

## Phase 6: User Story 7 — Competitive ATS Job Tracker (Priority: P2)

**Goal**: A production-grade job application tracking system that competes with Huntr, Teal, and Simplify — with AI-powered match scoring (leveraging Phase 5's LLM analyzer), auto-generated interview prep per job, validated stage transitions, activity timeline, contact tracking, and a funnel analytics dashboard.

**Independent Test**: User adds a job with a JD text → system auto-scores it against their linked CV session → user advances the application through stages (saved → applied → technical), each transition logged in the activity timeline → user opens AI Prep tab → interview questions generated for that specific role → Stats dashboard shows funnel conversion rates, source effectiveness, and stale application count.

**No new paid services required.** Uses existing Groq API key (same as CV analysis), PostgreSQL, and existing auth/ownership infrastructure from Phase 4.

### Tests for User Story 7

> **Write these FIRST — confirm they FAIL before implementing**

- [X] T085 [P] [US7] Unit tests for job service in `Backend/tests/unit/test_job_service.py`: `validate_status_transition` rejects invalid jumps (saved→offer raises 400), accepts valid transitions (saved→applied, applied→phone_screen), `get_stale_jobs` returns only jobs with no activity in 14+ days, `compute_job_stats` returns correct funnel counts and response_rate
- [X] T085b [P] [US7] Integration tests for job tracker in `Backend/tests/integration/test_jobs.py`: full CRUD with field validation, status transition (valid succeeds + writes activity row, invalid returns 400), activity log creation and retrieval, contact CRUD, `POST /jobs/{id}/analyze` returns updated match_score (LLM mocked), `GET /jobs/{id}/prep` returns questions, `GET /jobs/stats` returns correct funnel shape, `GET /jobs/upcoming` returns only jobs with deadline or followup within 7 days, `GET /jobs/stale` excludes terminal statuses, ownership check returns 404 on another user's job

### Implementation for User Story 7

#### Models

- [X] T086 [P] [US7] Create `Backend/models/jobs.py` — `JobApplication` model: `id`, `user_id` (FK→users, not null), `company` (String, not null), `title` (String, not null), `location` (String nullable), `remote_type` (String: remote/hybrid/onsite/unknown, default unknown), `salary_min` (Integer nullable), `salary_max` (Integer nullable), `job_url` (String nullable), `jd_text` (Text nullable — stored for AI re-analysis), `source` (String: linkedin/indeed/company/referral/cold_email/other, default other), `status` (String: saved/applied/phone_screen/technical/final_round/offer/accepted/rejected/withdrawn, default saved), `applied_date` (Date nullable), `deadline_date` (Date nullable), `next_followup_date` (Date nullable), `priority` (String: high/medium/low, default medium), `cv_session_id` (FK→cv_sessions nullable), `match_score` (Float nullable), `ai_gap_summary` (Text nullable), `ai_prep_questions` (Text nullable — JSON array), `notes` (Text nullable), `cover_letter` (Text nullable), `rejection_reason` (String nullable), `stage_entered_at` (DateTime, default now), `is_archived` (Boolean, default False), `created_at`, `updated_at`
- [X] T086b [P] [US7] Add `ApplicationActivity` model to `Backend/models/jobs.py` — `id`, `job_application_id` (FK→job_applications, cascade delete), `user_id` (FK→users), `event_type` (String: status_change/email_sent/call_made/interview_scheduled/note_added/follow_up_sent/offer_received), `event_date` (Date, default today), `notes` (Text nullable), `created_at`
- [X] T086c [P] [US7] Add `ApplicationContact` model to `Backend/models/jobs.py` — `id`, `job_application_id` (FK→job_applications, cascade delete), `name` (String not null), `role` (String: hr_recruiter/hiring_manager/referrer/other), `email` (String nullable), `linkedin_url` (String nullable), `notes` (Text nullable), `created_at`

#### Migration

- [X] T087 [US7] Create `Backend/migrations/versions/004_jobs_recruiter.py` (`down_revision="003"`) — add `job_applications`, `application_activities`, `application_contacts` tables; note: this migration is extended by Phase 7 (T097) which adds `recruiter_lists` and `recruiter_candidates` to the same file

#### Service

- [X] T087b [US7] Create `Backend/services/job_service.py` — `VALID_TRANSITIONS: dict[str, list[str]]` mapping every status to its allowed next statuses (e.g. saved→[applied, withdrawn], offer→[accepted, rejected, withdrawn], accepted/rejected/withdrawn are terminal); `validate_status_transition(current, next)` raises `HTTPException(400)` on invalid; `is_stale(job, days=14)` True if no `ApplicationActivity` in last 14 days and status not in terminal set; `get_stale_jobs(db, user_id)` returns list; `compute_job_stats(db, user_id)` returns dict: `by_status` (count per status), `response_rate` (jobs that reached phone_screen+ / jobs with applied status), `interview_rate` (technical+ / applied), `offer_rate` (offer+ / applied), `avg_days_per_stage` (mean days spent in each stage from stage_entered_at), `by_source` (count per source), `weekly_trend` (last 8 weeks: [{"week": "2026-W18", "count": 5}]), `stale_count`, `upcoming_count` (deadline or followup within 7 days), `total_active` (non-archived, non-terminal)

#### Schemas

- [X] T088 [P] [US7] Add to `Backend/models/schemas.py`: `JobApplicationCreate` (all create fields, company + title required), `JobApplicationUpdate` (all fields Optional), `JobApplicationResponse` (full response: all fields + `is_stale: bool` computed), `JobApplicationListItem` (lighter: id, company, title, status, match_score, priority, source, applied_date, next_followup_date, is_stale, stage_entered_at), `StatusTransitionRequest` (new_status: str, note: Optional[str]), `ActivityCreate` (event_type, event_date, notes), `ActivityResponse` (id, event_type, event_date, notes, created_at), `ContactCreate` (name, role, email, linkedin_url, notes), `ContactResponse` (id + all contact fields), `JobStatsResponse` (full analytics shape matching job_service output)

#### Routes — Core CRUD

- [X] T089 [US7] Create `Backend/routers/jobs.py` — `GET /jobs` (query params: status, source, priority, is_archived=False, company_search; returns `list[JobApplicationListItem]`), `POST /jobs` (create; if jd_text + cv_session_id provided, immediately call `analyze_structured` and store match_score + ai_gap_summary + ai_prep_questions), `GET /jobs/{id}` (full detail: `JobApplicationResponse` + activities list + contacts list), `PATCH /jobs/{id}` (partial update), `DELETE /jobs/{id}` (soft-archive: set is_archived=True, NOT physical delete); apply `require_ownership` on all `{id}` routes

#### Routes — Status Transitions, Activities, Contacts

- [X] T089b [US7] Add to `Backend/routers/jobs.py` — `PATCH /jobs/{id}/status` (call `validate_status_transition`, update status + stage_entered_at, auto-write `ApplicationActivity` row with event_type=status_change), `POST /jobs/{id}/activities` (manual activity log entry), `GET /jobs/{id}/activities` (chronological list), `POST /jobs/{id}/contacts` (add contact), `GET /jobs/{id}/contacts`, `DELETE /jobs/{id}/contacts/{contact_id}` (require_ownership on job, then ownership implied)

#### Routes — AI & Analytics

- [X] T089c [US7] Add to `Backend/routers/jobs.py` — `POST /jobs/{id}/analyze` (load stored jd_text or accept jd_text in body; if cv_session_id set load cv_text from session; call `analyze_structured(cv_text, jd_text)`; store match_score from Phase 5's scoring logic, top 3 gap items as ai_gap_summary string, prep questions as ai_prep_questions JSON; return updated `JobApplicationResponse`); `GET /jobs/{id}/prep` (return stored ai_prep_questions or trigger generation if null); `GET /jobs/stats` (call `compute_job_stats`, return `JobStatsResponse`); `GET /jobs/upcoming` (deadline_date or next_followup_date within 7 days, not archived/terminal); `GET /jobs/stale` (call `get_stale_jobs`, not archived)

#### Registration

- [X] T090 [US7] Register `jobs` router in `Backend/app/main.py`; add `/jobs` proxy rule to `frontend/nginx.conf`

#### Frontend — Components

- [X] T091 [P] [US7] Create `frontend/src/components/JobCard.tsx` — displays: company + title (bold), status badge (color-coded: grey=saved, blue=applied, yellow=phone_screen, orange=technical, purple=final_round, green=offer, emerald=accepted, red=rejected), match score ring gauge (0–100: red<60, amber<75, green≥75, grey if null), source chip, priority dot (red=high, amber=medium, grey=low), days-in-current-stage counter, follow-up date with red "overdue" highlight if past, stale warning badge if is_stale; action menu: Advance Status, Log Activity, Edit, Archive
- [X] T091b [P] [US7] Create `frontend/src/components/JobDetailDrawer.tsx` — slide-in side panel (Sheet from shadcn/ui) with 4 tabs: **Overview** (all job fields displayed + inline-edit form, match score gauge at top, ai_gap_summary banner in amber if gaps exist), **Activity** (renders `ApplicationTimeline` + inline log-activity form with event_type select + date + notes), **Contacts** (contact cards with email/LinkedIn links + add contact form), **AI Prep** (gap summary banner, list of prep questions with model answers collapsible; "Generate Prep" button if empty or "Regenerate" if stale)
- [X] T091c [P] [US7] Create `frontend/src/components/ApplicationTimeline.tsx` — vertical timeline of `ActivityResponse` items; each entry: event_type icon (✉ email, 📞 call, 📅 interview, → status_change, 📝 note, 🔄 followup, 💰 offer), formatted date, notes text; newest first; empty state "No activity logged yet"
- [X] T091d [P] [US7] Create `frontend/src/components/JobStatsPanel.tsx` — 4 metric cards row (total active, response rate %, interview rate %, offer rate %); funnel visualization (horizontal bars: Saved→Applied→Screened→Technical→Offer→Accepted with counts + conversion % between each step); applications-by-source horizontal bar chart; weekly application trend area chart (last 8 weeks); two alert badges: "X stale applications" (amber) and "Y upcoming deadlines" (blue); uses recharts (already added in Phase 10)
- [X] T091e [P] [US7] Create `frontend/src/components/AddEditJobModal.tsx` — Dialog (shadcn/ui) with two-column form: left column (company*, title*, location, remote_type select, salary_min–salary_max range, job_url, source select), right column (jd_text textarea tall, cv_session_id select from user sessions with match score preview, priority select, applied_date, deadline_date, next_followup_date); notes textarea full width; validates company + title required; on submit calls createJob or updateJob; if jd_text + cv_session_id provided, auto-analyze on save (show spinner)

#### Frontend — Page

- [X] T092 [US7] Create `frontend/src/pages/Jobs.tsx` — header bar: "Add Job" button (opens `AddEditJobModal`), view toggle (Kanban/List/Stats icons), search input, filter chips (status multi-select, source, priority); **Kanban view**: columns Saved/Applied/Phone Screen/Technical/Final Round/Offer (archived + terminal statuses hidden), each column shows count badge, cards are `JobCard`, column has "Add to [stage]" shortcut; **List view**: sortable table (company, title, status, score, source, applied date, followup date, days in stage), click row opens `JobDetailDrawer`; **Stats tab**: renders `JobStatsPanel`; stale banner at top ("X applications have had no activity in 14+ days — [Review]"); upcoming banner ("Y deadlines in the next 7 days"); empty state with CTA when pipeline is empty

#### Frontend — API & Router

- [X] T093 [US7] Add to `frontend/src/api.ts`: `getJobs(filters?: JobFilters)`, `createJob(data)`, `getJob(id)`, `updateJob(id, data)`, `deleteJob(id)` (archive), `transitionStatus(id, newStatus, note?)`, `analyzeJob(id, jdText?)`, `getJobPrep(id)`, `logActivity(id, data)`, `getActivities(id)`, `addContact(id, data)`, `getContacts(id)`, `deleteContact(jobId, contactId)`, `getJobStats()`, `getUpcomingJobs()`, `getStaleJobs()`; export `JobApplicationResponse`, `JobApplicationListItem`, `ActivityResponse`, `ContactResponse`, `JobStatsResponse` types
- [X] T094 [US7] Add `/jobs` route to frontend router; add "Jobs" nav item with active pipeline count badge (fetched from `getJobStats().total_active`); add "Track This Job" quick-action on Results page (pre-fills job modal with the analyzed JD and match score)

**Checkpoint**: Full ATS pipeline testable end-to-end. T085 + T085b pass. AI analysis on job applications works with mocked LLM. Stats dashboard shows real funnel data. Status transitions enforce business rules. No regressions in Phase 1–5 tests.

---

## Phase 7: User Story 8 — Recruiter Dashboard (Priority: P2)

**Goal**: Employer-facing multi-candidate comparison, ranked shortlist, PDF export.

**Independent Test**: Recruiter-tier user creates a candidate list, uploads 3 CVs, adds all as candidates, views ranked comparison table, exports PDF report.

### Tests for User Story 8

> **Write these FIRST — confirm they FAIL before implementing**
>
> **Execution order within this phase**: T095 (write tests, confirm FAIL) → T096 (models) → T097 (migration — required before tests can pass) → T098 (schemas) → T099 (router) → T100 (PDF service) → T101 (register + nginx) → T102–T105 (frontend, all parallel). T096 + T097 must both be done before re-running T095 tests.

- [X] T095 [P] [US8] Integration test for recruiter dashboard in `Backend/tests/integration/test_recruiter.py`: list CRUD, add candidate, 20-candidate limit enforcement, rank update, PDF export returns PDF

### Implementation for User Story 8

- [X] T096 [P] [US8] Add `RecruiterList` and `RecruiterCandidate` models to `Backend/models/jobs.py` per data-model.md
- [X] T097 [US8] Create `Backend/migrations/versions/006_recruiter_tables.py` (`down_revision="005b"`) — add `recruiter_lists` and `recruiter_candidates` tables
- [X] T098 [P] [US8] Add `RecruiterListCreate`, `RecruiterListResponse`, `RecruiterCandidateResponse`, `RecruiterCandidateUpdate` schemas to `Backend/models/schemas.py`
- [X] T099 [US8] Create `Backend/routers/recruiter.py` — full CRUD for lists and candidates; `GET /recruiter/lists/{id}/export`; all require ownership check
- [X] T100 [US8] Extend `Backend/services/report_generator.py` — `generate_recruiter_report(recruiter_list, candidates)` produces PDF with ranked candidate table
- [X] T101 [US8] Register `recruiter` router in `Backend/app/main.py`; add `/recruiter` proxy rule to `frontend/nginx.conf`
- [X] T102 [P] [US8] Create `frontend/src/components/CandidateCompare.tsx` — sortable table with score, skills chips, rank badge, remove button
- [X] T103 [US8] Create `frontend/src/pages/Recruiter.tsx` — list manager, candidate compare view, export PDF button
- [X] T104 [US8] Add recruiter calls to `frontend/src/api.ts`
- [X] T105 [US8] Add `/recruiter` route to frontend router

**Checkpoint**: Recruiter dashboard independently testable. T095 passes.

---

## Phase 8: User Story 5 — Premium Frontend Redesign (Priority: P2)

**Goal**: A commercial-grade SaaS UI — polished, consistent, mobile-responsive, conversion-optimised. This is NOT a minor cleanup; the goal is a frontend that looks like a funded product.

**Design References** (study before implementing):
- Component inspiration: `github.com/shadcn-ui/ui` — full component catalogue + themes
- SaaS layout patterns: `github.com/vercel/nextjs-subscription-payments` — dashboard + pricing page patterns
- Animation & microinteractions: `github.com/framer/motion` examples — subtle transitions that feel premium
- Landing page structure: `github.com/cruip/tailwind-landing-page-template` — hero, features, testimonials, CTA
- Dashboard layout: `github.com/shadcn-ui/ui/tree/main/apps/www` — sidebar nav, stat cards, data tables
- Color system: Use shadcn/ui CSS variables for a cohesive theme (zinc/slate base, blue/indigo accent)

**Independent Test**: Independent evaluator rates landing page and app UI ≥ 4/5. Lighthouse mobile score ≥ 80. All pages functional on 375 px viewport.

- [X] T106 [P] [US5] shadcn/ui skipped — Tailwind v4 CSS-only setup (no tailwind.config.ts) is incompatible with shadcn-ui@latest init; redesign uses existing Tailwind + framer-motion stack
- [X] T107 [P] [US5] Create `frontend/src/lib/utils.ts` — export `cn()` helper; create `frontend/src/lib/constants.ts` for site-wide copy and config constants (PLANS, TESTIMONIALS)
- [X] T108 [US5] Redesign `frontend/src/pages/Landing.tsx` — hero with trust badges + animated gap preview card, 6-feature grid (3-col), testimonials section, 4-step process (4-col), pricing preview (3 plan cards), improved footer
- [X] T109 [P] [US5] Redesign `frontend/src/pages/Auth.tsx` — split-panel layout (left: branded panel with feature list + testimonial card, right: form); labeled inputs; improved error/success banners
- [X] T110 [P] [US5] Redesign `frontend/src/pages/Dashboard.tsx` — max-w-6xl layout (was max-w-2xl); 3-col stat cards with subtext; 1/3 + 2/3 grid (quick actions + recent sessions table); score trend chart; best score badge in header
- [X] T111 [P] [US5] Redesign `frontend/src/pages/Upload.tsx` — 3-step progress indicator; animated drop zone with drag-over bounce; polished file chip with remove; labeled section headers; smart placeholder text
- [X] T112 [P] [US5] Redesign `frontend/src/pages/Results.tsx` — large animated score gauge (0–100 arc); tabbed sections (Analysis | Skills | Gap Report | Roadmap | Interview Prep); streaming analysis with skeleton loaders; shareable results card
- [X] T113 [P] [US5] Redesign `frontend/src/pages/Jobs.tsx` — kanban-style columns (Saved / Applied / Interview / Offer / Rejected); drag-to-move cards (optional); job card with company logo placeholder, match score badge, quick notes
- [X] T114 [US5] Audit and fix mobile responsiveness for all pages at 375 px, 768 px, 1 280 px; create `frontend/src/components/layout/AppShell.tsx` (sidebar collapses to bottom nav on mobile); all interactive elements ≥ 44 px touch target
- [X] T115 [US5] Run Lighthouse on Landing, Dashboard, and Results pages; fix issues until mobile Performance ≥ 80 and FCP ≤ 3 s; add `<Suspense>` + lazy loading to all page-level routes in the router

**Dark Mode / Palette Migration** (done as part of Phase 8 polish — all pages and shared components):

- [X] T180 [P] [US5] Create `frontend/src/components/ThemeToggle.tsx` — Moon/Sun Lucide toggle; wires to `.dark` class on `<html>`; integrated in App nav and Landing nav
- [X] T181 [P] [US5] Migrate `frontend/src/pages/History.tsx` — zinc/violet/dark full rewrite; score filter chips (emerald/amber/red); Lucide Search/Trash2/FileText/ChevronRight; animate-pulse skeleton loaders; group-hover delete reveal
- [X] T182 [P] [US5] Migrate `frontend/src/pages/Profile.tsx` — zinc/violet/dark full rewrite; flat `bg-violet-600` avatar; StatCard `bg-white dark:bg-zinc-900`; achievement grid (earned/unearned states); Lucide Zap/LayoutGrid/Star/Sparkles/Mic/Check; red logout border
- [X] T183 [P] [US5] Migrate `frontend/src/pages/Interview.tsx` — zinc/violet/dark full rewrite; amber camera-error banner; red record / zinc stop / violet submit buttons; Lucide Loader2; feedback card zinc borders
- [X] T184 [P] [US5] Migrate `frontend/src/pages/SessionDetail.tsx` — zinc/violet/dark full rewrite; ScoreBar `bg-zinc-100 dark:bg-zinc-800` track + `bg-violet-500` fill; transcript `bg-zinc-50 dark:bg-zinc-800/50`; Lucide Download/ChevronDown
- [X] T185 [P] [US5] Migrate `frontend/src/pages/Recruiter.tsx` — zinc/violet/dark full rewrite; sidebar `bg-zinc-50 dark:bg-zinc-950`; export button violet + Loader2; `border-l-2 border-l-violet-600` selected state; Lucide Download/X/Loader2
- [X] T186 [P] [US5] Migrate `frontend/src/components/Modal.tsx` — zinc/dark; Lucide AlertTriangle + Loader2; `bg-black/50 backdrop-blur-sm` overlay; danger/confirm variant colors
- [X] T187 [P] [US5] Migrate `frontend/src/components/Toast.tsx` — Lucide CheckCircle/XCircle/Info/X icons; emerald/red/violet border + icon colors with dark variants
- [X] T188 [P] [US5] Migrate `frontend/src/components/ScoreGauge.tsx` — track circle uses `stroke="currentColor"` + `className="text-zinc-100 dark:text-zinc-800"` for dark mode adaptability; label zinc dark
- [X] T189 [P] [US5] Migrate `frontend/src/components/FeedbackPanel.tsx` — framer-motion animated score bars; `bg-zinc-100 dark:bg-zinc-800` track; `bg-violet-500` fill; transcript zinc/dark; eye-contact `text-violet-500`
- [X] T190 [P] [US5] Migrate `frontend/src/components/SkillGapList.tsx` — headings zinc-900/dark; numbers `text-violet-500`; cursor blink `bg-violet-400`; container `bg-zinc-50 dark:bg-zinc-800/50`
- [X] T191 [P] [US5] Migrate `frontend/src/components/QuestionCard.tsx` — remove `whileHover` scale; `border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900`; label `text-violet-500`
- [X] T192 [P] [US5] Migrate `frontend/src/components/JobCard.tsx` — all status colors zinc + dark variants; remove `shadow-sm hover:shadow-md hover:border-purple-200`; ScoreRing zinc dark border + emerald/amber/red colors
- [X] T193 [P] [US5] Migrate remaining shared components — `SkillsInventory.tsx`, `SkillGapChart.tsx` (Lucide BookOpen), `StudyRoadmap.tsx` (Lucide Clock), `ApplicationTimeline.tsx`, `CandidateCompare.tsx` (Lucide Trash2), `JobStatsPanel.tsx` (Recharts dark tooltips #18181b)

**Checkpoint**: Independent UI evaluation passes ≥ 4/5. Lighthouse scores meet targets. All pages render correctly at 375 px.

---

## Phase 9: User Story 9 — Referral & Viral Growth Engine (Priority: P2) [NEW]

**Goal**: Every registered user gets a unique referral link. When a referred user subscribes to any paid plan, the referrer earns 1 month free (credited automatically). This creates a zero-cost acquisition channel and a viral growth loop built directly into the product.

**Why now**: Referral drives acquisition, which is the hardest problem for a new SaaS. Adding it before subscriptions means the referral credit is applied at the exact moment of conversion. Building it after subscriptions would require retrofitting the billing logic.

**Independent Test**: User A shares their referral link → User B registers via the link → User B subscribes → User A's next billing cycle is skipped (1 free month applied); both users receive confirmation emails. Referral dashboard shows correct counts and earnings.

### Tests for User Story 9

> **Write these FIRST — confirm they FAIL before implementing**

- [ ] T123 [P] [US9] Unit tests for referral service in `Backend/tests/unit/test_referral_service.py`: code generation is unique, self-referral blocked, duplicate referral blocked, credit applied on conversion, expired referral handled
- [ ] T124 [P] [US9] Integration tests for referral flow in `Backend/tests/integration/test_referrals.py`: GET own referral code, register via code stores referral, stats endpoint, leaderboard endpoint returns ranked list

### Implementation for User Story 9

- [ ] T125 [P] [US9] Create `Backend/models/referral.py` — `ReferralCode` model (user_id FK, code unique, created_at) and `ReferralConversion` model (referrer_id, referred_user_id, converted_at, reward_applied)
- [ ] T126 [US9] Create `Backend/migrations/versions/007_referrals.py` — add `referral_codes` and `referral_conversions` tables
- [ ] T127 [P] [US9] Add `ReferralStatsResponse`, `LeaderboardEntry`, `ReferralCodeResponse` schemas to `Backend/models/schemas.py`
- [ ] T128 [US9] Create `Backend/services/referral_service.py` — `get_or_create_referral_code(db, user)`, `register_via_referral(db, code, new_user)` (validates, stores conversion), `apply_referral_reward(db, referred_user_id)` (credits 1 free month on subscription activation), `get_referral_stats(db, user)`, `get_leaderboard(db, limit=10)`
- [ ] T129 [US9] Create `Backend/routers/referrals.py` — `GET /referrals/my-code` (returns or creates code), `GET /referrals/stats` (conversions count, earnings summary), `GET /referrals/leaderboard` (top 10 referrers — usernames only, no emails)
- [ ] T130 [US9] Extend `POST /auth/register` in `Backend/routers/auth.py` — accept optional `?ref=<code>` query param; call `register_via_referral()` if present; store pending conversion (not yet credited — only credited on subscription activation)
- [ ] T131 [US9] Register `referrals` router in `Backend/app/main.py`; add `/referrals` proxy rule to `frontend/nginx.conf`
- [ ] T132 [P] [US9] Create `frontend/src/components/ReferralCard.tsx` — shows unique link with one-click copy button, conversion count badge, earnings summary ("1 free month earned"), mini progress bar toward next reward
- [ ] T133 [P] [US9] Create `frontend/src/pages/Referrals.tsx` — full referral hub: link + QR code display, stats (total referred, converted, months earned), leaderboard table, social share buttons (WhatsApp, LinkedIn, Twitter/X)
- [ ] T134 [US9] Extend `frontend/src/pages/Profile.tsx` — add referral stats mini-card linking to `/referrals`
- [ ] T135 [US9] Add referral calls to `frontend/src/api.ts`: `getMyReferralCode()`, `getReferralStats()`, `getLeaderboard()`; add `/referrals` route to router

**Checkpoint**: Referral flow testable end-to-end. T123–T124 pass. Leaderboard visible without revealing PII.

---

## Phase 10: User Story 10 — Platform Owner Admin BI Dashboard (Priority: P2) [NEW]

**Goal**: A secure, private admin panel — accessible only with a separate admin JWT — that gives the platform owner real-time visibility into business health: MAU, MRR, conversion rates, churn, feature usage, and recent security events. This is not a user-facing feature; it is an operator tool.

**Why now**: You cannot manage a SaaS without metrics. Building this before subscriptions means you can immediately see subscription data flow in real time from the moment payments go live.

**Access model**: Admin login is completely separate from the regular auth flow. `ADMIN_SECRET` in `.env` is checked against a submitted password; on success, a short-lived admin JWT is issued. Admin routes are a separate router with `require_admin` dependency — ordinary user tokens are rejected.

**Independent Test**: Admin logs in with `ADMIN_SECRET` → sees dashboard with accurate user count, plan distribution chart, MRR figure, and top 5 events in audit log. Accessing `/admin/*` with a regular user token returns 403. Admin panel is unreachable on port 443 without the `/admin` path and admin token.

### Tests for User Story 10

> **Write these FIRST — confirm they FAIL before implementing**

- [ ] T136 [P] [US10] Unit tests for analytics service in `Backend/tests/unit/test_analytics_service.py`: user count aggregation, MRR calculation, conversion rate, churn rate, plan distribution
- [ ] T137 [P] [US10] Integration tests for admin panel in `Backend/tests/integration/test_admin.py`: login with valid secret succeeds, login with wrong secret fails, regular user token rejected on all /admin/* routes, metrics endpoint returns expected shape

### Implementation for User Story 10

- [ ] T138 [P] [US10] Add `ADMIN_SECRET` and `ADMIN_JWT_EXPIRE_MINUTES` to `Backend/app/config.py` Settings; add to `Backend/.env.example`
- [ ] T139 [US10] Create `Backend/services/analytics_service.py` — `get_user_metrics(db)` (total, new this month, DAU), `get_revenue_metrics(db)` (MRR, ARR, total payments), `get_conversion_metrics(db)` (free-to-paid rate, churn rate, avg days to convert), `get_feature_usage(db)` (CV uploads, interviews, jobs created — last 30 days), `get_plan_distribution(db)` (count per plan)
- [ ] T140 [P] [US10] Add `AdminLoginRequest`, `AdminMetricsResponse`, `PlanDistributionItem`, `AuditLogEntry` schemas to `Backend/models/schemas.py`
- [ ] T141 [US10] Create `Backend/services/admin_service.py` — `create_admin_token(secret)` (verifies against `settings.admin_secret`, issues short-lived admin JWT with role claim `"admin"`), `require_admin` FastAPI dependency (validates admin JWT role — rejects regular user tokens)
- [ ] T142 [US10] Create `Backend/routers/admin.py` — `POST /admin/login` (public — issues admin token), `GET /admin/metrics` (all metrics in one payload), `GET /admin/users` (paginated user list: id, email masked, plan, joined, last_login), `GET /admin/audit-log` (recent 100 security events), `GET /admin/revenue` (monthly revenue chart data, last 12 months); all secured with `require_admin`
- [ ] T143 [US10] Register `admin` router in `Backend/app/main.py`; add `/admin` proxy rule to `frontend/nginx.conf`; ensure CSP allows admin page assets
- [ ] T144 [P] [US10] Create `frontend/src/pages/Admin.tsx` — gated behind admin token stored in sessionStorage (never localStorage); shows: key metrics row (users, MRR, conversion %), plan distribution pie chart, feature usage bar chart, monthly revenue line chart, recent audit log table; uses recharts for charts
- [ ] T145 [P] [US10] Create `frontend/src/components/MetricCard.tsx` — reusable stat card (value, label, delta vs last period, trend icon)
- [ ] T146 [US10] Add admin calls to `frontend/src/api.ts`: `adminLogin(secret)`, `getAdminMetrics()`, `getAdminUsers(page)`, `getAuditLog()`, `getRevenueChart()`; use separate axios instance with admin token header
- [ ] T147 [US10] Add `/admin` route to frontend router; admin page is NOT linked from regular navigation — must know the URL; redirect to admin login if no admin token in sessionStorage
- [ ] T148 [US10] Add `recharts` to `frontend/package.json`; verify all chart components render correctly with mock data before wiring to API

**Checkpoint**: Admin login and metrics work. T136–T137 pass. Regular users cannot access /admin/* routes.

---

## Phase 11: User Story 11 — Personalised Career Growth Roadmap (Priority: P2) [NEW]

**Goal**: A user selects an existing CV session and types their dream job role. The system generates a rich, structured career roadmap that bridges the gap between where they are now and where they want to be — with phased learning plans, curated resources, projects to build, market salary data, and immediate quick wins. Multiple roadmaps can be saved for different target roles.

**What makes it more than a gap report**: A gap report says "you're missing Python." This roadmap says: *"Here is a 6-month, 4-phase plan. In Phase 1 (weeks 1–4) you build the foundation: CS50P (free, 30 hrs), Python Crash Course (book, 20 hrs), and a CLI to-do app project — milestone: you can write Python scripts confidently. In Phase 2…"* It is a complete, actionable career plan, not a list.

**Why now**: This feature directly uses the skills inventory from Phase 5 as input. It must be built after Phase 5 but before subscriptions so it can be a premium gating point.

**Independent Test**: A user with an uploaded CV types "Senior Data Engineer at a FinTech company" → within 30 seconds receives a roadmap with 4 named phases, ≥15 specific resources (mix of free/paid), 4 projects to build, a salary range for Egypt and remotely, top 5 companies hiring for this role, and 3 quick wins for the first 2 weeks.

### Tests for User Story 11

> **Write these FIRST — confirm they FAIL before implementing**

- [ ] T149 [P] [US11] Unit tests for roadmap service in `Backend/tests/unit/test_roadmap_service.py`: structured output schema validation (all required JSON keys present), fallback on LLM error returns graceful message, malformed LLM JSON handled without 500, empty CV text handled
- [ ] T150 [P] [US11] Integration tests for roadmap endpoints in `Backend/tests/integration/test_roadmap.py`: POST /roadmap/generate returns valid roadmap and saves to DB, GET /roadmap/{id} returns correct data, GET /roadmap lists only user's own roadmaps, 404 on another user's roadmap (IDOR check), 404 on non-existent cv_session_id

### Implementation for User Story 11

- [ ] T151 [P] [US11] Create `Backend/models/roadmap.py` — `CareerRoadmap` model with columns: `id`, `user_id` (FK), `cv_session_id` (FK nullable — user may re-generate without a session), `target_role` (String), `roadmap_data` (JSON — full structured roadmap), `created_at`
- [ ] T152 [US11] Create `Backend/migrations/versions/008_career_roadmap.py` — add `career_roadmaps` table
- [ ] T153 [P] [US11] Add schemas to `Backend/models/schemas.py`: `RoadmapGenerateRequest` (cv_session_id, target_role), `RoadmapResource` (name, url, type: course/book/video/project, is_free, estimated_hours), `RoadmapPhase` (name, estimated_weeks, skills_covered, resources: list[RoadmapResource], project_to_build, milestone), `CareerInsight` (salary_range_local, salary_range_remote, top_companies: list[str], hot_skills: list[str], market_demand: high/medium/low), `QuickWin` (action, why, time_required), `RoadmapResponse` (id, target_role, total_estimated_weeks, phases, career_insight, quick_wins, created_at)
- [ ] T154 [US11] Create `Backend/rag/prompts.py` CAREER_ROADMAP_PROMPT — a detailed system prompt instructing the LLM to return a strict JSON object containing: `phases` (array of 3–5 phases, each with name, estimated_weeks, skills_covered array, resources array with name/url/type/is_free/estimated_hours, project_to_build description, milestone), `career_insight` (salary_range_local in EGP, salary_range_remote in USD, top_companies list, hot_skills list, market_demand), `quick_wins` (3 immediate actions with action text, why it matters, time required); prompt must include "respond ONLY with valid JSON, no markdown, no explanation"
- [ ] T155 [US11] Create `Backend/services/roadmap_service.py` — `generate_career_roadmap(cv_text: str, current_skills: list, target_role: str) -> dict`: builds the prompt by injecting extracted CV skills + target role, calls the LLM (Groq), parses JSON response, validates required keys, handles malformed output by returning a structured error dict rather than raising; also `save_roadmap(db, user_id, cv_session_id, target_role, roadmap_data)`, `get_roadmap(db, roadmap_id, user_id)`, `list_roadmaps(db, user_id)`
- [ ] T156 [US11] Create `Backend/routers/roadmap.py` — `POST /roadmap/generate` (auth required; loads cv_session, calls require_ownership, extracts cv_text + skills from session, calls generate_career_roadmap, saves, returns RoadmapResponse), `GET /roadmap` (list user's roadmaps, newest first — id, target_role, total_estimated_weeks, created_at only), `GET /roadmap/{roadmap_id}` (full roadmap, require_ownership); add `require_ownership` on all resource endpoints
- [ ] T157 [US11] Register `roadmap` router in `Backend/app/main.py`; add `/roadmap` proxy rule to `frontend/nginx.conf`
- [ ] T158 [P] [US11] Create `frontend/src/components/RoadmapPhaseCard.tsx` — expandable accordion card per phase; header shows phase name + estimated weeks + progress indicator; expanded body shows: skill chips, resource list (each row: name, free/paid badge, type icon, hours estimate, external link), project description card, milestone callout box; use shadcn/ui Accordion
- [ ] T159 [P] [US11] Create `frontend/src/components/CareerInsightCard.tsx` — displays: salary range (local/remote) as a highlighted stat row, market demand badge (High/Medium/Low with colour), top 5 companies as logo-placeholder chips, hot skills as coloured badge list
- [ ] T160 [P] [US11] Create `frontend/src/components/QuickWinsCard.tsx` — numbered list of 3 immediate actions; each shows action text, a "why" tooltip/tooltip, and time badge (e.g., "30 min"); UI-only checkboxes for personal tracking (stored in localStorage)
- [ ] T161 [US11] Create `frontend/src/pages/CareerRoadmap.tsx` — target role input + "Generate" button at top; total timeline summary bar (X weeks, Y phases, Z resources); `CareerInsightCard` (salary + market data); `QuickWinsCard`; vertical timeline of `RoadmapPhaseCard` components; left sidebar (or top dropdown) listing all saved roadmaps for this user with a "New Roadmap" button; loading skeleton while generation is in progress
- [ ] T162 [US11] Add roadmap API calls to `frontend/src/api.ts`: `generateRoadmap(sessionId, targetRole)`, `listRoadmaps()`, `getRoadmap(id)`; add `/roadmap` route to frontend router; add "Career Roadmap" nav item

**Checkpoint**: Roadmap generates with all required JSON fields. T149–T150 pass. Frontend renders phases, resources, and career insight correctly. IDOR check blocks access to other users' roadmaps.

---

## Phase 12: User Story 3 — Subscription Plans & Feature Gating (Priority: P2)

**Goal**: Free / Professional / Recruiter tiers, Paymob checkout, feature-gated endpoints, subscription lifecycle. Referral credits from Phase 9 are applied at activation time.

**Independent Test**: Free user hits gated endpoint → 402 → visits Pricing page → Paymob checkout → webhook fires → account upgraded → gated endpoint now returns 200 → if referred user, referrer gets 1 free month credited.

### Tests for User Story 3

> **Write these FIRST — confirm they FAIL before implementing**

- [ ] T048 [P] [US3] Unit tests for subscription service in `Backend/tests/unit/test_subscription_service.py`: entitlement check, plan lookup, activation, lapse, free-tier default, referral credit applied on activation
- [ ] T049 [P] [US3] Unit tests for Paymob service in `Backend/tests/unit/test_payment_paymob.py`: order creation mocked, payment key mocked, auth token mocked
- [ ] T050 [P] [US3] Integration test for subscription flow in `Backend/tests/integration/test_subscriptions.py`: plans list, checkout creates pending, 402 on gated endpoint, cancel flow
- [ ] T051 [P] [US3] Integration test for Paymob webhook in `Backend/tests/integration/test_payments.py`: valid signature activates, invalid signature rejected + logged, duplicate delivery idempotent, payment history returned

### Implementation for User Story 3

- [ ] T052 [P] [US3] Create `Backend/models/subscription.py` — `SubscriptionPlan`, `FeatureEntitlement`, `Subscription`, `Payment` models per data-model.md
- [ ] T053 [US3] Create `Backend/migrations/versions/003_subscriptions.py` — tables + seed data: 3 plans (free/professional/recruiter) and all feature entitlement rows
- [ ] T054 [P] [US3] Add subscription-related schemas to `Backend/models/schemas.py`: `PlanResponse`, `CheckoutRequest`, `CheckoutResponse`, `SubscriptionStatusResponse`, `PaymentHistoryItem`
- [ ] T055 [US3] Create `Backend/services/subscription_service.py` — `get_user_subscription(user)`, `check_entitlement(user, feature_slug)`, `activate_subscription(db, subscription_id)` (also calls `apply_referral_reward()` from Phase 9 if applicable), `lapse_subscription(db, user_id)`, `get_or_create_free_subscription(db, user)`
- [ ] T056 [US3] Create `Backend/services/payment_paymob.py` — `get_auth_token()`, `create_order(auth_token, amount_piastres, user_email)`, `create_payment_key(auth_token, order_id, integration_id, user_email)`
- [ ] T057 [US3] Create `Backend/middleware/subscription_gate.py` — `require_feature(feature_slug)` FastAPI `Depends()` that calls `check_entitlement()` and raises `HTTPException(402)` with upgrade URL if not entitled
- [ ] T058 [US3] Create `Backend/routers/subscriptions.py` — `GET /subscriptions/plans` (public), `POST /subscriptions/checkout`, `GET /subscriptions/status`, `POST /subscriptions/cancel`
- [ ] T059 [US3] Create `Backend/routers/payments.py` — `POST /payments/webhook/paymob` (verify HMAC → idempotency check → activate → send confirmation email → audit log), `GET /payments/history`
- [ ] T060 [US3] Register `subscriptions` and `payments` routers in `Backend/app/main.py`
- [ ] T061 [P] [US3] Create `frontend/src/hooks/useSubscription.ts` — fetches `/subscriptions/status`, exposes `planSlug`, `entitlements`, `isEntitled(feature)`
- [ ] T062 [P] [US3] Create `frontend/src/hooks/usePayment.ts` — manages Paymob iframe state: `initiateCheckout(planSlug)`, `iframeToken`, `isLoading`, `error`
- [ ] T063 [P] [US3] Create `frontend/src/components/SubscriptionGate.tsx` — wrapper that renders children if entitled, otherwise renders upgrade prompt card
- [ ] T064 [P] [US3] Create `frontend/src/components/PricingCard.tsx` — plan card with name, price, feature list, CTA button; highlight recommended plan
- [ ] T065 [US3] Create `frontend/src/pages/Pricing.tsx` — three `PricingCard` components with annual/monthly toggle; Paymob iframe modal on checkout; referral discount applied automatically if user has pending referral credit
- [ ] T066 [US3] Extend `frontend/src/pages/Profile.tsx` — subscription status section: plan name, renewal date, cancel button, payment history, referral earnings card
- [ ] T067 [US3] Add subscription + payment calls to `frontend/src/api.ts`: `getPlans()`, `initiateCheckout(planSlug)`, `getSubscriptionStatus()`, `cancelSubscription()`, `getPaymentHistory()`
- [ ] T068 [US3] Add `/pricing` route to frontend router; add "Upgrade" link in nav for free-tier users; add "Pro" badge for paid users
- [ ] T069 [US3] Add `/payments` and `/subscriptions` proxy rules to `frontend/nginx.conf`

**Checkpoint**: Full subscription and payment cycle testable end-to-end. T048–T051 pass. Referral credit correctly applied on first subscription activation.

---

## Phase 13: Complete System Integration Testing [NEW]

**Goal**: Test the entire platform as a unified system — not individual features, but the full user journeys from registration to subscription to advanced feature use to account deletion. Catch integration failures that per-feature tests cannot see.

**Scope**: End-to-end test flows, load testing, security walkthrough, and cross-feature contract validation. This phase produces the go-live confidence report.

**Independent Test**: All test suites pass on a clean Docker environment with no prior state.

### E2E Test Flows (Playwright)

- [ ] T168 [P] Add Playwright to `frontend/package.json`: `@playwright/test`; create `frontend/e2e/` directory; configure `playwright.config.ts` to run against `http://localhost:3000`
- [ ] T169 [P] E2E test: Full new-user journey in `frontend/e2e/new-user.spec.ts` — register → verify email (mock resend) → login → upload CV → see score → view results; asserts no console errors, no broken navigations
- [ ] T170 [P] E2E test: Subscription journey in `frontend/e2e/subscription.spec.ts` — free user → hit locked feature → upgrade prompt appears → pricing page loads → (mock Paymob webhook) → feature unlocked; asserts 402 before and 200 after
- [ ] T171 [P] E2E test: Referral journey in `frontend/e2e/referral.spec.ts` — User A copies referral link → User B registers via link → User B subscribes (mocked webhook) → User A's stats show 1 conversion
- [ ] T172 [P] E2E test: Career roadmap flow in `frontend/e2e/roadmap.spec.ts` — log in → navigate to Career Roadmap → select an existing CV session → enter target role → submit → loading skeleton appears → roadmap renders with phases, resources, and career insight card; assert no console errors and all phase cards are expandable

### Backend System Tests

- [ ] T173 [US_ALL] Create `Backend/tests/system/test_full_user_lifecycle.py` — single test file that runs a complete lifecycle: register → verify → login → upload → analyze → subscribe → use premium feature → delete account; asserts all DB rows cleaned up, audit log intact after deletion
- [ ] T174 [US_ALL] Security regression: re-run full `test_security.py` suite against the complete system (all phases integrated); confirm 0 regressions; document any new attack surfaces introduced by Phase 5–12 endpoints
- [ ] T175 Create `Backend/tests/system/__init__.py`; add `Backend/tests/system/` to pytest discovery in `pytest.ini`

### Load & Performance Testing

- [ ] T176 [P] Create `Backend/tests/load/locustfile.py` (using `locust`) — simulate 50 concurrent users performing: login, upload CV (PDF stub), fetch results, get notifications; run 2-minute soak test; assert p95 response time < 500 ms on `/cv/upload` and < 100 ms on `/notifications/unread-count`; add `locust` to `Backend/requirements.txt`
- [ ] T177 [P] Run Lighthouse CI on Landing, Dashboard, Results pages from a clean Docker build; all must score ≥ 80 Performance on mobile; record scores in `specs/001-production-saas-launch/quality-report.md`

### Pre-Launch Security Walkthrough (FR-032)

- [ ] T178 Complete and document OWASP Top 10 walkthrough in `specs/001-production-saas-launch/security-report.md`: SQL injection, XSS, CSRF, brute force, path traversal, IDOR, directory listing, clickjacking, MitM, webhook replay; result must be "PASS" or "REMEDIATED" for each item before go-live

**Checkpoint**: All E2E tests pass. Lifecycle test passes. Load test meets p95 targets. OWASP walkthrough complete with no open findings.

---

## Phase 14: Polish & Pre-Launch

**Purpose**: Final hardening, documentation, environment validation.

- [ ] T115 [P] Update `Backend/.env.example` with all new variables: Resend, Paymob (4 vars), Postgres (3 vars), Adminer, log format, app base URL, admin secret, APScheduler timezone
- [ ] T116 [P] Update `frontend/nginx.conf` — confirm all proxy routes present: `/subscriptions`, `/payments`, `/jobs`, `/recruiter`, `/referrals`, `/notifications`, `/admin`, `/auth`
- [ ] T117 [P] Run full `pytest Backend/tests/ -v --cov=Backend` — fix any failures; target ≥ 80% coverage on all new code
- [ ] T118 [P] Run full `vitest run` in `frontend/` — fix any failures
- [ ] T119 Run final FR-032 OWASP walkthrough (cross-reference with T178 report); confirm all Phase 12+ endpoints are covered
- [ ] T120 Run `docker compose up --build` on a clean environment (no prior volumes); confirm all services healthy within 5 minutes; confirm Alembic migrations complete; confirm `/health` returns 200
- [ ] T121 [P] Rotate `JWT_SECRET` and `ADMIN_SECRET` in `.env`; confirm all existing sessions are invalidated; confirm new login works
- [ ] T122 Update `README.md` — reflect all features (subscriptions, payments, LinkedIn import, ATS tracker, recruiter dashboard, referral engine, admin BI, notification center), updated quick start, complete environment variable reference

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phases 1–4**: Complete ✅
- **Phase 5 (Enhanced AI)**: Depends on Phase 4 — needs auth and ownership checks in place
- **Phase 6 (ATS Tracker)**: Depends on Phase 4 (ownership checks) AND Phase 5 (AI analysis — `analyze_structured` used for per-job match scoring and prep generation)
- **Phase 7 (Recruiter)**: Depends on Phase 6 — shares `Backend/models/jobs.py` and migration 004
- **Phase 8 (Frontend Redesign)**: Depends on Phases 5–7 (redesigns the pages those phases introduce); can start Phase 8 tasks for Landing + Auth independently of Phases 5–7
- **Phase 9 (Referral)**: Depends on Phase 4 (needs auth). Independent of Phases 5–8. Must complete before Phase 12 so referral rewards integrate into subscription activation
- **Phase 10 (Admin BI)**: Depends on Phases 5–9 (metrics are only meaningful when all features exist)
- **Phase 11 (Career Roadmap)**: Depends on Phase 5 (roadmap uses the skills inventory from Enhanced AI analysis as input). Independent of Phases 9–10
- **Phase 12 (Subscriptions)**: Depends on Phases 9–11 (referral credits, subscription notifications, admin visibility all needed at activation time)
- **Phase 13 (System Testing)**: Depends on all Phases 5–12 complete
- **Phase 14 (Polish)**: Depends on Phase 13 passing

### Within Each Phase

- Tests MUST be written and FAIL before implementation begins
- Models before services; services before routers
- Migrations MUST be created before running tests that touch the DB
- Frontend calls MUST only be added after the backend endpoint exists

### Parallel Opportunities

All tasks marked `[P]` within a phase can run simultaneously.

Key parallel windows:
- Phase 5: T070–T071 (tests) in parallel; T074, T079, T080, T081 in parallel (different files)
- Phase 6: T085 + T085b (tests) in parallel; T086 + T086b + T086c (models) in parallel; T089b + T089c added after T089; T091 + T091b + T091c + T091d + T091e all in parallel (different component files)
- Phase 6 → 7: Phase 7 starts after Phase 6 is complete; T096 extends Backend/models/jobs.py, T097 creates new migration 006_recruiter_tables.py (down_revision="005") — 004 is already applied and must not be edited
- Phase 8: All T106–T114 in parallel (different page files); start during Phase 6/7 for Landing + Auth pages
- Phase 9: T123–T124 (tests) in parallel; T125, T127, T132, T133 in parallel
- Phase 10: T136–T137 (tests) in parallel; T139, T140, T144, T145 in parallel
- Phase 11: T149–T150 (tests) in parallel; T151, T153, T158, T159, T160 in parallel (different component files)
- Phase 13: T168, T169, T170, T171, T172 (Playwright) all in parallel; T176, T177 in parallel

---

## Implementation Strategy

### Completed (Phases 1–4) ✅

HireIQ is hardened and production-ready from a security standpoint. 80 tests pass. All OWASP controls in place.

### Current Sprint (Phases 5–8): Product Completeness

Build all product features before monetisation. Users will see full value before being asked to pay.

1. Phase 5: Enhanced AI — deepens the core value proposition
2. Phase 6: ATS Tracker — daily retention hook (users return to update job status)
3. Phase 7: Recruiter Dashboard — B2B upsell surface
4. Phase 8: Frontend redesign — commercial credibility before launch

### Next Sprint (Phases 9–11): Platform & Growth Infrastructure

Features that are invisible to users but drive the business metrics:

5. Phase 9: Referral Engine — zero-cost acquisition channel
6. Phase 10: Admin BI Dashboard — founder visibility into what's working
7. Phase 11: Notification Center — retention + re-engagement

### Monetisation Sprint (Phase 12): Revenue Layer

All features are live and tested. Now gate them properly and take payments.

8. Phase 12: Subscriptions + Paymob — revenue-ready with referral credits integrated from day one

### Validation & Launch (Phases 13–14): Confidence Gate

9. Phase 13: Full system testing — catch integration failures
10. Phase 14: Polish + pre-launch checklist → go-live

---

## Notes

- `[P]` = different files, no blocking dependencies within the phase
- `[USn]` maps to user story n for traceability back to spec.md
- Alembic migrations MUST be created in the phase where their models are first defined; do NOT run `alembic upgrade head` manually — Docker CMD handles it
- All backend tests use real PostgreSQL (test DB) — no SQLite, no mocks for the DB layer (per constitution Principle II)
- Commit after each phase checkpoint, not after individual tasks
- Phase 8 frontend redesign: reference actual open-source SaaS UIs on GitHub before writing a single line — the goal is a product that looks funded, not a tutorial app
