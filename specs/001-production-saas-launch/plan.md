# Implementation Plan: HireIQ Production SaaS Launch

**Branch**: `main` | **Date**: 2026-05-10 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `specs/001-production-saas-launch/spec.md`

## Summary

Transform HireIQ from a portfolio demo into a commercially deployable SaaS
platform. **Phases 1–4 are complete** (infrastructure, auth hardening, security
controls — 80 tests passing).

Remaining work divides into four sequential sprints:

1. **Product completeness (Phases 5–8)**: Enhanced AI analysis, ATS job tracker,
   recruiter dashboard, and a premium frontend redesign — building all product
   value before asking anyone to pay.
2. **Growth & platform infrastructure (Phases 9–11)**: Referral engine (viral
   acquisition), admin BI dashboard (operator visibility), and notification
   center (retention) — the three levers that determine whether the SaaS
   grows after launch.
3. **Monetisation (Phase 12)**: Subscription plans and Paymob payments, wired
   into the referral and notification systems from day one.
4. **Validation & launch (Phases 13–14)**: Full system integration testing,
   Playwright E2E flows, load testing, OWASP walkthrough, and pre-launch polish.

New user stories added: **US9** (Referral & Viral Growth), **US10** (Platform
Owner Admin BI Dashboard), **US11** (Personalised Career Growth Roadmap — LLM-generated
phased career plan with resources, projects, salary data, and quick wins).
All work lands in the existing Backend/frontend folder structure.

## Technical Context

**Language/Version**: Python 3.11 (backend), TypeScript 5.x / React 18 (frontend)
**Primary Dependencies**: FastAPI 0.115+, SQLAlchemy 2, Alembic, LangChain, Groq SDK,
  sentence-transformers, Pydantic v2, React 18, Tailwind CSS v4, Vite 6, shadcn/ui
**Storage**: PostgreSQL 16 (now in Docker Compose), Redis 7, ChromaDB
**Testing**: pytest + httpx (backend unit + integration), Vitest + React Testing Library (frontend)
**Target Platform**: Linux VPS via Docker Compose; dev on Windows with Docker Desktop
**Project Type**: Web application / SaaS (backend API + React SPA)
**Performance Goals**: AI analysis < 30 s for a 2-page CV; page first paint < 3 s; 50 concurrent users without degradation
**Constraints**: Single `docker compose up` cold start; zero hardcoded secrets; EGP payments via Paymob only (Stripe deferred); OWASP Top 10 compliant; PCI DSS SAQ A
**Scale/Scope**: Single B2B customer at launch; architecture supports future public self-serve

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Current State | Plan Verdict |
|-----------|--------------|--------------|
| I. TypeScript Strict Mode | tsconfig not yet verified — check in Phase 0 | MUST verify and enforce `strict: true`; all new components comply |
| II. Test Discipline | **VIOLATION** — zero tests in codebase | ✅ Phase 1 (Setup) adds pytest + Vitest infrastructure; every new endpoint gets unit + integration tests |
| III. Docker-First Infrastructure | **PARTIAL** — PostgreSQL runs on host only; pgAdmin not containerised | ✅ Phase 1 adds both; compose becomes self-contained |
| IV. Secret-Free Codebase | **CRITICAL VIOLATION** — DB password committed in `.env.docker` | ✅ Phase 0 (Hardening) rotates password, removes from file, adds env var reference |
| V. Production-Grade Error Handling & Security | **PARTIAL** — no structured logging, no security headers, no audit log | ✅ Phase 0 adds loguru + security headers middleware + SecurityAuditLog; FR-015–FR-032 implemented before any go-live |
| VI. Spec-First Development | ✅ Compliant — spec approved before plan | N/A |
| VII. Structure Fidelity | ✅ Compliant — existing layout preserved | All new modules placed in correct existing directories |

**Gate result**: PASS with mandatory Phase 0 hardening. No new feature code MUST be written
until Phase 0 is complete and the constitution violations are resolved.

## Project Structure

### Documentation (this feature)

```text
specs/001-production-saas-launch/
├── plan.md              # This file
├── research.md          # Phase 0 decisions and rationale
├── data-model.md        # Phase 1 entity + schema design
├── quickstart.md        # Phase 1 local dev + deploy guide
├── contracts/           # Phase 1 API endpoint contracts
│   ├── auth.md
│   ├── subscriptions.md
│   ├── payments.md
│   ├── cv.md
│   ├── jobs.md
│   └── recruiter.md
└── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
```

### Source Code (repository root)

```text
Backend/
├── app/
│   ├── main.py              # FastAPI app + middleware (existing)
│   └── config.py            # Pydantic settings (fix Config indentation)
├── routers/
│   ├── auth.py              # Extended: verify-email, forgot-password, reset-password
│   ├── cv.py                # Extended: import-linkedin
│   ├── analysis.py          # Extended: enhanced skill inventory + roadmap
│   ├── interview.py         # Existing (no change)
│   ├── subscriptions.py     # NEW: plans, subscribe, status, cancel
│   ├── payments.py          # NEW: Paymob webhook handler
│   ├── jobs.py              # NEW: ATS job tracker CRUD
│   └── recruiter.py         # NEW: recruiter lists + candidates
├── services/
│   ├── auth_service.py          # Extended: email tokens, lockout, token revocation
│   ├── email_service.py         # NEW: transactional email (Resend)
│   ├── subscription_service.py  # NEW: plan lookup, entitlement checks, lifecycle
│   ├── payment_paymob.py        # NEW: Paymob auth → order → payment key creation
│   ├── security_service.py      # NEW: audit log writes, HMAC verification helpers
│   ├── linkedin_service.py      # NEW: LinkedIn PDF export parsing
│   ├── llm_analyzer.py          # Extended: structured skills + roadmap output
│   ├── cv_parser.py             # Existing
│   ├── rag_scorer.py            # Existing
│   ├── interview_engine.py      # Existing
│   ├── cv_vision.py             # Existing
│   ├── report_generator.py      # Extended: include skills inventory + roadmap
│   └── cache.py                 # Existing
├── middleware/
│   ├── subscription_gate.py     # NEW: feature entitlement FastAPI dependency
│   └── security_headers.py      # NEW: injects HSTS, CSP, X-Frame-Options, etc. on every response
├── models/
│   ├── user.py              # Extended: email_verified, failed_login_count, locked_until
│   ├── subscription.py      # NEW: SubscriptionPlan, Subscription, Payment, FeatureEntitlement
│   ├── jobs.py              # NEW: JobApplication, RecruiterList, RecruiterCandidate
│   ├── security.py          # NEW: SecurityAuditLog
│   └── schemas.py           # Extended: all new request/response schemas
├── migrations/              # NEW: Alembic migrations directory
│   ├── env.py
│   ├── alembic.ini
│   └── versions/
│       ├── 001_initial.py                  # baseline: users, cv_sessions, interview_results
│       ├── 002_auth_hardening.py           # email_verified, lockout fields, token tables, security_audit_logs
│       ├── 003_cv_session_extended.py      # skill_inventory, gap_report, study_roadmap, is_linkedin columns
│       ├── 004_jobs_recruiter.py           # job_applications, application_activities, application_contacts
│       ├── 005_user_sessions_revoked_at.py # sessions_revoked_at column on users (FR-004)
│       └── 006_recruiter_tables.py         # recruiter_lists, recruiter_candidates (Phase 7 — pending)
├── tests/                   # NEW: full test suite
│   ├── conftest.py          # pytest fixtures: test DB, test client, auth helpers, subscription helpers
│   ├── unit/
│   │   ├── test_auth_service.py
│   │   ├── test_subscription_service.py
│   │   ├── test_payment_paymob.py
│   │   ├── test_security_service.py  # HMAC verification, audit log, webhook idempotency
│   │   └── test_llm_analyzer.py
│   └── integration/
│       ├── test_auth.py
│       ├── test_cv.py
│       ├── test_subscriptions.py
│       ├── test_payments.py      # webhook signature, duplicate delivery, fraud scenario
│       ├── test_jobs.py
│       ├── test_recruiter.py
│       └── test_security.py      # OWASP Top 10 walkthrough: injection, IDOR, upload bypass, etc.
├── Dockerfile               # Existing (add ALEMBIC_URL env)
├── requirements.txt         # Extended with new deps
├── .env.example             # Extended with all new vars
└── .env.docker              # Fixed: remove hardcoded password

frontend/
├── src/
│   ├── pages/
│   │   ├── Landing.tsx          # Redesigned — hero, features, pricing section
│   │   ├── Auth.tsx             # Extended: email verification banner
│   │   ├── Dashboard.tsx        # Extended: subscription status card
│   │   ├── Upload.tsx           # Extended: LinkedIn import tab
│   │   ├── Results.tsx          # Extended: skills inventory, roadmap display
│   │   ├── History.tsx          # Existing
│   │   ├── SessionDetail.tsx    # Existing
│   │   ├── Interview.tsx        # Existing
│   │   ├── Profile.tsx          # Extended: subscription management
│   │   ├── Pricing.tsx          # NEW: plan comparison + checkout trigger
│   │   ├── Jobs.tsx             # NEW: ATS job tracker list + kanban
│   │   └── Recruiter.tsx        # NEW: recruiter dashboard
│   ├── components/
│   │   ├── FeedbackPanel.tsx    # Existing
│   │   ├── Toast.tsx            # Existing
│   │   ├── SubscriptionGate.tsx # NEW: upgrade prompt wrapper
│   │   ├── PricingCard.tsx      # NEW: plan card
│   │   ├── SkillsInventory.tsx  # NEW: structured skills display
│   │   ├── SkillGapChart.tsx    # NEW: gap visualisation
│   │   ├── StudyRoadmap.tsx     # NEW: roadmap timeline
│   │   ├── JobCard.tsx          # NEW: ATS job card
│   │   └── CandidateCompare.tsx # NEW: recruiter comparison table
│   ├── hooks/
│   │   ├── useWebcam.ts         # Existing
│   │   ├── useRecorder.ts       # Existing
│   │   ├── useSubscription.ts   # NEW: current plan + entitlement checks
│   │   └── usePayment.ts        # NEW: checkout flow state
│   ├── lib/
│   │   └── utils.ts             # NEW: shadcn/ui utility (cn helper)
│   └── api.ts                   # Extended: subscription, payment, jobs, recruiter calls
├── nginx.conf                   # Extended: proxy new routes
├── Dockerfile                   # Existing
└── vite.config.ts               # Existing

docker-compose.yml               # Extended: add postgres + adminer services (not pgAdmin)
```

**Structure Decision**: Web application layout (Option 2) — existing Backend/ and frontend/
directories retained. New modules placed in existing layer directories.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|--------------------------------------|
| Paymob-only gateway (Stripe deferred) | All launch customers are Egypt-based; Paymob covers cards, Fawry, Vodafone Cash, Meeza | Eliminates dual-gateway complexity and Stripe webhook handling |
| Alembic migrations alongside existing create_all() | Cannot safely evolve schema on a running DB | create_all() only adds tables, never modifies columns |
| Redis token blacklist for JWT revocation | JWTs are stateless by design — revocation requires server-side state | DB-based blacklist adds a DB query to every authenticated request; Redis is already in the stack and is O(1) |

---

## Phase 0: Hardening Research Findings

*See `research.md` for full decision log.*

**Key decisions:**

| Concern | Decision | Rationale |
|---------|----------|-----------|
| Secret management | Move DB creds from `.env.docker` to `.env` only; `.env.docker` keeps only Docker network URLs | Minimal change, compliant with constitution |
| Database migrations | Alembic with auto-migration on container start | Industry standard for SQLAlchemy; handles schema drift |
| Structured logging | loguru (simpler API than structlog for solo dev) | One import, no boilerplate, outputs JSON in prod mode |
| Refresh token revocation | Redis SET with TTL equal to token expiry | Redis already deployed; O(1) lookup per request |
| Email provider | Resend (free tier: 3k emails/month, modern API, no credit card) | Superior DX vs. SendGrid/Brevo; adequate for launch |
| pgAdmin in Docker | Adminer (single-container, <50MB image) | pgAdmin is 400MB+ and requires a separate server setup |
| Test runner (backend) | pytest + httpx + pytest-asyncio | Standard FastAPI testing stack; supports async routes |
| Test runner (frontend) | Vitest + React Testing Library + jsdom | Same config as Vite; fastest test runner for Vite projects |
| LinkedIn import strategy | User exports LinkedIn profile as PDF and uploads it | LinkedIn ToS prohibits scraping; PDF export is the only compliant option |
| Frontend design system | shadcn/ui (Tailwind v4 compatible, unstyled base components) | Gives professional component primitives without locking into a visual style |
| Subscription management | Custom implementation (no Paddle/Stripe Billing) | Paymob integration requires custom logic regardless; adding a third-party billing layer would add cost and complexity |
| Security headers delivery | FastAPI middleware class injecting headers on every response | Single place to add/update all 5 required headers; no per-route annotations needed |
| Audit log storage | PostgreSQL `security_audit_logs` table (append-only, no UPDATE/DELETE) | Keeps audit trail in the same transactional DB; Redis would lose data on restart |
| PCI DSS approach | Paymob hosted iframe → SAQ A compliance; card data never on HireIQ servers | Eliminates PCI DSS infrastructure scanning requirements; simplest possible compliance path |
| OWASP walkthrough | Developer-led checklist before go-live (FR-032) | No third-party pen test required at single-customer B2B launch scale |
