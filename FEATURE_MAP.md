# HireIQ — Feature Map

> Generated from `specs/001-production-saas-launch/`.  
> Each feature maps to a User Story (US) and/or implementation Phase.

---

## ✅ Completed Features

### 1. Secure Auth & Registration (US1 · Phase 3)
- **What it does**: Full authentication flow with email verification, password reset, account lockout after 5 failed attempts, and session invalidation on password change.
- **Key components**: `EmailVerificationToken`, `PasswordResetToken` models; JWT blacklist via Redis; Resend email integration; `GET /auth/me` extended with subscription + verification fields.
- **Links to**: Auth hardening (US6), Subscription gating (US3 — pending).

### 2. Containerized Infrastructure (US2 · Phase 2)
- **What it does**: Everything runs via `docker compose up --build`. PostgreSQL 16, Redis 7, ChromaDB, Adminer, Backend (Uvicorn), Frontend (Nginx). Alembic replaces `create_all()` for DB migrations.
- **Key components**: `docker-compose.yml`, `Backend/Dockerfile`, `frontend/Dockerfile`, `Backend/nginx.conf`, Alembic migrations (9 files).
- **Links to**: Every other feature — all run inside Docker.

### 3. Platform Security & Attack Prevention (US6 · Phase 4)
- **What it does**: OWASP-focused controls — MIME-type validation on file uploads, IDOR checks on every resource access, CSRF middleware, rate limiting (slowapi), safe error messages (no stack traces), account deletion with GDPR-style data removal, append-only `SecurityAuditLog` for 18 event types.
- **Key components**: `middleware/security.py`, `models/security.py`, rate limiter, file validation in CV upload.
- **Links to**: Auth (US1 — lockout/session invalidation), File upload (US4), every feature that needs IDOR protection.

### 4. Enhanced AI Analysis (US4 · Phase 5)
- **What it does**: CV analysis upgraded with 6 structured keys extracted via LLM (Groq + Llama 3):
  - `skill_inventory` — categorized skills
  - `gap_report` — missing skills vs. job targets
  - `questions` — interview questions
  - `soft_skills_feedback` — communication/teamwork assessment
  - `experience_summary` — career narrative
  - `career_opportunities` — potential roles
- Also supports LinkedIn PDF import.
- **Key components**: `services/llm_analyzer.py`, `rag/prompts.py`, SSE streaming in `GET /analyze`.
- **Links to**: Career Roadmap (US11) — roadmap generation uses the same analysis; ATS Job Tracker (US7) — match scoring uses skills data; Recruiter Dashboard (US8) — candidate ranking uses skills analysis.

### 5. ATS Job Tracker (US7 · Phase 6)
- **What it does**: Full kanban-style job application tracker with 6 statuses (saved → applied → interviewing → offer → rejected → accepted), AI match scoring, status transition validation, activity timeline, contact tracking, aggregate statistics.
- **Key components**: `JobApplication`, `ApplicationActivity`, `ApplicationContact` models; `GET/POST/PATCH/DELETE /jobs`; `GET /jobs/stats`; feature-gated behind `job-tracker` entitlement.
- **Links to**: AI Analysis (US4) — match score uses skill/gap data; Recruiter Dashboard (US8) — candidates linked to sessions; Subscription gating (US3 — pending).

### 6. Recruiter Dashboard (US8 · Phase 7)
- **What it does**: Multi-candidate comparison with ranked shortlists (max 20 per list), AI-driven rank override, PDF export of candidate lists.
- **Key components**: `RecruiterList`, `RecruiterCandidate` models; `GET/POST/DELETE /recruiter/lists`; `GET/POST/DELETE/PATCH /recruiter/lists/{id}/candidates`; `GET /recruiter/lists/{id}/export`.
- **Links to**: AI Analysis (US4) — candidate ranking uses analysis data; ATS Job Tracker (US7) — candidates connect to job applications; Subscription gating (US3 — pending).

### 7. Professional Frontend Redesign (US5 · Phase 8)
- **What it does**: Dark/light mode toggle, zinc/violet color palette, shadcn/ui component migration across all pages (Landing, Auth, Dashboard, Upload, Results, Jobs, History, Profile, Interview, SessionDetail, Recruiter, Referrals), mobile-responsive layouts, Lighthouse-optimized.
- **Key components**: Tailwind CSS v4 theme, shadcn/ui components, `ThemeProvider`, `mode-toggle`.
- **Links to**: Every frontend feature — visual foundation for all pages.

### 8. Referral & Viral Growth Engine (US9 · Phase 9)
- **What it does**: Unique referral links per user, 10-day free reward on conversion, referral leaderboard, registration-via-referral flow.
- **Key components**: `ReferralCode`, `ReferralConversion` models; `referral_service`; `GET/POST /referrals`; `ReferralCard`, leaderboard UI.
- **Links to**: Auth (US1) — referral code on registration; Subscription (US3 — pending) — referral credits apply.

### 9. Career Growth Roadmap (US11 · Phase 11)
- **What it does**: Generates a personalized multi-phase career roadmap via LLM. Each roadmap includes phases (title, duration, skills, resources, projects, milestones), quick wins (checklist with localStorage persistence), and career insights (salary range, market demand, hot skills, top companies, certifications). Users select a CV session, generate a roadmap, and browse saved ones.
- **Key components**: `CareerRoadmap` model; `roadmap_service` (RAG prompt with 3-shot examples); `POST /roadmap/generate`, `GET /roadmap`, `GET /roadmap/{id}`; `CareerRoadmap` page, `RoadmapPhaseCard` (accordion), `CareerInsightCard`, `QuickWinsCard`.
- **Links to**: AI Analysis (US4) — roadmap is based on session analysis data.

---

## ❌ Pending Features

### 10. Admin BI Dashboard (US10 · Phase 10)
**Not started.**
- **What it does**: Platform owner dashboard with MAU, MRR, conversion rates, plan distribution, audit log viewer. Charts via recharts.
- **What's needed**: `analytics_service` (queries for metrics), admin auth middleware, `GET /admin/*` routes, `Admin` page with `MetricCard`, charts.
- **Key files to create**: `services/analytics_service.py`, `routers/admin.py`, `frontend/src/pages/Admin.tsx`.
- **Depends on**: Subscription data (US3) for MRR/plan metrics (partial definition possible without it).

### 11. Subscription Plans & Paymob Payments (US3 · Phase 12)
**Not started.**
- **What it does**: Three-tier plans (Free / Professional 299 EGP / Recruiter 799 EGP), Paymob hosted iframe checkout, feature gating middleware (returns 402 for unentitled features), subscription lifecycle (pending → active → cancelled → lapsed), referral credits.
- **What's needed**:
  - Models: `SubscriptionPlan`, `FeatureEntitlement`, `Subscription`, `Payment`
  - Services: `subscription_service`, `payment_service` (Paymob auth token → order → payment key → webhook HMAC verification)
  - Middleware: `subscription_gate` decorator
  - Frontend: `Pricing` page, `PricingCard`, `SubscriptionGate`, `useSubscription` / `usePayment` hooks
- **Key files to create**: `models/subscription.py`, `services/subscription_service.py`, `services/payment_service.py`, `routers/payments.py`, `frontend/src/pages/Pricing.tsx`.
- **Depends on**: Auth (US1) — user must be authenticated. Referral (US9) — credits apply to subscriptions.

### System Testing (Phase 13)
**Not started.**
- **What it does**: Playwright E2E tests for critical flows, Locust load testing, Lighthouse CI, OWASP ZAP walkthrough.
- **Depends on**: All features (Phases 1–12) must be complete.

### Polish & Go-Live Prep (Phase 14)
**Not started.**
- **What it does**: Final `.env.example` update, nginx route audit, full test suite pass, OWASP re-check, clean Docker validation, JWT rotation verification, README update.
- **Depends on**: All features (Phases 1–13) must be complete.

---

## Summary

| Phase | Feature | Status |
|-------|---------|--------|
| 1 | Setup (test runners, TypeScript, deps) | ✅ Done |
| 2 | Foundational (Docker, Alembic, logging, security headers) | ✅ Done |
| 3 | Secure Auth (email verification, lockout, password reset) | ✅ Done |
| 4 | Security Controls (OWASP, IDOR, audit, rate limiting) | ✅ Done |
| 5 | Enhanced AI Analysis (6-key structured analysis) | ✅ Done |
| 6 | ATS Job Tracker (kanban, match scoring, timeline) | ✅ Done |
| 7 | Recruiter Dashboard (ranked lists, PDF export) | ✅ Done |
| 8 | Frontend Redesign (shadcn/ui, dark mode, zinc/violet) | ✅ Done |
| 9 | Referral Engine (unique links, leaderboard) | ✅ Done |
| 10 | Admin BI Dashboard (charts, metrics, audit log) | ❌ Pending |
| 11 | Career Roadmap (phased plans, quick wins, insights) | ✅ Done |
| 12 | Subscriptions & Paymob Payments (3 tiers, feature gating) | ❌ Pending |
| 13 | System Testing (Playwright, Locust, Lighthouse, OWASP) | ❌ Pending |
| 14 | Polish & Go-Live (env, nginx, README, final pass) | ❌ Pending |

**Test count**: 221 pass, 1 skipped (Paymob webhook — awaiting Phase 12).

---

## Feature Interconnection Diagram

```
US1 Auth ──────────► US6 Security (lockout, session invalidation)
    │
    ├──► US3 Subscriptions (auth required for checkout) [PENDING]
    │
    └──► US9 Referral (referral on registration)
         │
         └──► US3 Subscriptions (credits apply) [PENDING]

US4 AI Analysis ──► US7 ATS Tracker (match scoring)
    │                  │
    ├──► US8 Recruiter (candidate ranking)     └──► US3 Subscriptions (feature gate) [PENDING]
    │
    └──► US11 Career Roadmap (session-based generation)

US2 Docker Infra ──► Everything (all features run in containers)

US5 Frontend ─────► Every frontend page (visual foundation)

US10 Admin BI ────► US3 Subscriptions (MRR/plan data) [PENDING]
```

---

## What to Do Next

1. **Phase 10 — Admin BI Dashboard** (can be started independently)
2. **Phase 12 — Subscriptions & Paymob** (largest remaining effort)
3. **Phase 13 — System Testing** (after all features are done)
4. **Phase 14 — Polish & Go-Live** (final step)
