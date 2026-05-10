---
description: "Task list for HireIQ Production SaaS Launch"
---

# Tasks: HireIQ Production SaaS Launch

**Input**: Design documents from `specs/001-production-saas-launch/`
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ data-model.md ✅ contracts/ ✅

**Tests**: Required per constitution (Principle II) — unit + integration for every new endpoint.

**Organization**: Phases 1–2 are shared foundations. Phases 3–10 map 1:1 to user stories.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1–US8 maps to spec user stories / premium features
- Every task includes an exact file path

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Test runners, dependency updates, TypeScript enforcement. No business logic.

- [ ] T001 Verify `strict: true` is set in `frontend/tsconfig.json`; add it if missing and fix any resulting type errors
- [ ] T002 [P] Add backend test dependencies to `Backend/requirements.txt`: `pytest>=8`, `httpx`, `pytest-asyncio`, `pytest-cov`, `loguru`, `resend`
- [ ] T003 [P] Add frontend test dependencies to `frontend/package.json`: `vitest`, `@testing-library/react`, `@testing-library/user-event`, `jsdom`
- [ ] T004 Create `Backend/tests/__init__.py`, `Backend/tests/unit/__init__.py`, `Backend/tests/integration/__init__.py`
- [ ] T005 [P] Create `Backend/tests/conftest.py` with fixtures: `test_db` (transaction rollback), `test_client` (FastAPI TestClient), `auth_headers` (pre-authenticated user), `subscribed_headers` (Professional-tier user)
- [ ] T006 [P] Add `vitest.config.ts` to `frontend/` configuring jsdom environment and coverage

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infrastructure that every user story depends on. MUST be complete before any story work.

**⚠️ CRITICAL**: No user story implementation can begin until Phase 2 is complete.

- [ ] T007 Fix `Backend/.env.docker` — remove hardcoded `DATABASE_URL`; replace with `DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}`
- [ ] T008 Fix `Backend/app/config.py` — indent the `Config` inner class inside the `Settings` class body so `.env` loading works correctly; add all new env var fields (`RESEND_API_KEY`, `FROM_EMAIL`, `APP_BASE_URL`, `PAYMOB_API_KEY`, `PAYMOB_INTEGRATION_ID`, `PAYMOB_HMAC_SECRET`, `PAYMOB_IFRAME_ID`, `ADMINER_PASSWORD`)
- [ ] T009 Add `postgres` service (`postgres:16-alpine`, named volume, env vars from `.env`) and `adminer` service (port 8080, SSH-tunnel-only access) to `docker-compose.yml`; remove `host.docker.internal` reference
- [ ] T010 Initialise Alembic: run `alembic init Backend/migrations`; configure `Backend/migrations/env.py` to import `Base` from all models and set `target_metadata = Base.metadata`; update `Backend/migrations/alembic.ini` to read `sqlalchemy.url` from env
- [ ] T011 Create migration `Backend/migrations/versions/001_initial.py` — baseline snapshot of existing `users`, `cv_sessions`, `interview_results` tables
- [ ] T012 Update `Backend/app/main.py`: remove `create_tables()` startup call; add `alembic upgrade head` as a Docker `CMD` pre-step (or startup event using `subprocess`)
- [ ] T013 [P] Replace all `print()` calls in `Backend/` with `from loguru import logger` statements; configure loguru JSON sink when `LOG_FORMAT=json` env var is set (in `Backend/app/config.py`)
- [ ] T014 [P] Create `Backend/middleware/security_headers.py` — `SecurityHeadersMiddleware` class that injects `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Content-Security-Policy`, `Referrer-Policy` on every response
- [ ] T015 Register `SecurityHeadersMiddleware` in `Backend/app/main.py` before the CORS middleware
- [ ] T016 Fix `user_id` column in `Backend/models/user.py` CVSession — change `nullable=True` to `nullable=False`
- [ ] T017 [P] Create `Backend/models/security.py` — `SecurityAuditLog` model with columns: `id`, `event_type`, `user_id` (no FK), `source_ip`, `outcome`, `detail`, `created_at`
- [ ] T018 [P] Create `Backend/services/security_service.py` — `write_audit_log(db, event_type, source_ip, outcome, user_id=None, detail=None)` and `verify_paymob_hmac(payload, received_hmac)` helpers
- [ ] T019 Add global exception handler to `Backend/app/main.py` that catches unhandled exceptions and returns `{"detail": "Internal server error", "ref": "<uuid>"}` — never exposing stack traces

**Checkpoint**: All services start via `docker compose up --build`; `/health` returns 200; Adminer accessible at localhost:8080 via tunnel; Alembic migrations run on start.

---

## Phase 3: User Story 1 — Secure, Verified Registration & Login (Priority: P1) 🎯

**Goal**: Email verification, password reset, account lockout, session invalidation.

**Independent Test**: Register → receive verification email → verify → login → logout → confirm token invalid → request password reset → reset → confirm old password invalid.

### Tests for User Story 1

> **Write these FIRST — confirm they FAIL before implementing**

- [ ] T020 [P] [US1] Integration tests (registration + verification flow) in `Backend/tests/integration/test_auth.py`: test verified login, unverified login blocked, duplicate email, resend verification, expired token
- [ ] T021 [P] [US1] Integration tests (password reset flow) in `Backend/tests/integration/test_auth.py`: valid reset, expired token, already-used token, old password invalidated after reset
- [ ] T022 [P] [US1] Unit tests for lockout logic in `Backend/tests/unit/test_auth_service.py`: 5 failures → lock, lockout expires, notification sent

### Implementation for User Story 1

- [ ] T023 [P] [US1] Add `email_verified`, `failed_login_count`, `locked_until` columns to `User` in `Backend/models/user.py`
- [ ] T024 [P] [US1] Add `EmailVerificationToken` model to `Backend/models/user.py` (fields: id, user_id FK, token UUID, expires_at, used_at)
- [ ] T025 [P] [US1] Add `PasswordResetToken` model to `Backend/models/user.py` (fields: id, user_id FK, token UUID, expires_at 1hr, used_at)
- [ ] T026 [US1] Create `Backend/migrations/versions/002_auth_hardening.py` — add three User columns, add EmailVerificationToken and PasswordResetToken tables; set `email_verified=false` for existing rows; fix `cv_sessions.user_id NOT NULL`
- [ ] T027 [P] [US1] Add verification + reset + lockout schemas to `Backend/models/schemas.py`: `VerifyEmailRequest`, `ForgotPasswordRequest`, `ResetPasswordRequest`, `UserProfileResponse` (extended with `email_verified`, `subscription`)
- [ ] T028 [US1] Extend `Backend/services/auth_service.py` — add: `create_verification_token()`, `consume_verification_token()`, `create_reset_token()`, `consume_reset_token()`, `check_lockout()`, `record_failed_login()`, `clear_failed_logins()`
- [ ] T029 [US1] Extend `Backend/services/auth_service.py` — add JWT blacklist: `blacklist_jti(jti, ttl)` and `is_blacklisted(jti)` using Redis `SETEX`; add `jti` UUID claim to token creation functions
- [ ] T030 [P] [US1] Create `Backend/services/email_service.py` — `send_verification_email(to, token)`, `send_password_reset_email(to, token)`, `send_payment_confirmation_email(to, amount, plan)`, `send_subscription_lapse_warning(to, ends_at)` using Resend SDK
- [ ] T031 [US1] Add `POST /auth/verify-email` to `Backend/routers/auth.py` (consume token, set `email_verified=true`, log to SecurityAuditLog)
- [ ] T032 [US1] Add `POST /auth/resend-verification` to `Backend/routers/auth.py` (rate-limited 3/hr per user; invalidate previous token)
- [ ] T033 [US1] Add `POST /auth/forgot-password` to `Backend/routers/auth.py` (always 200; rate-limited 3/hr; log attempt)
- [ ] T034 [US1] Add `POST /auth/reset-password` to `Backend/routers/auth.py` (consume token, update password, blacklist all existing JTIs for user)
- [ ] T035 [US1] Update `POST /auth/login` in `Backend/routers/auth.py` — add lockout check before verifying password; call `record_failed_login()` on failure; call `clear_failed_logins()` on success; block login if `email_verified=false`
- [ ] T036 [US1] Update `POST /auth/refresh` in `Backend/routers/auth.py` — check JTI not blacklisted before issuing new tokens; blacklist old refresh token JTI after rotation
- [ ] T037 [US1] Add `DELETE /auth/logout` to `Backend/routers/auth.py` — blacklist both access and refresh token JTIs; log to SecurityAuditLog
- [ ] T038 [US1] Add email verification banner to `frontend/src/pages/Auth.tsx` (shows after registration, hides after verification)

**Checkpoint**: User Story 1 fully testable independently. All T020–T022 tests pass.

---

## Phase 4: User Story 6 — Platform Security & Attack Prevention (Priority: P1)

**Goal**: OWASP controls, file upload hardening, IDOR prevention, audit trail, account deletion.

**Independent Test**: Run the security test suite; all 10 attack scenarios in `test_security.py` are blocked and logged.

### Tests for User Story 6

> **Write these FIRST — confirm they FAIL before implementing**

- [ ] T039 [P] [US6] Unit tests for HMAC verification in `Backend/tests/unit/test_security_service.py`: valid signature accepted, tampered payload rejected, missing signature rejected, duplicate webhook idempotency
- [ ] T040 [P] [US6] Integration security test suite in `Backend/tests/integration/test_security.py`: SQL injection in all input fields, XSS payload in username/notes, IDOR (access other user's session), forged Paymob webhook, malicious file upload (exe as PDF), rate limit enforcement, missing security headers check

### Implementation for User Story 6

- [ ] T041 [US6] Create `Backend/migrations/versions/006_security_audit_log.py` — add `security_audit_logs` table (no FK on user_id to survive user deletion)
- [ ] T042 [US6] Add MIME-type magic-byte validation to `POST /cv/upload` in `Backend/routers/cv.py` — read first 8 bytes, verify PDF magic (`%PDF`); reject non-PDF with 422; enforce 10 MB limit; store file with UUID filename (discard original)
- [ ] T043 [US6] Add `require_ownership(resource_user_id, current_user_id)` helper to `Backend/services/auth_service.py` — raises `404 Not Found` (not 403) on mismatch; apply to all `GET /cv/{id}/*` and `DELETE /cv/{id}` endpoints
- [ ] T044 [US6] Apply `require_ownership` to all resource endpoints: `Backend/routers/cv.py` (sessions, detail, score, report, delete), `Backend/routers/jobs.py` (all), `Backend/routers/recruiter.py` (all)
- [ ] T045 [US6] Add `write_audit_log()` calls to all auth endpoints in `Backend/routers/auth.py` (login success/failure, logout, password change, verification)
- [ ] T046 [US6] Add `DELETE /auth/account` to `Backend/routers/auth.py` — delete CV files from disk, delete DB rows (user, sessions, results, jobs, tokens), send confirmation email; complete within 24h guarantee via immediate sync deletion
- [ ] T047 [US6] Add CSRF protection to state-changing frontend requests in `frontend/src/api.ts` — send `X-Requested-With: XMLHttpRequest` header; validate in `Backend/app/main.py` middleware for non-GET routes

**Checkpoint**: All T039–T040 tests pass. `test_security.py` shows all 10 attack scenarios blocked.

---

## Phase 5: User Story 3 — Subscription Plans & Feature Gating (Priority: P2)

**Goal**: Free / Professional / Recruiter tiers, Paymob checkout, feature-gated endpoints, subscription lifecycle.

**Independent Test**: Free user hits gated endpoint → 402 → visits Pricing page → Paymob checkout → webhook fires → account upgraded → gated endpoint now returns 200.

### Tests for User Story 3

> **Write these FIRST — confirm they FAIL before implementing**

- [ ] T048 [P] [US3] Unit tests for subscription service in `Backend/tests/unit/test_subscription_service.py`: entitlement check, plan lookup, activation, lapse, free-tier default
- [ ] T049 [P] [US3] Unit tests for Paymob service in `Backend/tests/unit/test_payment_paymob.py`: order creation mocked, payment key mocked, auth token mocked
- [ ] T050 [P] [US3] Integration test for subscription flow in `Backend/tests/integration/test_subscriptions.py`: plans list, checkout creates pending, 402 on gated endpoint, cancel flow
- [ ] T051 [P] [US3] Integration test for Paymob webhook in `Backend/tests/integration/test_payments.py`: valid signature activates, invalid signature rejected + logged, duplicate delivery idempotent, payment history returned

### Implementation for User Story 3

- [ ] T052 [P] [US3] Create `Backend/models/subscription.py` — `SubscriptionPlan`, `FeatureEntitlement`, `Subscription`, `Payment` models per data-model.md
- [ ] T053 [US3] Create `Backend/migrations/versions/003_subscriptions.py` — tables + seed data: 3 plans (free/professional/recruiter) and all feature entitlement rows
- [ ] T054 [P] [US3] Add subscription-related schemas to `Backend/models/schemas.py`: `PlanResponse`, `CheckoutRequest`, `CheckoutResponse`, `SubscriptionStatusResponse`, `PaymentHistoryItem`
- [ ] T055 [US3] Create `Backend/services/subscription_service.py` — `get_user_subscription(user)`, `check_entitlement(user, feature_slug)`, `activate_subscription(db, subscription_id)`, `lapse_subscription(db, user_id)`, `get_or_create_free_subscription(db, user)`
- [ ] T056 [US3] Create `Backend/services/payment_paymob.py` — `get_auth_token()`, `create_order(auth_token, amount_piastres, user_email)`, `create_payment_key(auth_token, order_id, integration_id, user_email)` using `httpx` async client
- [ ] T057 [US3] Create `Backend/middleware/subscription_gate.py` — `require_feature(feature_slug)` returns a FastAPI `Depends()` that checks `check_entitlement()` and raises `HTTPException(402)` with upgrade URL if not entitled
- [ ] T058 [US3] Create `Backend/routers/subscriptions.py` — `GET /subscriptions/plans` (public), `POST /subscriptions/checkout`, `GET /subscriptions/status`, `POST /subscriptions/cancel`
- [ ] T059 [US3] Create `Backend/routers/payments.py` — `POST /payments/webhook/paymob` (verify HMAC → idempotency check → activate → send confirmation email → audit log), `GET /payments/history`
- [ ] T060 [US3] Register `subscriptions` and `payments` routers in `Backend/app/main.py`
- [ ] T061 [P] [US3] Create `frontend/src/hooks/useSubscription.ts` — fetches `/subscriptions/status`, exposes `planSlug`, `entitlements`, `isEntitled(feature)`
- [ ] T062 [P] [US3] Create `frontend/src/hooks/usePayment.ts` — manages Paymob iframe state: `initiateCheckout(planSlug)`, `iframeToken`, `isLoading`, `error`
- [ ] T063 [P] [US3] Create `frontend/src/components/SubscriptionGate.tsx` — wrapper that renders children if entitled, otherwise renders upgrade prompt card
- [ ] T064 [P] [US3] Create `frontend/src/components/PricingCard.tsx` — plan card with name, price, feature list, CTA button
- [ ] T065 [US3] Create `frontend/src/pages/Pricing.tsx` — three `PricingCard` components, Paymob iframe modal on checkout
- [ ] T066 [US3] Extend `frontend/src/pages/Profile.tsx` — add subscription status section: plan name, renewal date, cancel button, payment history
- [ ] T067 [US3] Add subscription + payment calls to `frontend/src/api.ts`: `getPlans()`, `initiateCheckout(planSlug)`, `getSubscriptionStatus()`, `cancelSubscription()`, `getPaymentHistory()`
- [ ] T068 [US3] Add `/pricing` route to frontend router; add "Upgrade" link in navigation for free-tier users
- [ ] T069 [US3] Add `/payments` proxy rule to `frontend/nginx.conf`; add `/subscriptions` proxy rule

**Checkpoint**: Full subscription and payment cycle testable end-to-end. T048–T051 pass.

---

## Phase 6: User Story 4 — Enhanced AI Analysis & Interview Intelligence (Priority: P2)

**Goal**: Structured skills inventory, gap report, study roadmap, LinkedIn PDF import.

**Independent Test**: Upload a CV → request enhanced analysis → receive skills inventory with ≥10 skills, gap report, 5+ questions with model answers, study roadmap — all within 30 seconds. Upload a LinkedIn PDF export → same result.

### Tests for User Story 4

> **Write these FIRST — confirm they FAIL before implementing**

- [ ] T070 [P] [US4] Unit test for enhanced LLM analyzer in `Backend/tests/unit/test_llm_analyzer.py`: structured output schema validation, fallback on AI error, credit not consumed on error
- [ ] T071 [P] [US4] Integration test for enhanced CV analysis in `Backend/tests/integration/test_cv.py`: skills inventory populated, gap report returned, 402 for free-tier on `/cv/{id}/analysis`

### Implementation for User Story 4

- [ ] T072 [US4] Update LLM prompt in `Backend/rag/prompts.py` — add structured output instructions for skills inventory (hard skills + experience level), gap report (skill, importance, resources), study roadmap (topic, priority, estimated hours, resources)
- [ ] T073 [US4] Extend `Backend/services/llm_analyzer.py` — `analyze_structured(cv_text, jd_text)` returns parsed JSON dict with `skill_inventory`, `gap_report`, `study_roadmap`, `questions`; handles malformed LLM output gracefully
- [ ] T074 [P] [US4] Create `Backend/services/linkedin_service.py` — `is_linkedin_pdf(file_bytes)` (checks first page for "LinkedIn" keyword), reuses `cv_parser.py` pipeline for text extraction
- [ ] T075 [US4] Create `Backend/migrations/versions/005_cv_session_extended.py` — add `skill_inventory` (JSON), `gap_report` (JSON), `study_roadmap` (JSON), `subscription_tier` (String) to `cv_sessions`
- [ ] T076 [US4] Add `GET /cv/{id}/analysis` endpoint to `Backend/routers/cv.py` — requires `enhanced-analysis` entitlement; returns stored analysis or 202 if still processing
- [ ] T077 [US4] Extend `GET /analyze` SSE stream in `Backend/routers/analysis.py` — for users with `enhanced-analysis` entitlement, emit `skill_inventory`, `gap_report`, `study_roadmap` events in addition to existing `questions` event; save results to `CVSession` columns
- [ ] T078 [US4] Extend `POST /cv/upload` in `Backend/routers/cv.py` — call `linkedin_service.is_linkedin_pdf()`; if LinkedIn PDF, require `linkedin-import` entitlement; set `session.is_linkedin = true` (or tag in filename)
- [ ] T079 [P] [US4] Create `frontend/src/components/SkillsInventory.tsx` — renders hard/soft skills as tagged badges with experience level indicators
- [ ] T080 [P] [US4] Create `frontend/src/components/SkillGapChart.tsx` — horizontal bar chart showing gap importance per missing skill
- [ ] T081 [P] [US4] Create `frontend/src/components/StudyRoadmap.tsx` — vertical timeline of roadmap topics with priority badges and resource links
- [ ] T082 [US4] Extend `frontend/src/pages/Results.tsx` — wrap enhanced sections in `<SubscriptionGate feature="enhanced-analysis">`; render `SkillsInventory`, `SkillGapChart`, `StudyRoadmap` for subscribed users
- [ ] T083 [US4] Extend `frontend/src/pages/Upload.tsx` — add "Import from LinkedIn" tab with step-by-step export instructions and same file upload widget
- [ ] T084 [US4] Add enhanced analysis calls to `frontend/src/api.ts`: `getEnhancedAnalysis(sessionId)`

**Checkpoint**: Enhanced analysis and LinkedIn import work independently. T070–T071 pass.

---

## Phase 7: ATS Job Tracker (Priority: P2)

**Goal**: Job application tracking with status pipeline and CV-match scoring per job.

**Independent Test**: Subscribed user creates a job application, moves it through status stages (saved → applied → interview), links a CV session, and sees the match score on the job card.

### Tests for User Story 7

> **Write these FIRST — confirm they FAIL before implementing**

- [ ] T085 [P] [US7] Integration test for job tracker in `Backend/tests/integration/test_jobs.py`: CRUD operations, status transitions, 402 for free-tier, stats endpoint, ownership check (404 on other user's job)

### Implementation for User Story 7

- [ ] T086 [P] [US7] Create `Backend/models/jobs.py` — `JobApplication` model per data-model.md
- [ ] T087 [US7] Create `Backend/migrations/versions/004_jobs_recruiter.py` — add `job_applications` table (recruiter tables added in Phase 8)
- [ ] T088 [P] [US7] Add `JobApplicationCreate`, `JobApplicationUpdate`, `JobApplicationResponse`, `JobStatsResponse` schemas to `Backend/models/schemas.py`
- [ ] T089 [US7] Create `Backend/routers/jobs.py` — `GET /jobs`, `POST /jobs`, `PATCH /jobs/{id}`, `DELETE /jobs/{id}`, `GET /jobs/stats`; all require `job-tracker` entitlement; apply `require_ownership` on `{id}` routes
- [ ] T090 [US7] Register `jobs` router in `Backend/app/main.py`; add `/jobs` proxy rule to `frontend/nginx.conf`
- [ ] T091 [P] [US7] Create `frontend/src/components/JobCard.tsx` — card with title, company, status badge, match score, notes snippet, action buttons
- [ ] T092 [US7] Create `frontend/src/pages/Jobs.tsx` — job list view with status filter tabs (kanban-style columns); add/edit job modal using shadcn/ui Dialog
- [ ] T093 [US7] Add job tracker calls to `frontend/src/api.ts`: `getJobs(status?)`, `createJob(data)`, `updateJob(id, data)`, `deleteJob(id)`, `getJobStats()`
- [ ] T094 [US7] Add `/jobs` route to frontend router; add nav item (gated — hidden or shows upgrade prompt for free users)

**Checkpoint**: Job tracker independently testable. T085 passes.

---

## Phase 8: Recruiter Dashboard (Priority: P2)

**Goal**: Employer-facing multi-candidate comparison, ranked shortlist, PDF export.

**Independent Test**: Recruiter-tier user creates a candidate list, uploads 3 CVs, adds all as candidates, views ranked comparison table, exports PDF report.

### Tests for User Story 8

> **Write these FIRST — confirm they FAIL before implementing**

- [ ] T095 [P] [US8] Integration test for recruiter dashboard in `Backend/tests/integration/test_recruiter.py`: list CRUD, add candidate, 20-candidate limit enforcement, rank update, PDF export returns PDF, 402 for non-Recruiter tier

### Implementation for User Story 8

- [ ] T096 [P] [US8] Add `RecruiterList` and `RecruiterCandidate` models to `Backend/models/jobs.py` per data-model.md
- [ ] T097 [US8] Update `Backend/migrations/versions/004_jobs_recruiter.py` — add `recruiter_lists` and `recruiter_candidates` tables
- [ ] T098 [P] [US8] Add `RecruiterListCreate`, `RecruiterListResponse`, `RecruiterCandidateResponse`, `RecruiterCandidateUpdate` schemas to `Backend/models/schemas.py`
- [ ] T099 [US8] Create `Backend/routers/recruiter.py` — `GET /recruiter/lists`, `POST /recruiter/lists`, `DELETE /recruiter/lists/{id}`, `GET /recruiter/lists/{id}/candidates`, `POST /recruiter/lists/{id}/candidates`, `DELETE /recruiter/lists/{id}/candidates/{cid}`, `PATCH /recruiter/lists/{id}/candidates/{cid}`, `GET /recruiter/lists/{id}/export`; all require `recruiter-dashboard` entitlement
- [ ] T100 [US8] Extend `Backend/services/report_generator.py` — `generate_recruiter_report(recruiter_list, candidates)` produces PDF with ranked candidate table, scores, and top skills per candidate
- [ ] T101 [US8] Register `recruiter` router in `Backend/app/main.py`; add `/recruiter` proxy rule to `frontend/nginx.conf`
- [ ] T102 [P] [US8] Create `frontend/src/components/CandidateCompare.tsx` — sortable table of candidates with score, skills chips, rank badge, remove button
- [ ] T103 [US8] Create `frontend/src/pages/Recruiter.tsx` — list manager (create/delete lists), candidate compare view, export PDF button; wrap in `<SubscriptionGate feature="recruiter-dashboard">`
- [ ] T104 [US8] Add recruiter calls to `frontend/src/api.ts`: `getRecruiterLists()`, `createList(data)`, `deleteList(id)`, `getCandidates(listId)`, `addCandidate(listId, sessionId)`, `removeCandidate(listId, candidateId)`, `updateCandidateRank(listId, candidateId, rank)`, `exportRecruiterReport(listId)`
- [ ] T105 [US8] Add `/recruiter` route to frontend router; visible in nav only for Recruiter-tier users

**Checkpoint**: Recruiter dashboard independently testable. T095 passes.

---

## Phase 9: User Story 5 — Professional Frontend Redesign (Priority: P3)

**Goal**: shadcn/ui component system, polished landing page, mobile-responsive, < 3 s first paint.

**Independent Test**: Independent evaluator rates landing page and app UI ≥ 4/5. Lighthouse mobile score ≥ 80. All pages functional on 375 px viewport.

- [ ] T106 [P] [US5] Install shadcn/ui: run `npx shadcn-ui@latest init` in `frontend/`; add components: Button, Card, Dialog, Sheet, Badge, Tabs, Table, Input, Select, Form, Progress, Avatar, DropdownMenu, Separator, Tooltip
- [ ] T107 [P] [US5] Create `frontend/src/lib/utils.ts` — export `cn()` helper (Tailwind class merge utility)
- [ ] T108 [US5] Redesign `frontend/src/pages/Landing.tsx` — hero with value proposition, feature highlights (3 columns), pricing preview section, CTA buttons; use shadcn/ui Card and Button
- [ ] T109 [P] [US5] Redesign `frontend/src/pages/Auth.tsx` — polished login/register form using shadcn/ui Form, Input; add email verification status banner
- [ ] T110 [P] [US5] Redesign `frontend/src/pages/Dashboard.tsx` — stat cards (total sessions, avg score, interviews, plan badge), recent sessions list, subscription status card
- [ ] T111 [P] [US5] Redesign `frontend/src/pages/Upload.tsx` — drag-and-drop file zone, LinkedIn tab, JD template chips; use shadcn/ui Tabs
- [ ] T112 [P] [US5] Redesign `frontend/src/pages/Results.tsx` — score gauge prominently, skills panel, streaming analysis with progressive loading states
- [ ] T113 [US5] Audit and fix mobile responsiveness for all 12 pages at 375 px, 768 px, 1 280 px breakpoints; no horizontal overflow, all buttons tappable
- [ ] T114 [US5] Run Lighthouse on Landing, Dashboard, and Results pages; fix issues until mobile Performance ≥ 80 and FCP ≤ 3 s

**Checkpoint**: Independent UI evaluation passes ≥ 4/5. Lighthouse scores meet targets.

---

## Phase 10: Polish & Cross-Cutting Concerns

**Purpose**: Final hardening, documentation, and pre-launch validation.

- [ ] T115 [P] Update `Backend/.env.example` with all new variables: Resend, Paymob (4 vars), Postgres (3 vars), Adminer, log format, app base URL
- [ ] T116 [P] Update `frontend/nginx.conf` — confirm all new proxy routes present: `/subscriptions`, `/payments`, `/jobs`, `/recruiter`, `/auth` (verify-email, forgot-password, reset-password)
- [ ] T117 [P] Run full `pytest Backend/tests/ -v --cov=Backend` — fix any failures; target ≥ 80% coverage on new code
- [ ] T118 [P] Run full `vitest run` in `frontend/` — fix any failures
- [ ] T119 Complete FR-032 OWASP Top 10 security walkthrough: test SQL injection, XSS, CSRF, brute force, path traversal, IDOR, file upload bypass, clickjacking (X-Frame-Options), webhook replay, error response leaks — document results
- [ ] T120 Run `docker compose up --build` on a clean environment (no prior volumes); confirm all services healthy within 5 minutes; confirm Alembic migrations complete; confirm `/health` returns 200
- [ ] T121 [P] Rotate `JWT_SECRET` in `.env`; confirm all existing sessions are invalidated; confirm new login works
- [ ] T122 Update `README.md` — reflect new features (subscriptions, payments, LinkedIn import, ATS tracker, recruiter dashboard), updated quick start, new environment variables

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — BLOCKS all user stories
- **US1 Auth (Phase 3)**: Depends on Phase 2 — no dependency on other stories
- **US6 Security (Phase 4)**: Depends on Phase 3 (needs auth endpoints to add audit log calls)
- **US3 Subscriptions (Phase 5)**: Depends on Phase 4 (security gate must be in place before payments)
- **US4 Enhanced AI (Phase 6)**: Depends on Phase 5 (entitlement checks required)
- **US7 ATS Tracker (Phase 7)**: Depends on Phase 5 (entitlement checks required); independent of US4
- **US8 Recruiter (Phase 8)**: Depends on Phase 7 (shares migration and models/jobs.py)
- **US5 Frontend (Phase 9)**: Depends on Phases 3–8 (redesigns existing + new pages); can start earlier for Landing page only
- **Polish (Phase 10)**: Depends on all phases complete

### Within Each Phase

- Tests MUST be written and FAIL before implementation begins
- Models before services; services before routers
- Migrations MUST be created before running tests that touch the DB
- Frontend calls MUST only be added after the backend endpoint exists

### Parallel Opportunities

All tasks marked `[P]` within a phase can run simultaneously (different files, no shared state).

Key parallel windows:
- Phase 1: T002, T003, T005, T006 all in parallel
- Phase 2: T013, T014, T017, T018 in parallel after T009–T012 complete
- Phase 3: T020, T021, T022 (tests) in parallel; T023, T024, T025, T027, T030 in parallel
- Phase 9: T106–T112 all in parallel (different page files)

---

## Implementation Strategy

### MVP Scope (Phases 1–4 only)

Complete Phases 1–4 first to produce a shippable hardened application with production-grade auth and security — even without subscriptions. This is demonstrable to the customer as a "Phase 1 delivery."

1. Phase 1: Setup
2. Phase 2: Foundational (Docker, migrations, security headers)
3. Phase 3: US1 — Auth hardening
4. Phase 4: US6 — Security controls
5. **STOP + VALIDATE**: Deploy to VPS; run security walkthrough on MVP only

### Full SaaS Delivery (Phases 5–10)

1. Phase 5: Subscriptions + Paymob → revenue-ready
2. Phase 6: Enhanced AI + LinkedIn → premium value
3. Phase 7: ATS Tracker → daily retention
4. Phase 8: Recruiter Dashboard → B2B upsell
5. Phase 9: Frontend redesign → commercial credibility
6. Phase 10: Polish + pre-launch checklist

---

## Notes

- `[P]` = different files, no blocking dependencies within the phase
- `[USn]` maps to user story n for traceability back to spec.md
- US7 (ATS Tracker) and US8 (Recruiter Dashboard) are premium features defined in spec Assumptions
- Alembic migrations MUST be created in the phase where their models are first defined; do NOT run `alembic upgrade head` manually — Docker CMD handles it
- All backend tests use real PostgreSQL (test DB) — no SQLite, no mocks for the DB layer (per constitution Principle II)
- Commit after each phase checkpoint, not after individual tasks
