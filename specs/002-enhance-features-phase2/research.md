# Research: HireIQ Phase 2 Enhancement

**Branch**: `002-enhance-features-phase2` | **Date**: 2026-05-14

---

## 1. OTP Security: Storage and Hashing

**Decision**: Store OTPs using HMAC-SHA256 with a server-side secret (`OTP_HMAC_SECRET`), not bcrypt and not plaintext.

**Rationale**: A 5-digit code (00000–99999) has only 100,000 possible values. Bcrypt is intentionally slow; an attacker with the DB dump can brute-force all 100k values against a bcrypt hash in seconds regardless. A standard SHA-256 hash without a secret is vulnerable to precomputed rainbow tables (the whole input space is trivially small). HMAC-SHA256 with a secret unknown to the attacker makes rainbow tables useless and verification is fast (< 1ms).

**Alternatives considered**:
- Bcrypt: Too slow for brute-force but still breakable on the 100k space with a stolen DB. Overkill for a code that already expires in 10 min.
- Plaintext with DB encryption: Adds infrastructure complexity (key management at the DB layer).
- TOTP (time-based, e.g., library `pyotp`): Better for authenticator apps but requires user to install an app — unnecessary friction for an email-delivered code.

**Implementation note**: `hmac.new(OTP_HMAC_SECRET.encode(), otp_str.encode(), digestmod="sha256").hexdigest()`. Verify by computing the HMAC of the submitted code and comparing with `hmac.compare_digest()` to prevent timing attacks.

---

## 2. OTP Generation: 5-Digit Codes

**Decision**: Generate using `secrets.randbelow(100000)` formatted as `f"{n:05d}"`.

**Rationale**: `secrets` module uses the OS CSPRNG (cryptographically secure). `random.randint` must never be used for security-sensitive values. Zero-padding to 5 digits (e.g., "00342") is required to ensure consistent formatting.

**Expiry**: 10 minutes. Stored as `expires_at = datetime.utcnow() + timedelta(minutes=10)`.

**Attempt lockout**: Max 5 wrong attempts before the OTP record is invalidated and a new code must be requested. Tracked via `attempt_count` field.

---

## 3. OTP Rate Limiting

**Decision**: Redis key `otp:rate:{email}` with TTL 1800s (30 minutes), max 3 sends.

**Rationale**: Consistent with the existing `forgot-password` rate-limit pattern already in `auth_service.py` (`_FP_MAX_ATTEMPTS = 3`, `_FP_WINDOW_SECONDS = 900`). This spec doubles the window to 30 minutes to cover the broader OTP use cases (signup + password change + reset).

**Implementation**: Same `redis_client.incr()` / `redis_client.expire()` pattern already used in `check_forgot_password_rate()`.

---

## 4. Tailwind v3 Color Theme Swap (Purple → Blue/Teal)

**Decision**: Override Tailwind's default color tokens in `tailwind.config.js` by aliasing `violet` and `purple` references to blue/teal equivalents. Specifically:

| Old token | New token | Usage |
|-----------|-----------|-------|
| `violet-500` / `violet-600` | `blue-600` / `blue-700` | Primary buttons, active states (light mode) |
| `violet-400` | `teal-500` | Bullet points, secondary accents |
| `violet-100` / `violet-950` | `blue-100` / `blue-950` | Badge backgrounds |
| `violet-200` / `violet-800` | `blue-200` / `blue-800` | Borders |
| Dark mode purple | `teal-400` / `sky-400` | Accent colors in dark mode |

**Rationale**: Tailwind v3 config allows adding custom token aliases. Rather than a find-and-replace across 40+ files, we extend the config once and introduce a semantic palette (`primary`, `accent`) that maps to the new colors. This also makes future theme changes a single-file operation.

**Approach**: Add to `tailwind.config.js`:
```js
theme: {
  extend: {
    colors: {
      primary: { DEFAULT: '#2563EB', ...blueScale },
      accent:  { DEFAULT: '#14B8A6', ...tealScale },
    }
  }
}
```
Then do a codebase-wide replace of `violet-` → `primary-` and `purple-` → `accent-` across all `.tsx` files. Residual one-off purple references updated manually.

---

## 5. Free-Tier Quota: Rolling 10-Day Window

**Decision**: Implement as a direct count query on `cv_sessions` rather than a separate tracking table.

**Rationale**: The `AnalysisUsageWindow` entity in the spec is valid but adds a table for something computable: `SELECT COUNT(*) FROM cv_sessions WHERE user_id = ? AND created_at >= NOW() - INTERVAL '10 days'`. This is a single indexed query (user_id + created_at are both indexed). No separate table needed; simpler to reason about and test.

**Free tier check logic** (in `token_tracker.py`):
```
analyses_in_window = count CVSession rows for user in last 10 days
if analyses_in_window >= FREE_TIER_LIMIT (default: 2):
    raise QuotaExceededError with next reset date = oldest session in window + 10 days
```

**Paid tier check**: Query `TokenUsageLog` for total tokens today. If ≥ `PAID_TIER_DAILY_LIMIT` (default: 10,000), block.

**Env vars needed**:
```
FREE_TIER_ANALYSIS_LIMIT=2
FREE_TIER_WINDOW_DAYS=10
PAID_TIER_DAILY_TOKEN_LIMIT=10000
```

---

## 6. Interview Question Bank: Kaggle Data Sources

**Decision**: Source questions from Kaggle datasets via manual download + import script. Supplement with AI-curated additions where dataset coverage is thin.

**Recommended Kaggle datasets to search for** (developer action required during task implementation):
- Search terms: `"interview questions answers"`, `"software engineering interview"`, `"data science interview"`, `"behavioral interview questions"`
- Key datasets historically available: "Interview Questions for Tech Jobs", "Data Science Interview Q&A", "Python/SQL Interview Questions"
- Required format: CSV or JSON with columns: `question`, `answer`, `category/type`, `role/domain` (or derivable via tagging)

**Import pipeline** (`Backend/scripts/import_questions.py`):
1. Read all files from `Backend/data/questions/`
2. Normalize to: `{role, level, category, question_text, model_answer, source}`
3. Deduplicate by: SHA-256 hash of normalized `question_text.lower().strip()`
4. INSERT with `ON CONFLICT DO NOTHING`
5. Log import stats: total rows, inserted, skipped (duplicates), rejected (missing required fields)

**AI curation approach**: For roles with < 10 questions after Kaggle import, use Claude Code's `WebSearch` tool + manual review to generate 10–15 additional questions. These get `source = "ai_curated"`.

**Minimum coverage target at launch**: 8 roles × 4 levels × 4 categories = at minimum 200 questions (25/bucket average). Target: 500+ total.

---

## 7. Salary Benchmark Data

**Decision**: Seed from a manually authored `Backend/data/salary_seed.json`. AI-assisted refresh via `refresh_salary.py` script run manually by the developer using Claude Code's `WebSearch` tool.

**Seed file structure**:
```json
[
  {
    "role": "Backend Engineer",
    "level": "Mid-Level",
    "country": "Egypt",
    "currency": "EGP",
    "min_salary": 25000,
    "median_salary": 40000,
    "max_salary": 60000,
    "usd_min": 500,
    "usd_max": 1200,
    "confidence": "high",
    "source": "manual_2026",
    "last_updated": "2026-05-14"
  }
]
```

**Minimum coverage at launch**: 20 roles × 5 regions (Egypt, UAE, Saudi Arabia, USA-remote, UK-remote) = 100 salary entries.

**AI refresh script**: `refresh_salary.py` uses the Claude Code SDK or shell invocation with `WebSearch` to look up current salary ranges for each role/region combination, then updates `salary_seed.json` and re-seeds the DB.

---

## 8. Admin Token Dashboard

**Decision**: Backend-only REST endpoints + a minimal frontend admin page visible only when `user.is_admin == True`.

**Rationale**: The spec says "admin-accessible view" — this means a frontend page, not just backend. The `is_admin` flag already exists conceptually (assumed from the spec). Add `is_admin` boolean column to the `users` table in migration 013.

**Cost estimation logic**: `estimated_monthly_cost = (tokens_used_today / 1000) * GROQ_PRICE_PER_1K_TOKENS * 30`
Where `GROQ_PRICE_PER_1K_TOKENS` is a configurable env var (default Groq pricing).

---

## 9. Mobile Navigation Pattern

**Decision**: Hamburger slide-out side drawer for mobile (≤767px), existing top nav for desktop.

**Rationale**: The existing `AppShell.tsx` uses a horizontal top nav with links. On mobile, this collapses to a drawer triggered by a hamburger button in the top bar. Bottom nav tabs are an alternative but require rearchitecting the nav structure; a side drawer is achievable as an additive change to AppShell. Framer Motion (already in use) handles the slide animation.

---

## 10. `/verify-otp` Route Reuse

**Decision**: Single `VerifyOtp.tsx` page handles all three OTP purposes via a `purpose` URL query param.

**Values**: `?purpose=signup`, `?purpose=password_change`, `?purpose=password_reset`

**Flow**:
- Signup: After `POST /auth/register` returns 201, frontend navigates to `/verify-otp?purpose=signup&email=X`
- Password change: After user submits new password form, backend sends OTP and frontend navigates to `/verify-otp?purpose=password_change`
- Password reset: After `POST /auth/forgot-password`, frontend navigates to `/verify-otp?purpose=password_reset&email=X`

On success, each purpose has a different redirect:
- `signup` → `/dashboard`
- `password_change` → `/profile` with success toast
- `password_reset` → `/auth` with "password updated" message

---

## 11. Existing Token/Auth Migration Path

**Decision**: Existing `email_verification_tokens` and `password_reset_tokens` tables are DROPPED in migration 009. All existing `email_verified = true` users are unaffected (their accounts remain active). The new `otp_codes` table handles all future verification.

**Rationale**: The old tables serve no purpose after OTP migration. Keeping them would confuse future developers. Users already verified don't need re-verification.

**Risk**: Users who have an outstanding unverified account at migration time will lose their pending verification token. They will need to re-register or contact support. This is acceptable given these are pre-verification accounts (never logged in successfully).
