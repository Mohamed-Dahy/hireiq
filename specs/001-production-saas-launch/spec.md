# Feature Specification: HireIQ Production SaaS Launch

**Feature Branch**: `001-production-saas-launch`
**Created**: 2026-05-10
**Status**: Amended — v1.3 (2026-05-12: Phases 1–4 complete; phase order revised; three new growth/platform user stories added: US9 Referral Engine, US10 Admin BI Dashboard, US11 Notification Center)
**Input**: Customer-driven request to transform HireIQ from a portfolio demo into
a commercially deployable, subscription-based SaaS product.

---

## Pre-Specification Assessment

The following issues were discovered during a codebase audit. These are
**blockers** that must be resolved before deployment work begins:

| Severity | Issue | Impact |
|----------|-------|--------|
| CRITICAL | `Backend/.env.docker` is committed to git and contains a live database password | Credential leak |
| HIGH | PostgreSQL runs only on the host machine — not in the container stack | Cannot deploy without a host |
| HIGH | Database schema is applied via `create_all()` on startup — no migration system | Cannot evolve the schema safely |
| HIGH | `user_id` in `cv_sessions` is still nullable (left-over dev flag) | Any unauthenticated user can create sessions |
| MEDIUM | `Config` class in `config.py` is not indented inside `Settings` — `.env` loading may be silently broken | Settings may fall back to defaults in some environments |
| MEDIUM | Refresh tokens are never invalidated or rotated — logout does not actually revoke sessions | Session hijack risk after logout |
| LOW | No structured application logging — errors go to stdout with no severity or trace IDs | Ops visibility is zero in production |

**Recommendation**: Address CRITICAL and HIGH issues in a hardening pass
before building any new features. These are not blocking spec approval but
are blocking any production deployment.

---

## User Scenarios & Testing

### User Story 1 — Secure, Verified Registration & Login (Priority: P1)

A new visitor creates an account, verifies their email address, and is granted
access to the free tier. A returning user logs in, is remembered across browser
sessions, and can securely recover a forgotten password without contacting support.

**Why this priority**: Authentication is the entry point to every other feature.
Broken or insecure auth blocks subscription, payment, and feature-gating work.

**Independent Test**: A tester can register with a new email, receive a
verification link, click it, log in, and confirm their profile shows "verified"
status — without touching any other feature.

**Acceptance Scenarios**:

1. **Given** an unregistered email, **When** a visitor submits valid registration
   details, **Then** a verification email is sent and the account is in "pending"
   state until the link is clicked.
2. **Given** an unverified account, **When** the user attempts to log in,
   **Then** they are prompted to verify their email before access is granted.
3. **Given** a verified account, **When** the user requests a password reset,
   **Then** a time-limited reset link is sent and the old password is invalidated
   upon use of the link.
4. **Given** a valid session, **When** the user logs out, **Then** the session
   token is immediately invalidated and cannot be reused.
5. **Given** 5 consecutive failed login attempts from the same account,
   **When** a 6th attempt is made within 10 minutes, **Then** the account is
   temporarily locked and the user is notified by email.

---

### User Story 2 — Fully Containerized, Self-Deployable Infrastructure (Priority: P1)

A developer (or the platform operator) runs a single command and the entire
HireIQ platform starts — including the database, cache, admin panel, backend,
and frontend — with no manual host-side setup beyond supplying an environment
file. The same setup works identically on any Linux host, local machine, and
cloud VPS.

**Why this priority**: Without a self-contained deployment, no other production
work can be shipped or demonstrated to the customer.

**Independent Test**: On a fresh Linux machine with Docker installed,
run `docker compose up --build`, supply a `.env` file, and confirm all services
are healthy and the app loads in a browser.

**Acceptance Scenarios**:

1. **Given** a fresh host with only Docker and a filled `.env` file,
   **When** `docker compose up --build` is run, **Then** all services start
   healthy within 3 minutes and the app is accessible.
2. **Given** the database container starts for the first time,
   **When** the backend starts, **Then** all schema migrations run automatically
   and the database is fully initialised.
3. **Given** the platform is running, **When** an operator opens the database
   admin panel URL, **Then** they can browse tables and run queries without
   installing anything locally.
4. **Given** any service crashes, **When** Docker detects the failure,
   **Then** the service restarts automatically without operator intervention.
5. **Given** no secrets are hardcoded anywhere in the repository, **When** a
   `.env` file is not present, **Then** all services fail with a clear error
   message identifying the missing variable.

---

### User Story 3 — Subscription Plans & Feature Gating (Priority: P2)

A free-tier user sees which premium features are locked, chooses a plan, pays,
and immediately gains access. A subscriber can view and manage their active
subscription (plan details, renewal date, cancellation).

**Why this priority**: Subscriptions are the commercial model. Without this,
the app cannot be sold.

**Independent Test**: A tester creates a free account, attempts a locked
feature and sees an upgrade prompt, subscribes to a paid plan, pays, and
confirms the feature is now accessible — all within one browser session.

**Acceptance Scenarios**:

1. **Given** a free-tier user, **When** they attempt a gated feature,
   **Then** they see a clear upgrade prompt with plan options and pricing.
2. **Given** a user on the subscription page, **When** they select a plan and
   complete payment, **Then** their account is upgraded within 60 seconds and
   they receive a confirmation email.
3. **Given** a subscribed user, **When** they open their account settings,
   **Then** they can see their current plan, next billing date, and a
   cancellation option.
4. **Given** a cancelled subscription, **When** the billing period ends,
   **Then** the account reverts to free tier automatically and the user is
   notified 3 days in advance.
5. **Given** a failed payment (expired card, insufficient funds),
   **When** the system retries and the payment fails 3 times,
   **Then** the account reverts to free tier and the user is notified with
   instructions to update their payment method.

---

### User Story 4 — Enhanced AI Analysis & Interview Intelligence (Priority: P2)

A premium subscriber uploads a CV, selects a target job role, and receives a
detailed analysis: a structured skills inventory, a gap report against the role,
tailored interview questions with model answers, and a recommended study roadmap.
The analysis completes within 30 seconds for a standard CV.

**Why this priority**: Deeper AI value justifies the subscription price and
differentiates HireIQ from generic CV tools.

**Independent Test**: A tester uploads a sample CV, specifies a target role,
and within 30 seconds receives a skills inventory with at least 10 identified
skills, a gap report, 5+ tailored questions, and a study roadmap — all without
reading the CV manually.

**Acceptance Scenarios**:

1. **Given** a CV and a target role, **When** analysis is requested,
   **Then** a structured skills inventory (hard skills, soft skills, experience
   level per skill) is returned.
2. **Given** a skills inventory and a job description, **When** a gap report
   is generated, **Then** missing critical skills are identified and ranked
   by hiring importance.
3. **Given** a skills inventory, **When** interview questions are generated,
   **Then** at least 5 role-specific behavioural and technical questions are
   returned, each with an ideal answer guide.
4. **Given** a gap report, **When** a study roadmap is requested,
   **Then** a prioritised list of learning resources or topics is returned
   for each missing skill.
5. **Given** an AI provider outage or rate limit hit, **When** analysis is
   requested, **Then** the user sees a clear "service temporarily unavailable"
   message and their credits are not consumed.

---

### User Story 5 — Professional, Conversion-Optimised Frontend (Priority: P3)

A first-time visitor lands on the marketing page and immediately understands
the product's value. The UI is polished, consistent, and visually compelling
enough that the visitor signs up without needing a sales call. Existing users
find the product easier to navigate and trust it as a professional tool.

**Why this priority**: UI polish is essential for commercial credibility but
does not block core functionality.

**Independent Test**: An independent evaluator who has never seen HireIQ rates
the landing page and app UI at ≥ 4/5 for professionalism and clarity without
any briefing.

**Acceptance Scenarios**:

1. **Given** a new visitor on the landing page, **When** they read the page,
   **Then** they can articulate what HireIQ does and who it is for within
   60 seconds.
2. **Given** any page in the app, **When** it is viewed on a mobile device,
   **Then** all content is readable and interactive elements are usable without
   zooming.
3. **Given** a slow internet connection (3G), **When** the app loads,
   **Then** the first meaningful content appears within 3 seconds.
4. **Given** any action that takes more than 1 second, **When** the user
   triggers it, **Then** a visible loading indicator is shown immediately.

---

### User Story 6 — Platform Security & Attack Prevention (Priority: P1)

The platform handles user identity, payment initiation, and personally
identifiable information (CV content, email addresses, interview recordings).
A malicious actor attempting to exploit the system MUST be detected, blocked,
and logged without disrupting legitimate users. The customer MUST be able to
demonstrate to their own clients that the platform operates at a professional
security standard.

**Why this priority**: Users enter payment details and upload personal CVs.
A single exploitable vulnerability can compromise the entire user base and
destroy customer trust. Security is as foundational as authentication.

**Independent Test**: A security-focused tester attempts the 10 most common
web application attacks (SQL injection, XSS, CSRF, brute force, path
traversal, insecure direct object reference, directory listing, clickjacking,
man-in-the-middle, and webhook replay) and confirms each attempt is blocked
and logged without accessing protected data or disrupting other users.

**Acceptance Scenarios**:

1. **Given** all network traffic, **When** any request is made to the platform,
   **Then** it is served exclusively over an encrypted connection; any
   unencrypted request is automatically redirected.
2. **Given** all API responses, **When** a browser receives them,
   **Then** security response headers are present that prevent clickjacking,
   content-type sniffing, and cross-site scripting injection.
3. **Given** an attacker who intercepts a Paymob webhook notification,
   **When** they replay it or forge a fake success notification,
   **Then** the signature verification rejects it and the subscription is NOT
   upgraded; the attempt is logged as a security event.
4. **Given** an attacker who submits a malicious file (e.g., executable
   disguised as a PDF) to the CV upload endpoint, **When** the upload is
   processed, **Then** the file is rejected before it is stored, with a clear
   error message to the legitimate user.
5. **Given** an authenticated user accessing their own CV sessions,
   **When** they attempt to access another user's session by modifying an ID
   in the URL or request body, **Then** the system returns a 404 (not a 403
   — do not reveal the resource exists) and logs the access attempt.
6. **Given** a security event (failed login, webhook forgery, unauthorised
   resource access, rate limit breach), **When** it occurs, **Then** it is
   written to a tamper-resistant audit log with timestamp, IP address, user
   identity (if known), and event type.
7. **Given** a brute-force script submitting hundreds of login attempts per
   minute, **When** it exceeds the rate limit, **Then** the IP is blocked for
   a progressive cool-down period and the account owner is alerted if their
   account is targeted.
8. **Given** all fields in all forms and API request bodies, **When** an
   attacker injects SQL, JavaScript, or shell commands into any field,
   **Then** the input is rejected or safely escaped before processing; the
   database, filesystem, and rendered HTML are unaffected.
9. **Given** a user who deletes their account, **When** deletion is confirmed,
   **Then** all personally identifiable data (email, name, CV files, interview
   recordings) is permanently removed within 24 hours, and only anonymised
   aggregate statistics are retained.
10. **Given** any error that occurs in the backend, **When** the error response
    is returned to the client, **Then** it contains no stack trace, file path,
    database query, or internal system detail — only a safe, user-facing
    message and a reference code.

---

---

### User Story 9 — Referral & Viral Growth Engine (Priority: P2)

Every registered user has a unique, shareable referral link. When a referred user
subscribes to any paid plan, the referrer automatically earns 10 days free,
credited to their next billing cycle. A public leaderboard (usernames only —
no PII) shows the top referrers and creates social motivation to share.

**Why this priority**: Referral is the highest-ROI acquisition channel for a
SaaS product targeting job seekers — the audience is inherently social and
career-motivated. Building it before subscriptions means the reward is wired
into the billing system from day one, not retrofitted later.

**Independent Test**: User A shares their referral link → User B registers via
the link → User B pays for a plan → User A's account shows 1 conversion and
10 days free earned → both receive confirmation emails → leaderboard shows
User A's referral count.

**Acceptance Scenarios**:

1. **Given** a registered user, **When** they open their profile or referral
   page, **Then** they see a unique referral link with a one-click copy button
   and a count of successful referrals.
2. **Given** a visitor who clicks a referral link, **When** they register,
   **Then** the referral relationship is recorded and will be credited when
   they subscribe.
3. **Given** a referred user who subscribes to a paid plan, **When** the
   payment is confirmed, **Then** the referrer automatically earns 10 days
   free on their next billing cycle, and both users receive a notification.
4. **Given** a user who tries to refer themselves (same email or same device),
   **When** they attempt to register via their own link, **Then** the self-
   referral is silently ignored (no error, no credit).
5. **Given** 10 or more active referrers, **When** the leaderboard is viewed,
   **Then** the top 10 referrers are shown by username and referral count —
   no email addresses, user IDs, or other PII is displayed.

---

### User Story 10 — Platform Owner Admin Business Intelligence Dashboard (Priority: P2)

The platform operator (product owner) has a private admin panel accessible only
with a separate admin credential — not connected to the regular user auth flow.
The dashboard shows real-time business health metrics: monthly active users,
monthly recurring revenue, free-to-paid conversion rate, plan distribution,
feature usage, and recent security audit events.

**Why this priority**: A SaaS cannot be run without visibility into what is
working. This dashboard gives the operator the data needed to make decisions
about pricing, features, and marketing — particularly critical at launch when
rapid iteration is needed based on real user behaviour.

**Independent Test**: Admin logs in with the admin credential → dashboard shows
accurate user count, MRR, conversion rate, and recent audit events → logging in
with a regular user token on `/admin/*` routes returns 403.

**Acceptance Scenarios**:

1. **Given** an operator with the admin credential, **When** they log into the
   admin panel, **Then** they see a dashboard with: total registered users,
   monthly active users, MRR, ARR, and free-to-paid conversion rate.
2. **Given** the admin dashboard, **When** the operator views the plan
   distribution chart, **Then** they can see the count of users on each plan
   (free, professional, recruiter) as an up-to-date breakdown.
3. **Given** the admin dashboard, **When** the operator views the feature usage
   section, **Then** they see counts of: CV uploads, interviews conducted, job
   tracker entries, and recruiter lists created — for the last 30 days.
4. **Given** a regular user's JWT token, **When** it is used to request any
   `/admin/*` endpoint, **Then** the request is rejected with 403 — the
   admin panel is completely isolated from the user auth system.
5. **Given** the admin audit log view, **When** the operator views recent
   security events, **Then** they can see the last 100 security audit log
   entries with event type, IP, outcome, and timestamp — no raw PII
   (email addresses are masked, CVs are referenced by session ID only).

---

### User Story 11 — Personalised Career Growth Roadmap (Priority: P2)

A user selects a CV they have already uploaded, types their dream job or target
role, and receives a complete, phased career development roadmap. The roadmap
is not a flat list of missing skills — it is a structured, time-boxed journey
from the user's current position to their goal, with specific courses, books,
projects to build, milestones, market salary data, and immediate quick wins
for the first two weeks.

Users can save multiple roadmaps for different target roles and revisit them
as their career evolves.

**Why this priority**: The CV scoring feature tells users *where they stand*
today. The roadmap tells them *how to get where they want to be*. Together,
these create the core long-term value of the platform — a tool people return
to throughout their career, not just once per job application.

**Independent Test**: A tester with an uploaded CV types "Senior Data Engineer
at a FinTech company" and within 30 seconds receives a roadmap with: 3–5 named
phases, each containing specific resource recommendations (course name, free/paid,
estimated hours), a project to build, and a milestone; plus a career insight card
showing local and remote salary ranges, top hiring companies, and in-demand skills;
plus 3 quick wins the user can start today.

**Acceptance Scenarios**:

1. **Given** an uploaded CV and a specified target role, **When** the user
   requests a career roadmap, **Then** the system returns a structured plan
   with 3–5 phases covering the skills gap from their current profile to the
   target role requirements.
2. **Given** a career roadmap phase, **When** the user views it, **Then** they
   see: the phase name, estimated duration in weeks, skills covered, ≥3 specific
   learning resources (with free/paid status and estimated hours), one project
   to build to demonstrate the skills, and a measurable milestone.
3. **Given** a generated roadmap, **When** the career insight section is viewed,
   **Then** the user sees: salary range for the target role in Egypt (EGP),
   remote salary range (USD), the top 5 companies currently hiring for this
   role, and the most in-demand niche skills that differentiate candidates.
4. **Given** a generated roadmap, **When** the user views the quick wins section,
   **Then** they see 3 concrete actions they can complete within 2 weeks to
   immediately begin closing the gap — each with a clear reason why it matters
   and a time estimate.
5. **Given** a user who wants to explore multiple career paths, **When** they
   generate roadmaps for different target roles, **Then** all roadmaps are saved
   and accessible from a history list — each labelled with the target role and
   creation date.

---

### Edge Cases

- What happens when a user registers with an email that already exists but is
  unverified? (resend verification vs. duplicate error)
- How is a subscription handled if the payment processor is temporarily
  unreachable during checkout?
- What happens to a user's CV analysis data if their subscription lapses?
  (data retained or purged?)
- What if the AI provider returns a malformed or empty analysis response?
- What if a user tries to upload a password-protected or corrupted PDF?
- What happens if a Paymob webhook arrives twice for the same transaction (duplicate delivery)?
- What if the platform receives a webhook from an IP address not on Paymob's known range?
- What if a session token is presented from a different IP address than where it was issued?
- What happens if an attacker enumerates user IDs to discover valid accounts?

---

## Requirements

### Functional Requirements

- **FR-001**: The system MUST require email verification before granting access
  to any authenticated feature.
- **FR-002**: The system MUST send a time-limited (24-hour) password reset link
  to the registered email address when requested.
- **FR-003**: The system MUST lock an account for 10 minutes after 5 consecutive
  failed login attempts and notify the account owner.
- **FR-004**: The system MUST invalidate all active sessions when a user changes
  their password or explicitly logs out.
- **FR-005**: The entire platform (database, cache, admin panel, API, frontend)
  MUST start from a single `docker compose up` command with no host-side
  dependencies beyond Docker and a `.env` file.
- **FR-006**: The database admin panel MUST be accessible on its own port,
  protected by a separate admin password supplied via environment variable,
  and MUST NOT be exposed on the public-facing port.
- **FR-007**: All schema changes MUST be applied via a versioned migration
  system that runs automatically on container start.
- **FR-008**: The system MUST define at least two subscription tiers (Free and
  Professional) with clearly documented feature entitlements for each.
- **FR-009**: The system MUST use Paymob as the sole payment gateway,
  supporting EGP payments via Visa/Mastercard, Meeza cards, Fawry, Vodafone
  Cash, and Orange Cash. All card entry MUST occur inside Paymob's hosted
  iframe — card data MUST NEVER pass through or be stored on HireIQ servers.
  Stripe is out of scope for this version.
- **FR-010**: The system MUST gate premium features at the API level — a user
  without an active paid subscription MUST receive a 402 response when
  attempting a gated endpoint.
- **FR-011**: The system MUST send transactional emails (verification, password
  reset, payment confirmation, subscription change) via an SMTP or email
  API service configured through environment variables.
- **FR-012**: The AI analysis MUST return a structured skills inventory,
  skills gap report, at least 5 tailored interview questions with model
  answers, and a study roadmap for each CV + role pair.
- **FR-013**: The system MUST NOT consume AI analysis credits if the AI
  provider returns an error or timeout; the request MUST be retried once
  before failing gracefully.
- **FR-014**: No secret, API key, or credential MUST appear in any committed
  source file; all configuration MUST be supplied via `.env`.

#### Security Requirements (FR-015 – FR-032)

- **FR-015**: All traffic to and from the platform MUST be served over HTTPS.
  HTTP requests MUST be permanently redirected (HTTP 301) to HTTPS. The
  platform MUST NOT operate on an unencrypted connection in any deployment.

- **FR-016**: Every HTTP response MUST include the following security headers:
  `Strict-Transport-Security` (HSTS, min-age 1 year), `X-Content-Type-Options:
  nosniff`, `X-Frame-Options: DENY`, `Content-Security-Policy` (restricting
  script sources to self and Paymob's iframe domain), and
  `Referrer-Policy: strict-origin-when-cross-origin`.

- **FR-017**: All user-supplied input (form fields, query parameters, file
  names, JSON body fields) MUST be validated and sanitised at the API boundary
  before being processed or stored. Inputs exceeding defined length limits MUST
  be rejected with a 422 response.

- **FR-018**: The system MUST prevent SQL injection by using parameterised
  queries or an ORM abstraction for every database interaction. Raw SQL
  constructed from user input is prohibited.

- **FR-019**: All rendered output that includes user-supplied content (CV
  filenames, usernames, job titles, notes) MUST be HTML-encoded before
  rendering in the browser. The frontend MUST NOT use `dangerouslySetInnerHTML`
  with user data.

- **FR-020**: State-changing requests (subscription upgrades, account deletion,
  password changes) MUST be protected against Cross-Site Request Forgery.
  The CSRF protection mechanism MUST be enforced at the server side, not
  only in the frontend.

- **FR-021**: File uploads MUST be validated for MIME type using server-side
  magic-byte inspection (not only the file extension or Content-Type header).
  Only PDF files are accepted at upload endpoints. Maximum file size is 10 MB.
  Uploaded files MUST be stored with a system-generated filename — the original
  user-supplied filename MUST NOT be used as the storage path.

- **FR-022**: All Paymob webhook notifications MUST have their HMAC-SHA512
  signature verified against `PAYMOB_HMAC_SECRET` before any business logic
  executes. Requests with invalid or missing signatures MUST be rejected with
  a 401 and logged. Duplicate webhook deliveries (same transaction ID received
  twice) MUST be idempotently ignored after the first successful processing.

- **FR-023**: Resource access MUST be verified for ownership on every request.
  A user requesting another user's CV session, job application, or subscription
  record MUST receive a 404 response (not 403) so that the existence of the
  resource is not disclosed.

- **FR-024**: The system MUST maintain an append-only security audit log
  capturing: authentication events (login success/failure, logout, password
  change, email verification), payment events (checkout initiated, webhook
  received, subscription changed), access control violations (ownership check
  failure, feature gate hit, rate limit exceeded), and admin panel access.
  Each entry MUST record: timestamp (UTC), event type, user ID or "anonymous",
  and source IP address.

- **FR-025**: Rate limits MUST be applied to all write and authentication
  endpoints. At minimum: login (5/minute), register (3/minute), password reset
  (3/hour), CV upload (10/hour), and webhook (100/minute). Exceeding a limit
  MUST return HTTP 429 with a `Retry-After` header.

- **FR-026**: Error responses returned to clients MUST contain only a
  user-facing message and an opaque reference code. Stack traces, file paths,
  SQL queries, and internal service names MUST NEVER appear in responses
  delivered to users or logged to client-accessible locations.

- **FR-027**: All data in transit between the browser and the platform MUST be
  encrypted (TLS 1.2 minimum, TLS 1.3 preferred). All data in transit between
  internal services (backend ↔ database, backend ↔ Redis) MUST use encrypted
  connections or be isolated to a private Docker network inaccessible from
  outside the host.

- **FR-028**: Sensitive fields in the database (user email addresses, CV file
  references) MUST NOT be logged in plain text in application logs. Log entries
  MUST use user IDs and anonymised references instead of PII.

- **FR-029**: The platform MUST support account deletion. When a user deletes
  their account, all PII (email, username, CV files on disk, interview
  recordings) MUST be permanently deleted within 24 hours. Anonymised
  aggregate statistics (count of sessions, average scores without attribution)
  MAY be retained for system analytics.

- **FR-030**: Third-party dependencies (Python packages, npm packages) MUST be
  pinned to specific versions in `requirements.txt` and `package-lock.json`.
  A dependency audit MUST be performed before the initial deployment and
  after any dependency update.

- **FR-031**: The database admin panel (Adminer) MUST NOT be exposed on any
  publicly reachable network port. Access MUST require SSH tunnelling or
  VPN — it is a maintenance tool, not a user-facing service.

- **FR-032**: Before go-live with any paying customer, a manual security
  walkthrough MUST be completed covering: OWASP Top 10 checklist, payment
  flow verification (confirm no card data touches HireIQ servers), webhook
  replay test, brute-force lockout test, and file upload bypass test.

### Key Entities

- **User**: Registered identity; attributes include verification status,
  subscription tier, and subscription expiry date.
- **Subscription**: A user's current commercial relationship; attributes
  include plan name, start date, renewal date, and payment status.
- **Payment**: A recorded financial transaction; attributes include amount,
  currency, gateway reference, status, and linked subscription.
- **SubscriptionPlan**: A product offered for sale; attributes include name,
  price, billing cycle, and list of feature entitlements.
- **FeatureEntitlement**: A named, gated capability (e.g., "enhanced-analysis",
  "mock-interview-unlimited", "pdf-export") linked to a plan.
- **CVSession**: Extended to record which subscription tier was active when the
  session was created (for audit and downgrade handling).
- **EmailLog**: A record of every transactional email sent, for debugging and
  compliance.
- **SecurityAuditLog**: An append-only record of every security-relevant event
  (authentication, payment, access violation, rate limit breach); attributes
  include event type, user ID (nullable), source IP, timestamp, and outcome.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: The entire platform starts from a single command on a fresh host
  in under 5 minutes without any manual intervention.
- **SC-002**: A new user completes registration, email verification, and first
  CV upload in under 4 minutes.
- **SC-003**: A free-tier user can complete the upgrade and payment flow in
  under 3 minutes from clicking "Upgrade".
- **SC-004**: AI analysis (skills inventory + gap report + questions + roadmap)
  completes within 30 seconds for a standard 2-page CV.
- **SC-005**: The application handles 50 concurrent users without visible
  performance degradation.
- **SC-006**: Zero hardcoded credentials remain in the repository after the
  hardening pass.
- **SC-007**: An independent evaluator (not the developer) rates the landing
  page and app UI at ≥ 4 out of 5 for professionalism without any briefing.
- **SC-008**: Payment confirmation is delivered to the user's email within
  2 minutes of a successful transaction.
- **SC-009**: At least 10% of registered free-tier users convert to the
  Professional plan (299 EGP/month) within 30 days of the platform launching
  to the first customer.
- **SC-010**: A forged or replayed Paymob webhook (invalid HMAC signature)
  MUST be rejected 100% of the time and logged within 1 second of receipt.
  Zero fraudulent subscription upgrades result from webhook manipulation in
  any test scenario.
- **SC-011**: All 10 attack categories in the pre-launch security walkthrough
  (OWASP Top 10 adapted) return no exploitable vulnerabilities. Any finding
  is remediated before the go-live date.
- **SC-012**: No stack trace, database query, file path, or internal service
  name appears in any error response observable by a user or an unauthenticated
  client in production.

---

## Assumptions

- The initial commercial deployment targets a single customer (B2B); later
  self-serve public launch is planned but out of scope for this specification.
- The developer has access to a Linux VPS or cloud host for deployment;
  local Windows Docker is used for development only.
- The existing Groq API free tier is sufficient for demo and early customer
  usage; scaling AI infrastructure is deferred until volume demands it.
- Email delivery will use a transactional email provider (e.g., Resend,
  Brevo, SendGrid) — all three offer free tiers adequate for early usage.
- Three new premium features will be built to justify the paid subscription:
  (1) LinkedIn profile URL import — users paste a LinkedIn URL and receive
  the same skills analysis as a CV upload; (2) ATS-style job application
  tracker — users save target jobs, track application status, and see a
  CV-to-job match score per application; (3) Recruiter/company dashboard —
  an employer-facing view where a recruiter uploads multiple candidate CVs,
  compares scores side-by-side, and exports a ranked shortlist. These three
  features, combined with the existing CV scoring and mock interview, define
  the Professional tier's value proposition.
- The database admin panel (pgAdmin or equivalent) will be accessible only
  on a non-public port and protected by a strong admin password.
- The frontend redesign will use the existing React + Tailwind stack with a
  new component library or design system; a full framework rewrite is out
  of scope unless the user explicitly requests it.
- Refresh token rotation will be implemented as part of the auth hardening
  pass, making the existing silent-refresh interceptor on the frontend
  fully secure.
- Because all card entry occurs inside Paymob's hosted iframe, HireIQ qualifies
  as a PCI DSS SAQ A merchant — the lowest compliance tier. No card data
  (PAN, CVV, expiry) ever passes through or is stored on HireIQ infrastructure.
  The security requirements in FR-015–FR-032 are in addition to, not a
  substitute for, PCI DSS SAQ A self-assessment.
- The VPS used for deployment MUST be hardened before go-live: SSH key-only
  access (no password login), UFW or iptables firewall allowing only ports
  80, 443, and 22, and Docker socket not exposed over TCP.
- A penetration test or structured OWASP walkthrough is assumed to be performed
  by the developer (not a third-party firm) before go-live. If the customer
  requires a third-party pen test report, this is a scope change requiring
  a separate agreement.
- Stripe integration is deferred to a future version. All payment references
  in this specification refer to Paymob only.
