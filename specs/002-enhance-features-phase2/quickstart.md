# Developer Quickstart: Phase 2 Enhancement

**Branch**: `002-enhance-features-phase2`

This guide covers everything a developer needs to set up, run, and test the new features in this spec. Read `data-model.md` for schema details and `research.md` for architecture decisions.

---

## 1. Environment Setup

### Add new variables to `Backend/.env`

```env
# OTP Security (generate a random secret — do NOT reuse JWT_SECRET)
OTP_HMAC_SECRET=replace-with-64-char-random-string

# AI Quota / Tier Management
FREE_TIER_ANALYSIS_LIMIT=2
FREE_TIER_WINDOW_DAYS=10
PAID_TIER_DAILY_TOKEN_LIMIT=10000
LLM_PROVIDER=groq
LLM_MODEL=llama-3.3-70b-versatile
GROQ_PRICE_PER_1K_TOKENS=0.0006
```

**Generate a strong `OTP_HMAC_SECRET`**:
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

---

## 2. Database Migrations

Run from repo root (Docker container or local with active venv):

```bash
# Docker:
docker compose exec backend alembic upgrade head

# Local:
cd Backend && alembic upgrade head
```

Expected new migrations: `009` through `013`. Verify with:
```bash
docker compose exec backend alembic current
```

---

## 3. Seed Data

### 3a. Load salary benchmark data

```bash
docker compose exec backend python scripts/import_salary_seed.py
```

This reads `Backend/data/salary_seed.json` and inserts all rows (skipping duplicates).

**Before running**: Ensure `salary_seed.json` exists with at least 100 entries (20 roles × 5 regions). See `data-model.md` for the required JSON format.

### 3b. Load interview questions

**Step 1 — Download Kaggle datasets** (manual developer action):
1. Go to [kaggle.com](https://www.kaggle.com) and search for:
   - "interview questions answers software engineering"
   - "data science interview questions"
   - "behavioral interview questions answers"
2. Download CSV/JSON files and place them in `Backend/data/questions/`
3. Supported formats: CSV with `question,answer` columns; JSON array with `{question, answer}` objects

**Step 2 — Run import script**:
```bash
docker compose exec backend python scripts/import_questions.py
```

The script normalizes, deduplicates (by content hash), tags by role/level/category, and inserts all valid rows. It logs: total processed, inserted, skipped, and rejected counts.

**Step 3 — AI curation for thin roles** (optional, improves coverage):
For roles with < 10 questions after import, use the Claude Code session to generate additional questions:
- Tell Claude: "Generate 15 [category] interview questions for [role] at [level] level with model answers"
- Save output as `Backend/data/questions/ai_curated_[role].json`
- Re-run `import_questions.py`

---

## 4. Running the Stack

No changes to `docker-compose.yml`. Rebuild backend after code changes:

```bash
docker compose build backend && docker compose up -d backend
```

Verify health:
```bash
curl http://localhost:8000/health
```

---

## 5. Testing New Features

### OTP verification flow

```bash
# Register a new account
curl -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","username":"tester","password":"password123"}'

# Check backend logs for the OTP (dev mode — Resend not configured logs it):
docker compose logs backend | grep "OTP"

# Verify with the code
curl -X POST http://localhost:8000/auth/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","code":"XXXXX","purpose":"registration"}'
```

### Salary benchmark

```bash
curl "http://localhost:8000/salary/query?role=Backend+Engineer&level=mid&country=Egypt"
```

### Interview bank

```bash
curl "http://localhost:8000/interview-bank/questions?role=Backend+Engineer&level=mid"
```

### Free-tier quota

```bash
# Run 3 analyses with the same free-tier user — 3rd should return 429
# (set FREE_TIER_ANALYSIS_LIMIT=2 in .env)
```

### Admin token dashboard (requires is_admin flag)

```bash
# Set a user as admin directly in the DB for testing:
docker compose exec postgres psql -U postgres -d hireiq \
  -c "UPDATE users SET is_admin = TRUE WHERE email = 'admin@test.com';"

curl http://localhost:8000/admin/tokens/summary \
  -H "Authorization: Bearer <admin_jwt>"
```

---

## 6. Frontend Development

```bash
cd frontend && npm install && npm run dev
```

### Key new routes

| Route | Component | Notes |
|-------|-----------|-------|
| `/verify-otp` | `VerifyOtp.tsx` | Accepts `?purpose=` and `?email=` query params |
| `/salary` | `SalaryBenchmark.tsx` | Public page |
| `/interview-bank` | `InterviewBank.tsx` | Public listing, auth for progress |
| `/profile` | `Profile.tsx` | Full rewrite (auth required) |

### Theme changes

The color swap is handled in `tailwind.config.js`. After updating the config, run `npm run build` or let Vite's HMR pick it up. Check for any hardcoded `violet-*` or `purple-*` classes that were missed by the systematic replace.

---

## 7. Key Files to Know

| File | Purpose |
|------|---------|
| `Backend/services/otp_service.py` | OTP generation, HMAC storage, verification, rate-limiting |
| `Backend/services/token_tracker.py` | Free/paid tier quota enforcement |
| `Backend/scripts/import_questions.py` | Kaggle + AI-curated question import |
| `Backend/data/salary_seed.json` | Curated salary benchmark data |
| `frontend/src/pages/VerifyOtp.tsx` | Unified OTP entry screen |
| `specs/002-enhance-features-phase2/data-model.md` | Full schema reference |
| `specs/002-enhance-features-phase2/contracts/` | All new API endpoint contracts |
