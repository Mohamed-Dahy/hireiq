# Data Model: HireIQ Phase 2

**Branch**: `002-enhance-features-phase2` | **Date**: 2026-05-14

All changes are additive or isolated replacements. Existing tables (`users`, `cv_sessions`, `interview_results`, `career_roadmaps`, jobs tables, recruiter tables, referral tables) are unchanged unless noted.

---

## Migration 009 — OTP Codes (replaces email/password token tables)

### DROP (existing tables removed)

```
email_verification_tokens  — replaced by otp_codes
password_reset_tokens      — replaced by otp_codes
```

Users with `email_verified = true` are unaffected. Users with pending (unused) verification tokens lose them; they must re-register.

### CREATE: `otp_codes`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | INTEGER | PK | |
| email | VARCHAR | NOT NULL, INDEX | Target email (not FK — pre-user-creation OTPs need this) |
| user_id | INTEGER | FK → users.id, NULLABLE, INDEX | NULL until account exists (signup flow) |
| code_hmac | VARCHAR(64) | NOT NULL | HMAC-SHA256 hex of the 5-digit code |
| purpose | VARCHAR(20) | NOT NULL | `registration`, `password_change`, `password_reset` |
| expires_at | TIMESTAMP | NOT NULL | `NOW() + 10 minutes` |
| attempt_count | INTEGER | NOT NULL, DEFAULT 0 | Incremented on each wrong attempt |
| used_at | TIMESTAMP | NULLABLE | Set on successful verification |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | |

**State machine**:
```
PENDING (used_at IS NULL, attempt_count < 5, expires_at > NOW())
  → VERIFIED: set used_at = NOW()
  → EXPIRED:  expires_at < NOW()
  → LOCKED:   attempt_count >= 5 (new code must be requested)
```

**Validation rules**:
- `purpose` must be one of `{registration, password_change, password_reset}`
- At most one active (unused, unexpired, unlocked) OTP per email+purpose at a time; inserting a new one invalidates previous ones for the same email+purpose

### MODIFY: `users` table

Add columns:
```
is_admin  BOOLEAN     NOT NULL  DEFAULT FALSE
tier      VARCHAR(10) NOT NULL  DEFAULT 'free'
```

- `tier` valid values: `free`, `paid`. Enforced at application layer (not DB constraint).
- `tier` defaults to `free` for all new registrations and for all existing users at migration time.
- Admin changes tier via `PUT /admin/tokens/users/{user_id}/tier`.

(Existing `email_verification_tokens` and `password_reset_tokens` relationships removed from ORM.)

---

## Migration 010 — User Profiles

### CREATE: `user_profiles`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | INTEGER | PK | |
| user_id | INTEGER | FK → users.id, UNIQUE, NOT NULL | One profile per user |
| stored_cv_path | VARCHAR | NULLABLE | Relative path under `uploads/profiles/` |
| stored_cv_filename | VARCHAR | NULLABLE | Original filename for display |
| linkedin_url | VARCHAR(500) | NULLABLE | Must start with `https://linkedin.com/` if set |
| github_url | VARCHAR(500) | NULLABLE | Must start with `https://github.com/` if set |
| portfolio_url | VARCHAR(500) | NULLABLE | Any valid HTTPS URL |
| bio | TEXT | NULLABLE | Max 500 chars |
| avatar_url | VARCHAR(500) | NULLABLE | Reserved for future upload; v1 uses initials |
| updated_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | |

**Notes**:
- Profile is created automatically (empty) when a new user registers
- `stored_cv_path` stores the server-relative path; frontend never constructs the path itself
- URL validation enforced at Pydantic schema level, not DB constraint

---

## Migration 011 — Salary Benchmarks

### CREATE: `salary_benchmarks`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | INTEGER | PK | |
| role | VARCHAR(100) | NOT NULL | e.g., "Backend Engineer" |
| level | VARCHAR(20) | NOT NULL | `junior`, `mid`, `senior`, `staff` |
| country | VARCHAR(100) | NOT NULL | e.g., "Egypt", "UAE", "USA-remote" |
| currency | VARCHAR(10) | NOT NULL | e.g., "EGP", "USD", "AED" |
| min_salary | INTEGER | NOT NULL | Local currency, monthly |
| median_salary | INTEGER | NOT NULL | Local currency, monthly |
| max_salary | INTEGER | NOT NULL | Local currency, monthly |
| usd_min | INTEGER | NOT NULL | USD/month remote equivalent |
| usd_max | INTEGER | NOT NULL | USD/month remote equivalent |
| confidence | VARCHAR(10) | NOT NULL | `high`, `medium`, `low` |
| source | VARCHAR(100) | NOT NULL | e.g., "manual_2026", "ai_refresh_2026-06" |
| last_updated_at | TIMESTAMP | NOT NULL | |

**Unique constraint**: `(role, level, country)` — one row per combination.

**Indexes**: `(role, level)`, `(country)`

**Seed data requirement**: Minimum 100 rows at launch (20 roles × 5 regions). Loaded via `scripts/import_salary_seed.py` on first deploy.

**Roles in seed** (minimum): Backend Engineer, Frontend Engineer, Full Stack Engineer, Data Scientist, Data Engineer, ML Engineer, DevOps/SRE, Product Manager, UI/UX Designer, QA Engineer, Mobile Engineer (iOS), Mobile Engineer (Android), Cloud Architect, Security Engineer, Database Administrator, Software Architect, Embedded Systems Engineer, Game Developer, Blockchain Developer, Technical Lead.

**Regions in seed** (minimum): Egypt, UAE, Saudi Arabia, USA (remote), United Kingdom (remote).

---

## Migration 012 — Interview Question Bank

### CREATE: `interview_questions`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | INTEGER | PK | |
| role | VARCHAR(100) | NOT NULL, INDEX | e.g., "Backend Engineer" |
| level | VARCHAR(20) | NOT NULL | `junior`, `mid`, `senior`, `all` |
| category | VARCHAR(30) | NOT NULL | `technical`, `behavioral`, `system_design`, `culture_fit` |
| question_text | TEXT | NOT NULL | The interview question |
| model_answer | TEXT | NOT NULL | Suggested answer / key points |
| source | VARCHAR(20) | NOT NULL | `kaggle`, `ai_curated`, `manual` |
| content_hash | VARCHAR(64) | UNIQUE, NOT NULL | SHA-256 of normalized question_text (dedup key) |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | |

**Indexes**: `(role, level)`, `(category)`

**Unique constraint**: `content_hash` — prevents duplicate questions from multiple import runs.

### CREATE: `user_question_progress`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | INTEGER | PK | |
| user_id | INTEGER | FK → users.id, NOT NULL, INDEX | |
| question_id | INTEGER | FK → interview_questions.id, NOT NULL | |
| practiced_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | Timestamp of first mark; updated on re-mark |

**Unique constraint**: `(user_id, question_id)` — one progress record per user per question.

**Readiness calculation** (computed at query time, not stored):
```
readiness_pct = COUNT(progress rows for user in role+level+category) 
                / COUNT(questions in role+level+category) * 100
```

---

## Migration 013 — Token Tracking

### CREATE: `token_usage_log`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | INTEGER | PK | |
| user_id | INTEGER | FK → users.id, NOT NULL, INDEX | |
| date | DATE | NOT NULL | UTC date of usage |
| tokens_used | INTEGER | NOT NULL | Approximate token count for this operation |
| operation_type | VARCHAR(30) | NOT NULL | `cv_analysis`, `roadmap`, `interview_questions`, `job_ai` |
| tier | VARCHAR(10) | NOT NULL | `free`, `paid` |
| created_at | TIMESTAMP | NOT NULL, DEFAULT NOW() | |

**Index**: `(user_id, date)` — supports fast daily aggregation per user.

**Note**: Free-tier quota enforcement uses a direct count on `cv_sessions` (not this table) for simplicity. This table is for admin visibility and paid-tier token counting.

---

## Summary: Entity Relationships

```
users (modified: + is_admin, + tier)
├── user_profiles         1:1 (created on register)
├── otp_codes             1:many (by email or user_id)
├── cv_sessions           1:many (existing — also used for free-tier quota count)
│   └── interview_results  1:many (existing)
├── career_roadmaps       1:many (existing)
├── token_usage_log       1:many (new)
├── user_question_progress 1:many (new)
└── [jobs, recruiter, referral tables — unchanged]

interview_questions (new, admin/import only)
└── user_question_progress  many:many via junction

salary_benchmarks (new, admin/import only, no user FK)
```

**Free-tier quota note**: There is no `AnalysisUsageWindow` table. The free-tier limit (2 analyses per 10-day rolling window) is enforced by a COUNT query: `SELECT COUNT(*) FROM cv_sessions WHERE user_id = ? AND created_at >= NOW() - INTERVAL '10 days'`. The "window reset date" shown to the user is computed as `MIN(created_at) + 10 days` from the same query.

---

## Alembic Migration Order

```
001_initial.py          (existing)
002_auth_hardening.py   (existing)
003_cv_session_extended.py (existing)
004_jobs_recruiter.py   (existing)
005_user_sessions_revoked_at.py (existing)
005b_add_missing_job_columns.py (existing)
006_recruiter_tables.py (existing)
007_referrals.py        (existing)
008_career_roadmap.py   (existing)
009_otp_codes.py        (NEW — drop old token tables, add otp_codes, add users.is_admin)
010_user_profiles.py    (NEW — add user_profiles)
011_salary_benchmarks.py (NEW — add salary_benchmarks)
012_interview_bank.py   (NEW — add interview_questions, user_question_progress)
013_token_tracking.py   (NEW — add token_usage_log)
```
