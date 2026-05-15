# Tasks: HireIQ System Enhancement — Phase 2

**Branch**: `002-enhance-features-phase2`  
**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Data Model**: [data-model.md](./data-model.md)  
**Contracts**: [auth-otp](./contracts/auth-otp.md) | [profile](./contracts/profile.md) | [salary](./contracts/salary-benchmark.md) | [interview-bank](./contracts/interview-bank.md) | [token-management](./contracts/token-management.md)

> **Note for implementor**: Each task references the exact file to modify/create and what it should do. Before starting any task, read the contract or data-model section referenced in that task's description. Tests are included and MANDATORY per the project constitution — write them before or alongside the implementation, never skip them.

---

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel with other [P] tasks in the same phase (different files, no shared state)
- **[Story]**: Maps this task to a specific user story
- Tests marked with `[TEST]` must be written; they are mandatory per the HireIQ constitution

---

## Phase 1: Setup

**Purpose**: Prepare new directories, update environment configuration, and verify the dev stack before any code changes.

- [X] T001 Add all new environment variables to `Backend/.env.example` — add `OTP_HMAC_SECRET`, `OTP_EXPIRY_MINUTES=10`, `OTP_MAX_ATTEMPTS=5`, `OTP_RATE_LIMIT_PER_30MIN=3`, `FREE_TIER_ANALYSIS_LIMIT=2`, `FREE_TIER_WINDOW_DAYS=10`, `PAID_TIER_DAILY_TOKEN_LIMIT=10000`, `LLM_PROVIDER=groq`, `LLM_MODEL=llama-3.3-70b-versatile`, `GROQ_PRICE_PER_1K_TOKENS=0.0006`. Each var must have a comment explaining its purpose. See `specs/002-enhance-features-phase2/contracts/token-management.md` for the full list.
- [X] T002 [P] Create directory `Backend/data/` and subdirectory `Backend/data/questions/` — add empty `.gitkeep` files in each so they are tracked by git. These directories hold seed data files for salary benchmarks and interview questions.
- [X] T003 [P] Create directory `Backend/scripts/` and add an empty `Backend/scripts/__init__.py`. This directory will hold standalone data-management scripts that run inside the Docker container.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: All database models and migrations MUST be complete before any feature can be implemented. No user story work begins until this phase is done.

**⚠️ CRITICAL**: Complete ALL tasks in this phase before proceeding to Phase 3.

### Models

- [X] T004 Update `Backend/models/user.py` — make the following changes: (1) Remove the `EmailVerificationToken` class entirely. (2) Remove the `PasswordResetToken` class entirely. (3) Remove the `verification_tokens` and `reset_tokens` relationships from the `User` class. (4) Add two new columns to `User`: `is_admin = Column(Boolean, default=False, nullable=False)` and `tier = Column(String(10), default="free", nullable=False)`. (5) Add a new `OtpCode` SQLAlchemy model with columns: `id` (Integer PK), `email` (String, NOT NULL, indexed), `user_id` (Integer FK to users.id, nullable, indexed), `code_hmac` (String(64), NOT NULL), `purpose` (String(20), NOT NULL — values: `registration`, `password_change`, `password_reset`), `expires_at` (DateTime, NOT NULL), `attempt_count` (Integer, default=0, NOT NULL), `used_at` (DateTime, nullable), `created_at` (DateTime, default=datetime.utcnow). (6) Add a new `UserProfile` SQLAlchemy model with columns: `id` (Integer PK), `user_id` (Integer FK to users.id, UNIQUE, NOT NULL), `stored_cv_path` (String, nullable), `stored_cv_filename` (String, nullable), `linkedin_url` (String(500), nullable), `github_url` (String(500), nullable), `portfolio_url` (String(500), nullable), `bio` (Text, nullable), `avatar_url` (String(500), nullable), `updated_at` (DateTime, NOT NULL, default=datetime.utcnow). (7) Add `profile` relationship to `User` → `UserProfile`. See `specs/002-enhance-features-phase2/data-model.md` migrations 009 and 010 for full schema details.
- [X] T005 [P] Create `Backend/models/content.py` — define three SQLAlchemy models: (1) `SalaryBenchmark`: id (PK), role (String(100), NOT NULL), level (String(20), NOT NULL), country (String(100), NOT NULL), currency (String(10), NOT NULL), min_salary (Integer, NOT NULL), median_salary (Integer, NOT NULL), max_salary (Integer, NOT NULL), usd_min (Integer, NOT NULL), usd_max (Integer, NOT NULL), confidence (String(10), NOT NULL), source (String(100), NOT NULL), last_updated_at (DateTime, NOT NULL). Add `UniqueConstraint("role", "level", "country")`. (2) `InterviewQuestion`: id (PK), role (String(100), NOT NULL, indexed), level (String(20), NOT NULL), category (String(30), NOT NULL), question_text (Text, NOT NULL), model_answer (Text, NOT NULL), source (String(20), NOT NULL), content_hash (String(64), UNIQUE, NOT NULL), created_at (DateTime, default=datetime.utcnow). (3) `UserQuestionProgress`: id (PK), user_id (Integer FK to users.id, NOT NULL, indexed), question_id (Integer FK to interview_questions.id, NOT NULL), practiced_at (DateTime, default=datetime.utcnow). Add `UniqueConstraint("user_id", "question_id")`. Import Base from `models/user.py`. See `specs/002-enhance-features-phase2/data-model.md` migrations 011 and 012.
- [X] T006 [P] Create `Backend/models/token_tracking.py` — define one SQLAlchemy model: `TokenUsageLog`: id (PK), user_id (Integer FK to users.id, NOT NULL, indexed), date (Date, NOT NULL), tokens_used (Integer, NOT NULL), operation_type (String(30), NOT NULL — values: `cv_analysis`, `roadmap`, `interview_questions`, `job_ai`), tier (String(10), NOT NULL), created_at (DateTime, default=datetime.utcnow). Add a composite index on `(user_id, date)`. Import Base from `models/user.py`. See `specs/002-enhance-features-phase2/data-model.md` migration 013.

### Migrations

- [X] T007 Create `Backend/migrations/versions/009_otp_codes.py` — Alembic migration that: (1) Drops table `email_verification_tokens`. (2) Drops table `password_reset_tokens`. (3) Creates table `otp_codes` with all columns from T004. (4) Adds columns `is_admin` (Boolean, NOT NULL, default False) and `tier` (String(10), NOT NULL, default 'free') to the `users` table. Set `revision = "009"`, `down_revision = "008"`. The `downgrade()` function must reverse all changes. See `data-model.md` migration 009 for exact schema.
- [X] T008 [P] Create `Backend/migrations/versions/010_user_profiles.py` — Alembic migration that creates table `user_profiles` with all columns from T004. Set `revision = "010"`, `down_revision = "009"`. Include `downgrade()` that drops the table. See `data-model.md` migration 010.
- [X] T009 [P] Create `Backend/migrations/versions/011_salary_benchmarks.py` — Alembic migration that creates table `salary_benchmarks` with all columns, unique constraint on `(role, level, country)`, and indexes on `(role, level)` and `(country)`. Set `revision = "011"`, `down_revision = "010"`. Include `downgrade()`. See `data-model.md` migration 011.
- [X] T010 [P] Create `Backend/migrations/versions/012_interview_bank.py` — Alembic migration that creates tables `interview_questions` and `user_question_progress` with all columns, indexes, and unique constraints. Set `revision = "012"`, `down_revision = "011"`. Include `downgrade()`. See `data-model.md` migration 012.
- [X] T011 [P] Create `Backend/migrations/versions/013_token_tracking.py` — Alembic migration that creates table `token_usage_log` with all columns and composite index on `(user_id, date)`. Set `revision = "013"`, `down_revision = "012"`. Include `downgrade()`. See `data-model.md` migration 013.
- [X] T012 Run all migrations inside the Docker container: `docker compose exec backend alembic upgrade head`. Verify with `docker compose exec backend alembic current` — it must show revision `013`. Fix any migration errors before continuing.

### Configuration & Schemas

- [X] T013 Update `Backend/app/config.py` — add new fields to the `Settings` class: `otp_hmac_secret: str = ""`, `otp_expiry_minutes: int = 10`, `otp_max_attempts: int = 5`, `otp_rate_limit_per_30min: int = 3`, `free_tier_analysis_limit: int = 2`, `free_tier_window_days: int = 10`, `paid_tier_daily_token_limit: int = 10000`, `llm_provider: str = "groq"`, `llm_model: str = "llama-3.3-70b-versatile"`, `groq_price_per_1k_tokens: float = 0.0006`. Keep all existing fields unchanged.
- [X] T014 Update `Backend/models/schemas.py` — add the following new Pydantic schemas: (1) `OtpSendRequest(BaseModel)`: `email: EmailStr`, `purpose: str` (must be one of `registration`, `password_reset`). (2) `OtpVerifyRequest(BaseModel)`: `email: EmailStr`, `code: str` (exactly 5 digits), `purpose: str`. (3) `PasswordResetWithTokenRequest(BaseModel)`: `reset_token: str`, `new_password: str` (same validators as `ResetPasswordRequest`). (4) `UserProfileResponse(BaseModel)` — extended version of the existing one, add fields: `is_admin: bool`, `tier: str`, `total_sessions: int`, `avg_match_score: Optional[float]`, `best_score: Optional[float]`, `total_interviews: int`, `roadmaps_generated: int`, `linkedin_url: Optional[str]`, `github_url: Optional[str]`, `portfolio_url: Optional[str]`, `bio: Optional[str]`, `stored_cv_filename: Optional[str]`, `has_stored_cv: bool`, `analyses_in_window: int`, `window_resets_at: Optional[datetime]`. (5) `ProfileUpdateRequest(BaseModel)`: all optional fields — `username: Optional[str]`, `bio: Optional[str]`, `linkedin_url: Optional[str]`, `github_url: Optional[str]`, `portfolio_url: Optional[str]`. (6) `SalaryQueryResponse(BaseModel)`: `role`, `level`, `country`, `currency`, `min_salary`, `median_salary`, `max_salary`, `usd_min`, `usd_max`, `confidence`, `last_updated_at: datetime`, `source`. (7) `RolesListResponse(BaseModel)`: `roles: list[str]`. (8) `CountriesListResponse(BaseModel)`: `countries: list[str]`. (9) `InterviewQuestionResponse(BaseModel)`: `id: int`, `question_text: str`, `model_answer: str`, `practiced: bool`. (10) `QuestionsByCategoryResponse(BaseModel)`: `role`, `level`, `total_questions: int`, `categories: dict[str, list[InterviewQuestionResponse]]`. (11) `QuotaExceededResponse(BaseModel)`: `detail: str`, `quota_type: str`, `used: int`, `limit: int`, `resets_at: datetime`. (12) `ChangePasswordRequest(BaseModel)`: `otp_code: str`, `new_password: str`.
- [X] T015 Update `Backend/app/main.py` — import and register the four new routers: `from routers import profile, salary, interview_bank, admin`. Add: `app.include_router(profile.router, prefix="/profile", tags=["profile"])`, `app.include_router(salary.router, prefix="/salary", tags=["salary"])`, `app.include_router(interview_bank.router, prefix="/interview-bank", tags=["interview-bank"])`, `app.include_router(admin.router, prefix="/admin", tags=["admin"])`. Keep all existing router registrations unchanged.

**Checkpoint**: All migrations applied, models importable, config updated, main.py registers new routers. Run `docker compose exec backend python -c "from models.user import OtpCode, UserProfile; from models.content import SalaryBenchmark, InterviewQuestion; print('OK')"` to verify.

---

## Phase 3: US1 — OTP Email Verification (Priority: P1) 🎯

**Goal**: Replace magic-link email verification with a 5-digit OTP code flow for registration, password change, and password reset.

**Independent Test**: Register a new user → receive OTP in email logs → POST `/auth/verify-otp` with the code → confirm `email_verified = true` in DB. Also test wrong code returns 400 and attempt count increments.

### Implementation

- [X] T016 Create `Backend/services/otp_service.py` — implement four functions: (1) `generate_otp() -> str`: returns `f"{secrets.randbelow(100000):05d}"` — uses `import secrets` (CSPRNG). (2) `hmac_code(code: str, secret: str) -> str`: returns `hmac.new(secret.encode(), code.encode(), digestmod="sha256").hexdigest()` — use `import hmac`. (3) `create_otp(db, email: str, purpose: str, user_id: int | None = None) -> str`: invalidates any existing active OTP for that email+purpose (set `used_at = datetime.utcnow()` on old records), generates a new code, hashes it, stores a new `OtpCode` record with `expires_at = datetime.utcnow() + timedelta(minutes=settings.otp_expiry_minutes)`, returns the plaintext code. (4) `verify_otp(db, email: str, code: str, purpose: str) -> tuple[bool, str]`: returns `(True, "ok")` on success, `(False, "expired")`, `(False, "locked")`, or `(False, "invalid")` otherwise. On wrong code: increment `attempt_count`; if `attempt_count >= settings.otp_max_attempts`, mark as locked (set `used_at = NOW()`). On success: set `used_at = NOW()`. Use `hmac.compare_digest()` for constant-time comparison. (5) `check_otp_rate_limit(email: str)`: uses Redis key `otp:rate:{email.lower()}` — same pattern as `check_forgot_password_rate()` in `auth_service.py` but with `otp_rate_limit_per_30min` and a 1800s window. Import `settings` from `app.config` and `redis_client` from `services.cache`.
- [X] T017 Update `Backend/services/email_service.py` — (1) Remove `send_verification_email()` function. (2) Remove `send_password_reset_email()` function. (3) Add `send_otp_email(to_email: str, username: str, otp_code: str, purpose: str) -> None`: sends a plain HTML email with the 5-digit code prominently displayed, explains it expires in 10 minutes, and states what it is for (sign-up verification / password reset / password change). Keep `send_account_deletion_email()` and `_send()` unchanged.
- [X] T018 Update `Backend/services/auth_service.py` — (1) Remove functions `create_verification_token`, `consume_verification_token`, `create_password_reset_token`, `consume_password_reset_token`. (2) Remove imports of `EmailVerificationToken` and `PasswordResetToken` from `models.user`. (3) Add helper `create_reset_session(user_id: int) -> str`: generates a UUID, stores it in Redis as `reset_session:{uuid}` → `str(user_id)` with TTL 900s (15 min), returns the UUID. (4) Add helper `consume_reset_session(token: str) -> int | None`: gets user_id from Redis key `reset_session:{token}`, deletes the key, returns user_id or None if not found/expired. Keep all JWT helpers, lockout functions, and `get_current_user` unchanged.
- [X] T019 Update `Backend/routers/auth.py` — replace all old verification/reset endpoints with OTP-based ones. Specific changes: (1) Remove `POST /verify-email` endpoint. (2) Remove `POST /resend-verification` endpoint. (3) Modify `POST /register`: after creating the user, call `otp_service.check_otp_rate_limit(email)`, then `otp_service.create_otp(db, email, "registration")`, then `email_service.send_otp_email(email, username, code, "registration")`. Update response message to mention 5-digit code. (4) Add `POST /send-otp` endpoint: accepts `OtpSendRequest`, checks rate limit, creates OTP, sends email. Always return 200 for `registration` purpose even if email not found (anti-enumeration). (5) Add `POST /verify-otp` endpoint: accepts `OtpVerifyRequest`. For `registration` purpose: calls `verify_otp(db, email, code, "registration")`; on success sets `user.email_verified = True`, returns 200. For `password_reset` purpose: calls `verify_otp`; on success calls `create_reset_session(user.id)` and returns `{message, reset_token}`. Return 400 with specific error messages for wrong/expired/locked. (6) Modify `POST /forgot-password`: remove `create_password_reset_token`, instead call `otp_service.create_otp(db, email, "password_reset")` and `send_otp_email`. (7) Replace `POST /reset-password`: now accepts `PasswordResetWithTokenRequest` (reset_token + new_password); calls `consume_reset_session(reset_token)`, sets new password, updates `sessions_revoked_at`. Remove the old `ResetPasswordRequest` usage. See `specs/002-enhance-features-phase2/contracts/auth-otp.md` for exact request/response shapes.
- [X] T020 [TEST] Create `Backend/tests/unit/test_otp_service.py` — unit tests (no DB, mock Redis): (1) `test_generate_otp_is_5_digits`: verify result matches `r"^\d{5}$"`. (2) `test_hmac_code_consistent`: same input always produces same output. (3) `test_hmac_code_compare_digest_safe`: verify `hmac.compare_digest` is used (not `==`). (4) `test_wrong_code_returns_false`. (5) `test_rate_limit_raises_after_3_attempts` (mock Redis).
- [X] T021 [TEST] Create `Backend/tests/integration/test_auth_otp.py` — integration tests against real DB + Redis: (1) `test_register_creates_otp_record`: POST `/auth/register`, verify `otp_codes` table has a record for that email. (2) `test_verify_otp_activates_account`: create user, get OTP from DB, POST `/auth/verify-otp`, verify `email_verified = True`. (3) `test_wrong_otp_increments_attempt_count`. (4) `test_expired_otp_rejected`: manually set `expires_at` to past. (5) `test_locked_after_5_attempts`. (6) `test_forgot_password_sends_otp`. (7) `test_reset_password_with_otp_token`.
- [X] T022 Create `frontend/src/components/OtpInput.tsx` — a reusable React component that renders 5 separate single-digit `<input>` boxes. Behaviour: auto-focus first box on mount; auto-advance to next box when a digit is entered; backspace on empty box moves focus to previous box; paste of a 5-digit string fills all boxes; calls `onChange(code: string)` prop whenever all 5 digits are filled (code is the concatenated string). Props: `onChange: (code: string) => void`, `disabled?: boolean`, `error?: boolean`. Style with the new blue theme (focus ring: `ring-2 ring-blue-500`). Use TypeScript strict types throughout. No external OTP libraries.
- [X] T023 Create `frontend/src/pages/VerifyOtp.tsx` — a page component at route `/verify-otp`. Reads query params `purpose` (`signup` | `password_change` | `password_reset`) and `email` from the URL. Renders: (1) Title that changes based on purpose (e.g., "Verify your email" for signup, "Confirm password reset" for password_reset). (2) Subtitle showing masked email (e.g., "Code sent to j***@example.com"). (3) The `OtpInput` component. (4) A "Verify" button that calls `POST /auth/verify-otp` with `{email, code, purpose}`. (5) A "Resend code" button (disabled for 60s after page load, then enabled) that calls `POST /auth/send-otp`. (6) Error message display on wrong code / expired / locked. On success: redirect to `/dashboard` for `signup`, back to `/profile` with success toast for `password_change`, to `/auth` with "password updated, please log in" message for `password_reset`. Use `axios` from `frontend/src/api.ts`. TypeScript strict. New blue/teal theme.
- [X] T024 Update `frontend/src/pages/Auth.tsx` — modify the register flow: after a successful `POST /auth/register` response, navigate to `/verify-otp?purpose=signup&email=<encoded_email>` instead of showing a "check your email" static message. Modify the forgot-password flow: after a successful `POST /auth/forgot-password` response, navigate to `/verify-otp?purpose=password_reset&email=<encoded_email>`. No other logic changes. The visual update (theme) happens in Phase 5.
- [X] T025 Update `frontend/src/App.tsx` — add the `/verify-otp` route pointing to `<VerifyOtp />`. Import the new component. Keep all existing routes unchanged.

**Checkpoint**: Full OTP flow works end-to-end. New user can register, receive OTP (check backend logs in dev), enter it at `/verify-otp`, and log in. Old `/verify-email` and `/resend-verification` routes return 404.

---

## Phase 4: US9 — Enhanced Career Roadmap (Priority: P1)

**Goal**: Roadmap generation uses ONLY the user's actual gap report from their CV analysis — no beginner content for senior candidates, no topics the user already knows.

**Independent Test**: Run an analysis for a senior developer CV, generate a roadmap, verify every phase topic matches a skill in their gap_report and no phase contains "Introduction to" or "Basics of" resources.

### Implementation

- [X] T026 Update `Backend/services/roadmap_service.py` — modify `generate_career_roadmap()`: (1) The `gap_report` parameter (already exists as optional) must now be actively used. If `gap_report` is None or empty, raise a `ValueError("No gap report available — run CV analysis first")`. (2) Update the `_format_gap_summary()` helper to include skill names, importance levels, and reasons from the gap report items. (3) Ensure the prompt variable `gap_summary` is always passed with real data (not empty string). The `select_resources()` call should use the gap skills, not the full skill inventory. No new functions needed — just enforce the gap-first constraint. Also update the prompt's `anti-patterns` section if needed by reviewing `Backend/rag/prompts.py` — the `CAREER_ROADMAP_TEMPLATE` already has anti-patterns; verify they are all still present and add: "Do NOT include phases for skills already present in the candidate's skill_inventory at 'advanced' or 'intermediate' level."
- [X] T027 Update `Backend/routers/roadmap.py` — in the roadmap generation endpoint: (1) After loading the CVSession, check if `session.gap_report` is None or the parsed list is empty. (2) If no gap report: return HTTP 400 with `{"detail": "No analysis found for this session. Please run a CV analysis first.", "action": "run_analysis"}`. (3) If gap report exists: pass it to `generate_career_roadmap()`. No other changes. See existing router code — the gap_report is already read from session; just add the guard.
- [X] T028 Update `frontend/src/pages/CareerRoadmap.tsx` — add an empty state: when the API returns a 400 with `action: "run_analysis"`, display a card with the message "No analysis found for this session" and a button "Run CV Analysis" that navigates back to the analyze page. Also display a small info badge at the top of a generated roadmap: "This roadmap is based on your identified skill gaps only."

**Checkpoint**: Generating a roadmap without a prior analysis returns a clear 400. A roadmap generated after analysis only covers gap skills. Test with a senior developer CV.

---

## Phase 5: US4 — Color Theme Overhaul (Priority: P2)

**Goal**: Replace all purple/violet accents with blue (light mode) and teal/sky (dark mode) across every frontend page and component. The result must not look AI-generated.

**Independent Test**: Open Dashboard, Upload, Results, Profile, Auth, and CareerRoadmap pages in both light and dark mode. Confirm zero `violet-` or `purple-` CSS classes remain in the rendered DOM. Run a browser accessibility check confirming WCAG AA contrast ratios.

### Implementation

- [X] T029 Update `frontend/tailwind.config.js` — add a `theme.extend.colors` block with semantic tokens: `primary: { 50: '#eff6ff', 100: '#dbeafe', 200: '#bfdbfe', 300: '#93c5fd', 400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb', 700: '#1d4ed8', 800: '#1e40af', 900: '#1e3a8a', 950: '#172554' }` (blue scale) and `accent: { 50: '#f0fdfa', 100: '#ccfbf1', 200: '#99f6e4', 300: '#5eead4', 400: '#2dd4bf', 500: '#14b8a6', 600: '#0d9488', 700: '#0f766e', 800: '#115e59', 900: '#134e4a', 950: '#042f2e' }` (teal scale). These tokens map `primary` = blue, `accent` = teal. Do NOT remove the default Tailwind palette.
- [X] T030 [P] Perform a systematic find-and-replace across all files in `frontend/src/` — replace every occurrence of `violet-` with `primary-` (e.g., `violet-500` → `primary-500`, `violet-600` → `primary-600`, `dark:bg-violet-950` → `dark:bg-primary-950`, etc.). Use a text editor search-and-replace or PowerShell: `Get-ChildItem -Recurse -Filter "*.tsx" | ForEach-Object { (Get-Content $_.FullName) -replace 'violet-', 'primary-' | Set-Content $_.FullName }`. Run from `frontend/src/`. Verify no `violet-` strings remain with `grep -r "violet-" frontend/src/`.
- [X] T031 [P] Perform a systematic find-and-replace across all files in `frontend/src/` — replace every occurrence of `purple-` with `accent-`. Same approach as T030. Verify with `grep -r "purple-" frontend/src/`.
- [X] T032 Update `frontend/src/pages/Profile.tsx` (existing, before the full rewrite in Phase 7) — change the avatar background from `bg-violet-600` to `bg-primary-600`. Change achievement icon backgrounds from `bg-violet-600` to `bg-primary-600`. Change hover borders from `hover:border-violet-200 dark:hover:border-violet-800` to `hover:border-primary-200 dark:hover:border-primary-800`. This is a targeted fix on top of the T030/T031 replace pass.
- [X] T033 Visual audit — start the Vite dev server (`cd frontend && npm run dev`), open each major page in Chrome, toggle dark mode, and verify: (1) No purple remains anywhere. (2) Buttons are blue (primary-600). (3) Accents/bullets are teal (accent-500). (4) Dark mode backgrounds are slate-900/gray-900 with teal accents. (5) Text contrast meets WCAG AA visually. Fix any remaining instances before proceeding to Phase 6.

**Checkpoint**: `grep -r "violet-\|purple-" frontend/src/` returns zero results. All pages look consistent in both modes.

---

## Phase 6: US2 — Dashboard Visual Redesign (Priority: P2)

**Goal**: The dashboard becomes a real SaaS-quality overview with stats, recent activity, and quick-action cards.

**Independent Test**: Log in with a user who has 3+ CV analyses. Confirm the stats row shows correct counts. Log in with a brand-new user and confirm the empty state with CTA is shown.

### Implementation

- [X] T034 Update `Backend/routers/auth.py` — modify the `GET /auth/me` endpoint to add: (1) `sessions_this_month: int` — count of CVSession rows for this user where `created_at >= first day of current month`. (2) `roadmaps_generated: int` — count of CareerRoadmap rows for this user. Update the `UserProfileResponse` schema (already updated in T014) to include these fields. Also return the 5 most recent sessions as `recent_sessions: list[CVSessionResponse]` (id, cv_filename, match_score, created_at). This avoids a new endpoint.
- [X] T035 Update `frontend/src/api.ts` — update the `UserProfile` TypeScript interface to add: `sessions_this_month: number`, `roadmaps_generated: number`, `recent_sessions: Array<{id: number, cv_filename: string, match_score: number | null, created_at: string}>`. Ensure the `getMe()` function return type uses the updated interface.
- [X] T036 Update `frontend/src/pages/Dashboard.tsx` — redesign with three sections: (1) **Stats row** (3 cards): "CVs Analyzed" (total_sessions), "Avg Match Score" (avg_match_score or "—"), "This Month" (sessions_this_month). Each card has the number large and a label below it. (2) **Quick Actions row** (3 cards with icon + label): "Analyze CV" → navigate to `/upload`, "Career Roadmap" → navigate to `/roadmap`, "Interview Prep" → navigate to `/interview`. Each card has a hover effect (primary-600 border on hover). (3) **Recent Activity list**: show last 5 sessions (from `recent_sessions`) — each row shows a truncated filename, match score badge (color-coded: green ≥70, amber 40-69, red <40), and relative date ("3 days ago"). (4) **Empty state**: if total_sessions === 0, show a centered card with an icon, "No analyses yet", and a prominent "Analyze Your First CV →" button. Use Framer Motion for entrance animations. Apply primary/accent color scheme throughout.

**Checkpoint**: Dashboard shows accurate stats. Empty state visible for new users. Quick-action cards navigate correctly.

---

## Phase 7: US5 — Full User Profile Page (Priority: P2)

**Goal**: Replace the existing Profile.tsx completely with a comprehensive profile hub — activity, stored CV, social links, settings (username/password with OTP), achievements, and referral card.

**Independent Test**: Upload a stored CV, save LinkedIn/GitHub URLs, change username — all changes persist on page reload. Initiate password change, enter OTP, confirm password is updated and other sessions are revoked.

### Implementation

- [X] T037 Update `Backend/services/auth_service.py` — in the `register` route handler (or via a service function called after user creation): auto-create an empty `UserProfile` record for every newly registered user. Add function `create_default_profile(db, user_id: int) -> None` that inserts a `UserProfile` with `user_id=user_id` and all nullable fields as None. Call this in `POST /auth/register` after `db.commit()`.
- [X] T038 Create `Backend/services/profile_service.py` — implement: (1) `get_extended_profile(db, user: User) -> dict`: queries UserProfile for the user, counts CVSessions in last `FREE_TIER_WINDOW_DAYS` days, computes `window_resets_at` (earliest session in window + 10 days), counts CareerRoadmaps, returns all fields needed for `UserProfileResponse`. (2) `update_profile(db, user: User, data: ProfileUpdateRequest) -> None`: updates UserProfile fields, validates LinkedIn URL starts with `https://linkedin.com/`, GitHub URL starts with `https://github.com/`, portfolio URL is valid HTTPS. If `data.username` provided: checks uniqueness in `users` table, raises HTTP 400 if taken, otherwise updates `user.username`. (3) `save_stored_cv(db, user: User, file: UploadFile) -> str`: validates PDF MIME type, validates file size ≤ 5MB, saves to `uploads/profiles/{user.id}/cv.pdf`, updates `user.profile.stored_cv_path` and `stored_cv_filename`. (4) `delete_stored_cv(db, user: User) -> None`: deletes the file from disk if it exists, sets both CV fields to None on the profile.
- [X] T039 Create `Backend/routers/profile.py` — implement all endpoints from `specs/002-enhance-features-phase2/contracts/profile.md`: (1) `GET /profile/me` — calls `profile_service.get_extended_profile()`, returns `UserProfileResponse`. (2) `PUT /profile/update` — accepts `ProfileUpdateRequest`, calls `profile_service.update_profile()`. (3) `POST /profile/cv` — accepts `file: UploadFile`, calls `profile_service.save_stored_cv()`. (4) `DELETE /profile/cv` — calls `profile_service.delete_stored_cv()`. (5) `POST /profile/send-change-otp` — calls `otp_service.check_otp_rate_limit(user.email)`, then `otp_service.create_otp(db, user.email, "password_change", user.id)`, then `email_service.send_otp_email(user.email, user.username, code, "password_change")`. (6) `POST /profile/change-password` — accepts `ChangePasswordRequest`, calls `otp_service.verify_otp(db, user.email, otp_code, "password_change")`, if valid: updates `user.hashed_password`, sets `sessions_revoked_at = datetime.utcnow()`, returns 200. All endpoints require `get_current_user` dependency.
- [X] T040 [TEST] Create `Backend/tests/integration/test_profile.py` — tests: (1) `test_get_profile_returns_extended_fields`. (2) `test_update_username_success`. (3) `test_update_username_taken`. (4) `test_upload_stored_cv_and_retrieve`. (5) `test_delete_stored_cv`. (6) `test_change_password_with_otp`.
- [X] T041 Update `frontend/src/api.ts` — add: `getProfile(): Promise<UserProfileResponse>` (calls `GET /profile/me`), `updateProfile(data): Promise<void>`, `uploadStoredCv(file: File): Promise<void>`, `deleteStoredCv(): Promise<void>`, `sendChangeOtp(): Promise<void>`, `changePassword(otpCode: string, newPassword: string): Promise<void>`. Update `UserProfile` interface to include all new fields from the extended `UserProfileResponse` schema in T014.
- [X] T042 Replace `frontend/src/pages/Profile.tsx` completely — build a new comprehensive profile page. Layout (vertical scroll, max-w-2xl, centered, gap-6): (1) **Hero card**: initials avatar (primary-600 background), username, email, member since date, tier badge (blue pill for "Free", green for "Paid"). (2) **Stats grid** (3 columns): CVs Analyzed, Avg Score (ScoreBadge), Interviews Practiced. (3) **AI Quota card** (free tier only): "X of 2 analyses used this period — resets on [date]" with a progress bar. (4) **Stored CV card**: shows current CV filename if exists with a "Use for analysis" button and "Replace" / "Remove" buttons; or an upload dropzone if no CV stored. (5) **Social Links form**: three inputs (LinkedIn URL, GitHub URL, Portfolio URL) with Save button; shows clickable link icons when URLs are set. (6) **Account Settings card**: username field (editable, with Save button), "Change Password" button that calls `POST /profile/send-change-otp` then redirects to `/verify-otp?purpose=password_change`. (7) **Achievements panel**: carried over from old Profile.tsx — same 6 badges (First Step, On a Roll, Power User, Solid Match, Top Tier, Public Speaker), earned/unearned state, same logic via `buildAchievements()`. (8) **Referral card**: carried over from old Profile.tsx — same card linking to `/referrals`. (9) **Danger Zone**: "Log out" button (red border). Apply primary/accent color scheme. Use Framer Motion for entrance animations. TypeScript strict.
- [X] T043 Update `frontend/src/pages/Upload.tsx` — add a "Use my stored CV" option at the top of the upload form. Check if `profile.has_stored_cv` is true (fetch profile on page load). If yes, show a card: "Use your stored CV: [filename]" with a "Use this CV" button. Clicking it should call the analyze endpoint with a flag or pre-fill the session with the stored CV. If no stored CV: show normal upload form as before. (Note: the backend must support using the stored CV path instead of a new upload — add a `use_stored_cv: bool` flag to `POST /cv/upload` or create a new `POST /cv/use-stored` endpoint that creates a CVSession using the stored CV path.)

**Checkpoint**: Profile page loads with all sections. Upload stored CV → it appears on Analyze page. Change username → reflected immediately. Password change OTP flow works.

---

## Phase 8: US7 — Salary Benchmark Explorer (Priority: P2)

**Goal**: Users can query salary ranges for any role + level + country combination from a curated, AI-verified dataset.

**Independent Test**: Seed the database with salary data (T045). Query `GET /salary/query?role=Backend+Engineer&level=mid&country=Egypt` — response includes min/median/max in EGP and USD with confidence label.

### Implementation

- [ ] T044 Create `Backend/data/salary_seed.json` — manually author salary data. The file must be a JSON array of objects matching the `SalaryBenchmark` schema. Must cover all 20 roles listed in `data-model.md` × all 5 regions (Egypt, UAE, Saudi Arabia, USA (remote), United Kingdom (remote)) = minimum 100 entries. All salaries in local monthly amounts. Confidence should be `high` for Egypt/UAE/Saudi entries (researched), `medium` for remote USD entries. Use web search to verify current market rates as you write the seed data. `source` field: `"manual_2026"`, `last_updated`: today's date.
- [ ] T045 Create `Backend/scripts/import_salary_seed.py` — standalone script that: (1) Reads `Backend/data/salary_seed.json`. (2) Opens a DB session using the same `DATABASE_URL` from env. (3) For each entry: uses `INSERT ... ON CONFLICT (role, level, country) DO UPDATE SET ...` to upsert (update existing rows, insert new ones). (4) Prints a summary: "Inserted X, Updated Y, Total Z". Must be runnable as `docker compose exec backend python scripts/import_salary_seed.py`.
- [ ] T046 Create `Backend/services/salary_service.py` — implement: (1) `get_roles(db) -> list[str]`: `SELECT DISTINCT role FROM salary_benchmarks ORDER BY role`. (2) `get_countries(db) -> list[str]`: `SELECT DISTINCT country FROM salary_benchmarks ORDER BY country`. (3) `query_salary(db, role, level, country) -> SalaryBenchmark | None`: single row lookup. (4) `admin_refresh(db) -> dict`: placeholder that returns `{"message": "Refresh not yet implemented — run scripts/refresh_salary.py manually"}`.
- [ ] T047 Create `Backend/routers/salary.py` — implement all endpoints from `specs/002-enhance-features-phase2/contracts/salary-benchmark.md`: (1) `GET /salary/roles` → `RolesListResponse`. (2) `GET /salary/countries` → `CountriesListResponse`. (3) `GET /salary/query?role=&level=&country=` → `SalaryQueryResponse` or 404. (4) `POST /salary/refresh` (requires `is_admin=True` on current user) → calls `salary_service.admin_refresh()`. All are public except refresh. Apply slowapi rate limit `@limiter.limit("30/minute")` on the query endpoint.
- [ ] T048 [TEST] Create `Backend/tests/integration/test_salary.py` — tests: (1) `test_get_roles_returns_list`. (2) `test_query_salary_found`. (3) `test_query_salary_not_found`. (4) `test_query_invalid_level_422`. (5) `test_refresh_requires_admin`.
- [ ] T049 Create `frontend/src/pages/SalaryBenchmark.tsx` — page at route `/salary`. Layout: (1) Page title "Salary Benchmark" with subtitle "Explore current salary ranges for tech roles". (2) Form row: role dropdown (options from `GET /salary/roles`), level dropdown (Junior / Mid-Level / Senior / Staff), country dropdown (options from `GET /salary/countries`). (3) "Search" button — calls `GET /salary/query`. (4) Results card (appears after search): role + level + country header, three salary columns (Min / Median / Max) in local currency, USD remote range, confidence badge (green=high, amber=medium, red=low), "Last updated: [date]" footer. (5) Empty state if no data for that combination. (6) Loading state on fetch. Apply primary/accent color scheme. TypeScript strict.
- [ ] T050 Update `frontend/src/api.ts` — add: `getSalaryRoles(): Promise<string[]>`, `getSalaryCountries(): Promise<string[]>`, `querySalary(role, level, country): Promise<SalaryQueryResult>`. Add `SalaryQueryResult` TypeScript interface matching `SalaryQueryResponse` schema.
- [ ] T051 Update `frontend/src/App.tsx` — add route `/salary` → `<SalaryBenchmark />`. Update `frontend/src/components/layout/AppShell.tsx` to add "Salary" link in the navigation.

**Checkpoint**: Seed salary data loaded. Query for Backend Engineer / Mid-Level / Egypt returns data. Frontend shows the result card with all fields.

---

## Phase 9: US8 — Interview Question Bank (Priority: P2)

**Goal**: Users can browse, search, and track practice progress on a categorized library of real interview questions sourced from Kaggle and AI curation.

**Independent Test**: After seeding questions (T053), query `GET /interview-bank/questions?role=Backend+Engineer&level=mid` — response has questions grouped by category. Mark one as practiced — GET progress shows 1/N practiced.

### Implementation

- [ ] T052 **[MANUAL DEVELOPER ACTION]** Search Kaggle for interview Q&A datasets. Go to kaggle.com and search: "software engineer interview questions answers", "data science interview questions", "behavioral interview questions", "system design interview questions". Download CSV or JSON files. Place all downloaded files in `Backend/data/questions/`. Supported file formats: CSV (columns: question, answer, optionally category/role), JSON array ({question, answer}). Also use the Claude Code session to generate AI-curated questions for any role with < 10 Kaggle questions: ask Claude to generate 20 questions with model answers for that role, save as `Backend/data/questions/ai_[role_slug].json`.
- [ ] T053 Create `Backend/scripts/import_questions.py` — standalone import script that: (1) Scans all CSV and JSON files in `Backend/data/questions/`. (2) For each row/object: extracts `question_text` and `model_answer` (tries common column names: `question`/`answer`, `Question`/`Answer`). (3) Normalizes: strip whitespace, lowercase for hashing. (4) Computes `content_hash = hashlib.sha256(normalized_question.encode()).hexdigest()`. (5) Infers `role`, `level`, `category` from the filename (e.g., `backend_engineer_mid_technical.json` → role=Backend Engineer, level=mid, category=technical) OR from a `role`/`category` column in the data if present. (6) Uses `INSERT INTO interview_questions ... ON CONFLICT (content_hash) DO NOTHING`. (7) Prints: "Processed X rows. Inserted Y. Skipped Z duplicates. Rejected W (missing fields)." Must be runnable as `docker compose exec backend python scripts/import_questions.py`.
- [ ] T054 Run the import script after T052 is complete: `docker compose exec backend python scripts/import_questions.py`. Verify with `docker compose exec backend python -c "from database import SessionLocal; from models.content import InterviewQuestion; db=SessionLocal(); print(db.query(InterviewQuestion).count())"` — must be ≥ 200.
- [ ] T055 Create `Backend/services/interview_bank_service.py` — implement: (1) `get_roles(db) -> list[str]`: distinct roles from `interview_questions` ordered. (2) `get_questions(db, role, level, user_id=None) -> dict`: queries questions filtered by role+level (include `level='all'` rows too), groups by category, for each question checks if `user_id` has a `UserQuestionProgress` row and sets `practiced=True/False`. Returns dict keyed by category. (3) `search_questions(db, q, role=None, level=None, user_id=None) -> list`: ILIKE search on `question_text`, optionally filtered by role/level. (4) `set_practiced(db, user_id, question_id, practiced: bool) -> None`: if `practiced=True`: upsert `UserQuestionProgress` row. If `practiced=False`: delete the row if it exists. (5) `get_progress(db, user_id, role, level) -> dict`: returns per-category readiness (practiced count / total count × 100).
- [ ] T056 Create `Backend/routers/interview_bank.py` — implement all endpoints from `specs/002-enhance-features-phase2/contracts/interview-bank.md`: (1) `GET /interview-bank/roles` — public. (2) `GET /interview-bank/questions?role=&level=` — public; if auth header present, pass user_id to service. (3) `GET /interview-bank/search?q=&role=&level=` — public. (4) `POST /interview-bank/progress` — requires auth. (5) `GET /interview-bank/progress?role=&level=` — requires auth. Apply `@limiter.limit("60/minute")` on search.
- [ ] T057 [TEST] Create `Backend/tests/integration/test_interview_bank.py` — tests: (1) `test_get_roles`. (2) `test_get_questions_grouped_by_category`. (3) `test_search_returns_matching_questions`. (4) `test_mark_practiced_persists`. (5) `test_progress_calculation_correct`.
- [ ] T058 Create `frontend/src/pages/InterviewBank.tsx` — page at route `/interview-bank`. Layout: (1) Page title + subtitle. (2) Filter row: role dropdown (from `GET /interview-bank/roles`), level dropdown, real-time search input (debounced 300ms). (3) When role+level selected: shows questions grouped in collapsible category sections (accordion). Each question card: question text, "Show Answer" toggle that reveals `model_answer`, "Practiced" checkbox/button (calls `POST /interview-bank/progress` if logged in; shows login prompt if not). (4) Per-category readiness bar: "Technical: 5/20 (25%)" shown as a progress bar above each category section. (5) Empty state when no questions for selection. (6) Search results mode: flat list when search query is active. TypeScript strict. Primary/accent theme.
- [ ] T059 Update `frontend/src/api.ts` — add interview bank types and functions: `getInterviewRoles()`, `getInterviewQuestions(role, level)`, `searchInterviewQuestions(q, role?, level?)`, `markQuestionPracticed(questionId, practiced)`, `getInterviewProgress(role, level)`. Add TypeScript interfaces matching the contract response schemas.
- [ ] T060 Update `frontend/src/App.tsx` — add route `/interview-bank` → `<InterviewBank />`. Update `AppShell.tsx` to add "Interview Bank" navigation link.

**Checkpoint**: Import script loaded ≥ 200 questions. Frontend shows categorized questions. Practiced marks persist across page reloads for logged-in users.

---

## Phase 10: US3 — Login / Signup Visual Redesign (Priority: P3)

**Goal**: Auth pages match the new blue/teal design language with improved visual hierarchy.

**Independent Test**: Navigate to `/auth` in both light and dark mode. Confirm the new layout, no purple remains, and all form functionality still works (register, login, forgot-password flows).

### Implementation

- [ ] T061 Update `frontend/src/pages/Auth.tsx` — redesign the visual layout only (no logic changes beyond what was done in T024). New layout: centered card (`max-w-md`, white/slate-900 background, rounded-2xl, shadow-lg). Header: HireIQ logo + tagline. Tabs: "Sign In" / "Sign Up" with animated underline (Framer Motion). Form fields: full-width with floating label or clear label above, `focus:ring-primary-500` focus rings. Submit button: `bg-primary-600 hover:bg-primary-700` full-width pill. Below form: "Forgot password?" link (right-aligned). Sign-in/Sign-up toggle link at bottom. Dark mode: `dark:bg-slate-900 dark:border-slate-700`. Ensure all form validation messages, error states, and loading states are visually clear. No changes to state management, API calls, or navigation logic.

**Checkpoint**: Auth pages look polished and professional. All flows (register, login, forgot password, OTP redirect) still work correctly.

---

## Phase 11: US6 — Mobile Responsive View (Priority: P3)

**Goal**: All pages are usable and layout-correct at 320px–767px viewport width.

**Independent Test**: Open DevTools, set viewport to 375px (iPhone SE). Navigate to every major page. Confirm no horizontal scroll, no overlapping elements, all buttons have ≥44px tap targets, and navigation is accessible.

### Implementation

- [ ] T062 Update `frontend/src/components/layout/AppShell.tsx` — add mobile navigation: (1) Show a hamburger icon button (`Menu` from Lucide) in the top-left on mobile (hidden on `md:` and above). (2) Clicking it opens a slide-out side drawer (Framer Motion `x: -300 → 0`). The drawer contains the same navigation links as the desktop nav, plus the user avatar/name at top. (3) Add a semi-transparent overlay that closes the drawer on click. (4) The existing horizontal top nav links should be `hidden md:flex`. (5) Ensure the drawer closes on navigation. Keep the ThemeToggle visible on both mobile and desktop.
- [ ] T063 [P] Update `frontend/src/pages/Dashboard.tsx` — mobile layout: stats grid changes from `grid-cols-3` to `grid-cols-1 sm:grid-cols-3`. Quick-action cards: `grid-cols-1 sm:grid-cols-3`. Recent activity list: full-width on mobile. Ensure all text is readable and buttons have sufficient tap targets (`min-h-[44px]`).
- [ ] T064 [P] Update `frontend/src/pages/Results.tsx` — mobile layout: score gauge and structured analysis sections stack vertically (`flex-col`). Each section card is full-width. Skill inventory table becomes a card list on mobile. Ensure horizontal scroll does not occur on any section.
- [ ] T065 [P] Update `frontend/src/pages/Upload.tsx` — mobile layout: file drop zone is full-width. JD textarea full-width. Submit button full-width. The "Use my stored CV" card (added in T043) stacks above the dropzone on mobile.
- [ ] T066 [P] Update `frontend/src/pages/Profile.tsx` — mobile layout: stats grid `grid-cols-1 sm:grid-cols-3`. Achievement grid `grid-cols-2 sm:grid-cols-3`. Social links form fields are stacked. All input fields and buttons full-width on mobile.
- [ ] T067 [P] Update `frontend/src/pages/CareerRoadmap.tsx` — mobile layout: phase cards stack vertically and are full-width. Resource links wrap properly. Timeline/stepper if present adapts to vertical layout.
- [ ] T068 [P] Update `frontend/src/pages/InterviewBank.tsx` — mobile layout: filter controls stack vertically. Question cards are full-width. Model answer reveal works with touch. Progress bars span full width.
- [ ] T069 [P] Update `frontend/src/pages/SalaryBenchmark.tsx` — mobile layout: filter dropdowns stack vertically and are full-width. Result card is full-width with salary figures stacked.

**Checkpoint**: Every major page at 375px width passes the no-horizontal-scroll test. Navigation drawer opens and closes correctly. All interactive elements are comfortably tappable.

---

## Phase 12: US10 — AI Token Management (Priority: P3)

**Goal**: Free-tier users are limited to 2 CV analyses per 10 days. Paid-tier users have a daily token budget. Admins can view usage and change tiers. All quota exhaustion shows a friendly message — never a raw 429 error.

**Independent Test**: Set `FREE_TIER_ANALYSIS_LIMIT=1` in `.env`. Log in as a free-tier user, run 1 analysis, try to run a second — must receive the quota exceeded JSON (HTTP 429). Log in as admin, call `PUT /admin/tokens/users/{id}/tier` with `{"tier":"paid"}`, confirm that user can now run analyses again.

### Implementation

- [ ] T070 Create `Backend/services/token_tracker.py` — implement: (1) `check_free_tier_quota(db, user: User) -> None`: counts CVSession rows for user where `created_at >= datetime.utcnow() - timedelta(days=settings.free_tier_window_days)`. If count >= `settings.free_tier_analysis_limit`: compute `window_resets_at` = oldest session in window + 10 days; raise `HTTPException(429, detail=f"You've used your {limit} free analyses for this period.", ...)` with `QuotaExceededResponse` body. (2) `check_paid_tier_quota(db, user: User) -> None`: sum `tokens_used` in `token_usage_log` for user where `date = today`. If sum >= `settings.paid_tier_daily_token_limit`: raise `HTTPException(429, ...)`. (3) `log_token_usage(db, user_id, tokens_used, operation_type, tier) -> None`: inserts a `TokenUsageLog` row. (4) `get_admin_summary(db) -> dict`: returns total tokens today, total analyses today, active users by tier, estimated monthly cost (using `groq_price_per_1k_tokens`). (5) `get_user_breakdown(db, date, limit=50) -> list`: per-user token usage sorted descending.
- [ ] T071 Update `Backend/routers/analysis.py` — add quota check at the START of the `analyze` endpoint, BEFORE the streaming generator: (1) Load the user from the token. (2) If `user.tier == "free"`: call `token_tracker.check_free_tier_quota(db, user)`. (3) If `user.tier == "paid"`: call `token_tracker.check_paid_tier_quota(db, user)`. (4) After the stream completes successfully, call `token_tracker.log_token_usage(db, user.id, estimated_tokens, "cv_analysis", user.tier)`. Estimated token count = `len(cv_text + jd_text) // 4` (rough approximation). The quota check must happen synchronously before returning the StreamingResponse.
- [ ] T072 Create `Backend/routers/admin.py` — implement admin endpoints: (1) `GET /admin/tokens/summary` → calls `token_tracker.get_admin_summary(db)`, requires `is_admin=True`. (2) `GET /admin/tokens/users` → calls `token_tracker.get_user_breakdown(db, date, limit)`, requires `is_admin=True`. (3) `PUT /admin/tokens/users/{user_id}/tier` → accepts `{"tier": "free"|"paid"}`, updates `user.tier`, requires `is_admin=True`. Add helper `require_admin(user: User = Depends(get_current_user)) -> User` that raises HTTP 403 if `not user.is_admin`.
- [ ] T073 [TEST] Create `Backend/tests/unit/test_token_tracker.py` — unit tests: (1) `test_free_tier_quota_exceeded_raises_429`. (2) `test_free_tier_quota_not_exceeded_passes`. (3) `test_paid_tier_quota_exceeded_raises_429`. (4) `test_log_token_usage_inserts_row`.
- [ ] T074 [TEST] Create `Backend/tests/integration/test_admin_tokens.py` — integration tests: (1) `test_summary_requires_admin`. (2) `test_tier_change_takes_effect`. (3) `test_free_tier_blocks_on_3rd_analysis_in_window`.
- [ ] T075 Create `frontend/src/pages/Admin.tsx` — admin-only page at route `/admin`. Guard: if `user.is_admin !== true`, redirect to `/dashboard`. Layout: (1) Summary cards row: "Tokens Today", "Analyses Today", "Est. Monthly Cost ($)", "Provider: [LLM_PROVIDER]". (2) User table: username, tier badge, tokens today, % of limit used (progress bar), "Change to Paid/Free" button (calls `PUT /admin/tokens/users/{id}/tier`). (3) Refresh button that re-fetches summary. Primary/accent theme. TypeScript strict.
- [ ] T076 Update `frontend/src/api.ts` — add admin API functions: `getAdminTokenSummary()`, `getAdminUserBreakdown()`, `setUserTier(userId, tier)`. Add TypeScript interfaces for responses.
- [ ] T077 Update `frontend/src/App.tsx` — add route `/admin` → `<Admin />`. Update `AppShell.tsx` to show an "Admin" nav link only when `user?.is_admin === true`.

**Checkpoint**: A free-tier user's 2nd (or Nth per setting) analysis is blocked with a clean quota message. Admin can view token stats and promote users to paid tier.

---

## Phase 13: Polish & Cross-Cutting Concerns

**Purpose**: Final cleanup, data seeding completion, and cross-feature integration verification.

- [ ] T078 [P] Create `Backend/scripts/refresh_salary.py` — stub script that demonstrates the AI-assisted refresh pattern: (1) Load current salary data from DB. (2) For each role/country combination: print a WebSearch query string the developer should run in Claude Code (e.g., "current Backend Engineer salary Egypt 2026 monthly"). (3) After the developer provides updated figures, the script accepts them via stdin or a YAML file and upserts into the DB. Document usage in `quickstart.md`. This is a manual-assist script, not fully automated.
- [ ] T079 [P] Update `Backend/tests/integration/test_auth.py` — remove any tests that reference `/auth/verify-email` or `/auth/resend-verification` (old magic-link endpoints that no longer exist). Add a comment noting which tests were removed and why.
- [ ] T080 [P] Update `Backend/.env.example` — verify all variables from T001 are present with correct example values and inline comments. Check that no production secrets are present (only placeholder values like `your-secret-here`).
- [ ] T081 Rebuild and restart the Docker stack: `docker compose build backend && docker compose up -d`. Verify: `curl http://localhost:8000/health` returns `{"status":"ok"}`. Check `docker compose logs backend` for any startup errors.
- [ ] T082 [P] Run all backend tests: `docker compose exec backend pytest Backend/tests/ -v`. All tests must pass. Fix any failures before marking this task done.
- [ ] T083 Full visual QA pass — open the app in a browser, test all user flows end-to-end: register → OTP verify → dashboard → analyze CV → results → roadmap (gap-only) → profile (upload CV, set links) → salary benchmark → interview bank → admin (as admin user). Note any layout issues at both 1280px and 375px widths. Fix any regressions.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS all user story phases
- **Phase 3–12 (User Stories)**: All depend on Phase 2 completion
  - Phase 3 (US1 OTP) and Phase 4 (US9 Roadmap) can run in parallel after Phase 2
  - Phase 5 (Theme) should run before Phases 6–9 (all P2 frontend work)
  - Phases 6–9 can run in parallel after Phase 5
  - Phases 10–12 (P3) can run in parallel after Phase 2
- **Phase 13 (Polish)**: Depends on all desired phases complete

### User Story Dependencies

| Story | Depends on | Can run in parallel with |
|-------|-----------|--------------------------|
| US1 OTP (Phase 3) | Phase 2 | US9, US4, US6, US10 |
| US9 Roadmap (Phase 4) | Phase 2 | US1, US4, US10 |
| US4 Theme (Phase 5) | Phase 2 | US1, US9, US10 |
| US2 Dashboard (Phase 6) | Phase 2 + US4 theme | US5, US7, US8 |
| US5 Profile (Phase 7) | Phase 2 + US4 theme + US1 OTP (for OTP password change) | US6, US7, US8 |
| US7 Salary (Phase 8) | Phase 2 + US4 theme | US5, US6, US8 |
| US8 Interview Bank (Phase 9) | Phase 2 + US4 theme | US5, US6, US7 |
| US3 Auth UI (Phase 10) | Phase 2 + US4 theme + US1 OTP | US6, US10 |
| US6 Mobile (Phase 11) | All P2 phases (must have final components to make responsive) | US10 |
| US10 Token Mgmt (Phase 12) | Phase 2 | US1, US9 |

### Parallel Opportunities Within Phases

- **Phase 2**: T005, T006, T008, T009, T010, T011 can all run in parallel (different files)
- **Phase 5**: T030, T031 can run in parallel (different search-replace targets)
- **Phase 11**: T063–T069 can all run in parallel (different page files)

---

## Implementation Strategy

### MVP First (P1 stories only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (migrations, models, config)
3. Complete Phase 3: OTP Verification
4. Complete Phase 4: Enhanced Roadmap
5. **STOP AND VALIDATE**: OTP flow + gap-only roadmap both work end-to-end
6. Deploy or demo

### Incremental Delivery

1. Setup + Foundational → stable base
2. OTP + Roadmap → core product improvement (P1)
3. Theme overhaul → visual foundation for all remaining work
4. Dashboard + Profile → returning user experience
5. Salary + Interview Bank → new features
6. Auth UI + Mobile + Token Management → polish and access control
7. Each increment should pass full test suite before moving on

---

## Task Summary

| Phase | Story | Task Count | Parallel Tasks |
|-------|-------|-----------|----------------|
| 1: Setup | — | 3 | 2 |
| 2: Foundational | — | 12 | 8 |
| 3: OTP (P1) | US1 | 10 | 2 |
| 4: Roadmap (P1) | US9 | 3 | 0 |
| 5: Theme (P2) | US4 | 5 | 2 |
| 6: Dashboard (P2) | US2 | 3 | 0 |
| 7: Profile (P2) | US5 | 7 | 1 |
| 8: Salary (P2) | US7 | 8 | 1 |
| 9: Interview Bank (P2) | US8 | 9 | 1 |
| 10: Auth UI (P3) | US3 | 1 | 0 |
| 11: Mobile (P3) | US6 | 8 | 7 |
| 12: Token Mgmt (P3) | US10 | 8 | 2 |
| 13: Polish | — | 6 | 3 |
| **Total** | | **83** | **29** |

---

## Notes

- Each task description is self-contained — an LLM can implement it by reading the task plus the referenced contract/data-model file
- All test files use real PostgreSQL + Redis (per constitution — no mocked databases)
- The `[P]` marker means the task touches a different file than other parallel tasks in the same phase
- Commit after each phase checkpoint, not individual tasks
- If a Kaggle dataset download (T052) is delayed, all other Phase 9 tasks can be started — the import script (T053) and tests (T057) can be written against empty/stub data and run after T052 completes
