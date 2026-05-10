# Research: HireIQ Production SaaS Launch

**Phase 0 output** | **Date**: 2026-05-10

## 1. Credential & Secret Management

**Decision**: Remove the hardcoded DB password from `Backend/.env.docker`.
`Backend/.env.docker` MUST contain only non-secret Docker network overrides (service hostnames, ports).
All secrets (`DATABASE_URL` including password, `GROQ_API_KEY`, `JWT_SECRET`) stay in `Backend/.env`
which is gitignored.

**Rationale**: `.env.docker` is committed and public. The password `1192004` is already exposed
in the git history and must be rotated before any deployment.

**Migration action**:
1. Change the PostgreSQL password in `.env` and on the local DB.
2. Remove `DATABASE_URL` from `.env.docker`.
3. Add `POSTGRES_HOST=host.docker.internal` and `POSTGRES_PORT=5432` to `.env.docker` if needed.
4. Add a git note: "rotate credentials — see hardening task".

**Alternatives considered**:
- Vault / AWS Secrets Manager: overkill for a single-customer launch on a VPS.

---

## 2. Database Migrations: Alembic

**Decision**: Replace `create_all()` with Alembic. Migrations run automatically on container
start via a Docker `command` that runs `alembic upgrade head` before launching uvicorn.

**Rationale**: `create_all()` adds tables but cannot safely modify existing columns. As soon
as `user.py` needs a new column (e.g., `email_verified`), `create_all()` silently skips it
on an existing database. Alembic tracks versions and applies diffs.

**Setup**:
```
alembic init Backend/migrations
# alembic.ini: set sqlalchemy.url = ${DATABASE_URL}
# env.py: import Base from models; target_metadata = Base.metadata
```

**Alternatives considered**:
- Tortoise ORM aerich: would require replacing SQLAlchemy.
- Manual SQL scripts: error-prone, hard to roll back.

---

## 3. Structured Logging: loguru

**Decision**: Use `loguru` for structured application logging. Replace all `print()` calls.
In production mode (`LOG_FORMAT=json` env var), output JSON lines compatible with log
aggregation tools (Loki, Datadog, etc.).

**Rationale**: `structlog` requires more configuration boilerplate. `loguru` has a cleaner
API, supports JSON sink out of the box, and is a single `pip install`.

**Pattern**:
```python
from loguru import logger
logger.info("CV uploaded", user_id=user.id, filename=cv.filename)
```

**Alternatives considered**:
- Python stdlib `logging`: verbose config, no structured output by default.
- `structlog`: excellent but heavier for a solo project.

---

## 4. Refresh Token Revocation: Redis Blacklist

**Decision**: On logout or password change, write the JTI (JWT ID) of the refresh token to
Redis with a TTL equal to the token's remaining lifetime. The `get_current_user` dependency
checks the blacklist before accepting any token.

**Rationale**: JWTs are stateless — the only compliant way to revoke them before expiry is
server-side tracking. Redis is already deployed (used for score caching) and offers O(1)
SET/GET with automatic TTL expiry.

**Implementation note**: Add `jti` claim (UUID) to both access and refresh tokens at creation.
Blacklist key: `token:blacklist:{jti}`.

**Alternatives considered**:
- DB-based blacklist: adds a DB read to every request — slower than Redis.
- Short token lifetimes (no revocation): 30-minute access tokens are acceptable, but refresh
  tokens with 7-day lifetimes need revocation.

---

## 5. Email Delivery: Resend

**Decision**: Use Resend for transactional email. Configure via `RESEND_API_KEY` env var.
Send: email verification, password reset, subscription confirmation, payment receipt,
subscription lapse warning (3 days before).

**Rationale**: Resend offers 3,000 emails/month free, has a clean Python SDK, and does not
require a credit card. Adequate for a single-customer launch.

**Template approach**: Plain-text + simple HTML inline; no third-party template renderer needed
at this scale.

**Alternatives considered**:
- SendGrid: free tier is 100/day, more restrictive.
- Brevo: good alternative; slightly more complex setup.
- SMTP (Outlook/Gmail): rate-limited, requires App Password setup.

---

## 6. Database Admin Panel: Adminer

**Decision**: Add Adminer as a Docker service, exposed on port 8080, protected by
`ADMINER_PASSWORD` env var via nginx basic-auth proxy.

**Rationale**: Adminer is a single PHP container (<50 MB), supports PostgreSQL, and requires
no additional configuration. pgAdmin requires a dedicated server process and 400+ MB image.

**Access model**: Adminer port (8080) MUST NOT be exposed publicly. On a VPS, access via SSH
tunnel: `ssh -L 8080:localhost:8080 user@host`.

**Alternatives considered**:
- pgAdmin: 400 MB image, more complex setup — overkill for solo use.
- TablePlus (local GUI): not portable; requires local install.

---

## 7. PostgreSQL in Docker Compose

**Decision**: Add a `postgres` service to `docker-compose.yml`. Use the official
`postgres:16-alpine` image. Mount a named volume for data persistence. Use
`POSTGRES_PASSWORD`, `POSTGRES_USER`, `POSTGRES_DB` env vars sourced from `.env`.

**Connection**: Backend connects via `postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}`.
`host.docker.internal` reference is removed.

**Rationale**: Self-contained deployment — no dependency on the host machine's PostgreSQL.

---

## 8. Test Infrastructure

**Backend (pytest)**:
- `pytest` + `httpx` (async test client for FastAPI) + `pytest-asyncio`
- `pytest-cov` for coverage reports
- Test DB: a separate PostgreSQL database (`hireiq_test`) created in the same container
- Fixtures in `conftest.py`: `test_db` (transaction rollback after each test),
  `test_client` (FastAPI TestClient), `auth_headers` (pre-authenticated user)
- Integration tests hit the real DB; unit tests mock external services (Groq, Resend, Paymob)

**Frontend (Vitest)**:
- `vitest` + `@testing-library/react` + `jsdom`
- Test coverage for: form validation in Auth.tsx, SubscriptionGate component, useSubscription hook

**Constitution mandate**: Every new backend route MUST have at least one unit test and one
integration test before the PR is merged.

---

## 9. Subscription System Design

**Decision**: Custom implementation — no Paddle, no Stripe Billing, no Chargebee.

**Plan structure**:
- `SubscriptionPlan` table: static catalogue (Free, Professional, Recruiter)
- `Subscription` table: one active row per user, tracks plan, status, and dates
- `Payment` table: one row per transaction (Paymob), linked to subscription
- `FeatureEntitlement` table: maps plan → feature_slug (e.g., `enhanced-analysis`, `linkedin-import`)
- `subscription_gate` middleware dependency: FastAPI `Depends()` that checks user's active plan
  against the required feature_slug for the endpoint

**Lifecycle**:
1. User selects plan → backend creates `Subscription` with `status=pending`
2. Backend creates payment intent with chosen gateway → returns checkout URL
3. User completes payment on gateway hosted page
4. Gateway fires webhook → backend verifies signature → marks Payment as `paid`,
   Subscription as `active`, updates `end_date`
5. Cron job (or background task): 3 days before `end_date`, send reminder email
6. On `end_date` if no renewal payment: set Subscription `status=lapsed`, user reverts to Free

---

## 10. Payment Gateway: Paymob (Egypt — sole gateway for this version)

**Decision**: Integrate via Paymob Accept API (v2). Stripe is deferred to a future version.

**Supported payment methods**: Visa/Mastercard, Meeza, Fawry, Vodafone Cash, Orange Cash
**Currency**: EGP (piastres in API calls; 29900 piastres = 299 EGP)
**Card entry**: Paymob hosted iframe — card data NEVER reaches HireIQ servers
**PCI DSS tier**: SAQ A (lowest — iframe fully offloads card data handling)

**Flow**:
1. Backend authenticates with Paymob → `auth_token`
2. Backend creates order → `order_id`
3. Backend creates payment key → `payment_key`
4. Frontend renders Paymob iframe with `payment_key`
5. User enters card in Paymob's environment
6. Paymob fires webhook to `/payments/webhook/paymob`
7. Backend verifies HMAC-SHA512 signature → activates subscription

**Security requirements** (FR-022):
- HMAC-SHA512 verification on every webhook
- Idempotency check (duplicate delivery → ignore)
- Log all webhook receipts (success and failure) to SecurityAuditLog
- Never log `payment_key`, card details, or Paymob `auth_token`

**Env vars needed**: `PAYMOB_API_KEY`, `PAYMOB_INTEGRATION_ID`, `PAYMOB_HMAC_SECRET`, `PAYMOB_IFRAME_ID`

**Alternatives considered**:
- Stripe: excellent API but EGP support is limited; deferred for international expansion.
- Fawry direct: narrower method support; Paymob is a superset.
- PayTabs: less developer documentation available.

---

## 11. LinkedIn Import

**Decision**: User exports their LinkedIn profile as PDF (Settings → Data Privacy → Get a copy
of your data → Download profile PDF). User uploads this PDF the same way as a CV.

**Rationale**: LinkedIn's ToS explicitly prohibits automated scraping. The PDF export is
compliant, produces a well-structured document, and works with the existing CV parser
(PyMuPDF + spaCy). No LinkedIn API credentials needed.

**UX**: On the Upload page, add a second tab "Import from LinkedIn" with instructions for
how to export the PDF, plus the same upload widget.

**Alternatives considered**:
- LinkedIn OAuth API: limited data access, requires app approval, 2–4 week review process.
- Browser extension to export: complex, out of scope.

---

## 12. Frontend Design System: shadcn/ui

**Decision**: Install shadcn/ui on top of the existing React + Tailwind v4 stack.

**Rationale**: shadcn/ui provides copy-paste component primitives (not a package dependency)
that are fully customisable, accessible, and Tailwind v4 compatible. Avoids the "generic
component library" look. Components are owned by the project — no black-box overrides needed.

**Key components to use**: Button, Card, Dialog, Sheet, Badge, Tabs, Table, Form, Input,
Select, Separator, Progress, Avatar, DropdownMenu, Tooltip.

**New colour palette**: Move away from the default blue-heavy palette to a dark charcoal +
amber accent theme that reads as "intelligent, professional, premium".

**Alternatives considered**:
- Chakra UI: heavy runtime, conflicts with Tailwind.
- Mantine: good but opinionated styling harder to override.
- Radix UI directly: lower-level than shadcn/ui — more work for the same result.
