# Implementation Plan: HireIQ System Enhancement — Phase 2

**Branch**: `002-enhance-features-phase2` | **Date**: 2026-05-14 | **Last updated**: 2026-05-14 (post-clarification sync) | **Spec**: [spec.md](./spec.md)

---

## Summary

Replace OTP-based email/password verification (removing magic links), rebuild the Profile page as a full activity hub, overhaul the frontend color theme from purple to blue/teal, add responsive mobile layouts, and introduce two new non-AI features (Salary Benchmark Explorer and Interview Question Bank). Additionally enhance the Career Roadmap to generate gap-only plans and add AI token governance with free/paid tier quota enforcement.

Backend additions: new SQLAlchemy models, Alembic migrations (009–013), service modules, and routers. Frontend additions: new pages (VerifyOtp, SalaryBenchmark, InterviewBank), complete Profile.tsx rewrite, AppShell mobile nav, and a Tailwind theme token swap.

---

## Technical Context

**Language/Version**: Python 3.11 (backend), TypeScript 5.x with `strict: true` (frontend)  
**Primary Dependencies**: FastAPI, SQLAlchemy 2.x, Alembic, Pydantic v2, python-bcrypt, python-jose, resend, slowapi, loguru (backend); React 18, Vite 5, TailwindCSS v3, Framer Motion, Axios, Lucide React (frontend)  
**Storage**: PostgreSQL 16 (primary data), Redis 7 (JTI blacklist, rate-limit counters), ChromaDB (CV embeddings), local filesystem (CV uploads)  
**Testing**: pytest — unit tests (isolated, no I/O), integration tests (real PostgreSQL + Redis, no mocks per constitution)  
**Target Platform**: Linux container via Docker Compose  
**Project Type**: Web application — FastAPI REST backend + React SPA frontend  
**Performance Goals**: Non-LLM API responses ≤ 500ms p95; salary/bank queries ≤ 200ms (indexed DB reads); full-text question search ≤ 500ms  
**Constraints**: Secret-free codebase (all config via `.env`), Docker-first, structure fidelity, TypeScript strict, WCAG AA contrast on all new UI  
**Scale/Scope**: Small-to-medium single-developer project; <10k users at launch

---

## Constitution Check

| Principle | Status | Notes |
|-----------|--------|-------|
| I. TypeScript Strict | ✅ Pass | All new `.tsx`/`.ts` files compiled under existing `strict: true` tsconfig |
| II. Test Discipline | ✅ Pass | Every new endpoint gets unit + integration test; no mocked databases |
| III. Docker-First | ✅ Pass | No new Docker services required; seed scripts run inside the existing backend container |
| IV. Secret-Free | ✅ Pass | New env vars (`OTP_HMAC_SECRET`, `FREE_TIER_ANALYSIS_LIMIT`, `LLM_PROVIDER`) added to `.env.example` only |
| V. Error Handling | ✅ Pass | All new routes use Pydantic request schemas; all errors return structured JSON |
| VI. Spec-First | ✅ Pass | This plan follows the approved spec |
| VII. Structure Fidelity | ✅ Pass | New modules placed in existing layers: routers/, services/, models/, pages/, components/ |

No violations. Complexity Tracking section omitted.

---

## Project Structure

### Documentation (this feature)

```text
specs/002-enhance-features-phase2/
├── plan.md              ← this file
├── research.md          ← Phase 0 output
├── data-model.md        ← Phase 1 output
├── quickstart.md        ← Phase 1 output
├── contracts/
│   ├── auth-otp.md
│   ├── profile.md
│   ├── salary-benchmark.md
│   ├── interview-bank.md
│   └── token-management.md
└── tasks.md             ← Phase 2 output (/speckit-tasks)
```

### Source Code (additions and changes)

```text
Backend/
├── migrations/versions/
│   ├── 009_otp_codes.py
│   ├── 010_user_profiles.py
│   ├── 011_salary_benchmarks.py
│   ├── 012_interview_bank.py
│   └── 013_token_tracking.py
├── models/
│   ├── user.py              (add UserProfile, OtpCode; remove EmailVerificationToken, PasswordResetToken)
│   └── content.py           (new: SalaryBenchmark, InterviewQuestion, UserQuestionProgress)
├── services/
│   ├── otp_service.py       (new: generate, store HMAC, verify, rate-limit)
│   ├── auth_service.py      (modify: remove token helpers, add OTP-based flows)
│   ├── email_service.py     (modify: add send_otp_email; remove send_verification_email magic link)
│   ├── salary_service.py    (new: query, seed loader, AI-refresh stub)
│   ├── interview_bank_service.py (new: query, import pipeline, progress tracking)
│   └── token_tracker.py    (new: free/paid tier enforcement, usage logging)
├── routers/
│   ├── auth.py              (modify: swap verification/reset to OTP endpoints)
│   ├── profile.py           (new: stored CV, links, username change, password change)
│   ├── salary.py            (new: salary benchmark CRUD + admin refresh)
│   ├── interview_bank.py    (new: question bank + progress endpoints)
│   └── admin.py             (new: token usage dashboard)
├── data/
│   ├── salary_seed.json     (curated salary data, 20+ roles × 5+ regions)
│   └── questions/           (Kaggle-imported and AI-curated question JSON files)
├── scripts/
│   ├── import_questions.py  (standalone: reads data/questions/, deduplicates, inserts)
│   └── refresh_salary.py    (standalone: uses LLM+WebSearch to update salary_seed.json)
└── tests/
    ├── unit/
    │   ├── test_otp_service.py
    │   ├── test_token_tracker.py
    │   └── test_salary_service.py
    └── integration/
        ├── test_auth_otp.py
        ├── test_profile.py
        ├── test_salary.py
        ├── test_interview_bank.py
        └── test_admin_tokens.py

frontend/src/
├── pages/
│   ├── Auth.tsx             (modify: update to new blue/teal theme; no logic change)
│   ├── Dashboard.tsx        (modify: stats row, recent sessions, empty state, new theme)
│   ├── Profile.tsx          (replace: full rewrite with all new + carried-over sections)
│   ├── VerifyOtp.tsx        (new: /verify-otp route, reused for all OTP purposes)
│   ├── SalaryBenchmark.tsx  (new)
│   └── InterviewBank.tsx    (new)
├── components/
│   ├── layout/
│   │   └── AppShell.tsx     (modify: add mobile hamburger nav / bottom-nav)
│   └── OtpInput.tsx         (new: 5-digit OTP input component)
├── lib/
│   └── constants.ts         (modify: add new route paths, tier config)
└── App.tsx                  (modify: add new routes, update theme tokens)
```

**Structure Decision**: Option 2 (Web Application) — existing `Backend/` + `frontend/` split is preserved. No new top-level directories.
