<!--
SYNC IMPACT REPORT
==================
Version change: [TEMPLATE] → 1.0.0 (initial ratification)

Modified principles: N/A — all sections are new (first adoption)

Added sections:
  - Core Principles (7 principles)
  - Security & Compliance
  - Development Workflow
  - Governance

Removed sections: N/A

Templates checked:
  - .specify/templates/plan-template.md          ✅ aligned (Constitution Check gate present)
  - .specify/templates/spec-template.md          ✅ aligned (FR/acceptance criteria structure matches)
  - .specify/templates/tasks-template.md         ✅ aligned (test-first ordering, parallel markers)
  - .specify/templates/checklist-template.md     ✅ aligned (no principle-driven gaps found)
  - .specify/templates/commands/ (no files)      ✅ n/a

Follow-up TODOs:
  - None. All fields resolved from README + user input.
-->

# HireIQ Constitution

## Core Principles

### I. TypeScript Strict Mode

All frontend source files MUST be compiled with TypeScript `strict: true` enabled in `tsconfig.json`.
No use of `any` is permitted unless accompanied by an inline comment explaining why the escape is
unavoidable. Type assertions (`as`) MUST be used only at verified system boundaries (e.g., API
response deserialization), never to silence type errors in business logic.

**Rationale**: The frontend (React 18 + Vite) is the primary user-facing surface. Silent type
mistakes cascade into runtime failures that are invisible until production.

### II. Test Discipline (NON-NEGOTIABLE)

Every backend API endpoint MUST have both a unit test and an integration test before a feature
branch is merged. Frontend feature changes MUST include component-level tests for any new or
modified user interaction path. The test gate order is: write tests → confirm they fail → implement
→ confirm they pass.

- Unit tests: isolated, mock-free logic tests per service/function.
- Integration tests: exercise the real database, real Redis, and real API routing stack.
- No mocked databases in integration tests — a prior incident showed mock/prod divergence masks
  broken migrations.

**Rationale**: HireIQ processes CV uploads, JWT auth flows, and AI-scored interviews. Regressions
in any of these are user-visible and trust-damaging.

### III. Docker-First Infrastructure

Every service (backend, frontend/nginx, Redis) MUST be runnable via `docker-compose up --build`
without manual host-side steps beyond supplying `.env`. New services introduced to the stack MUST
include a `Dockerfile` and a `docker-compose.yml` entry before the PR is opened. Local-only
workarounds that bypass Docker are permitted only for development inner-loop speed (e.g., `uvicorn
--reload`) and MUST NOT be the documented or required startup path.

**Rationale**: Docker Compose is the single source of truth for how the system assembles. Drift
between Docker and local setups is a known source of "works on my machine" defects.

### IV. Secret-Free Codebase

No secret, credential, API key, or environment-specific URL MUST ever appear in source code or
committed configuration files. All runtime configuration MUST be supplied via `.env` files (loaded
by Pydantic `BaseSettings`). `.env` files MUST be listed in `.gitignore`. The only committed
env-related file is `.env.example` (containing placeholder values) and `.env.docker` (containing
non-secret Docker URL overrides). Violations discovered in review MUST be treated as blocking
defects, not style issues.

**Rationale**: HireIQ uses a Groq API key and a JWT secret. Leaking either would compromise all
user sessions or incur unauthorized API costs.

### V. Production-Grade Error Handling & Validation

Every FastAPI route MUST:
- Validate all inputs via Pydantic schemas before any business logic executes.
- Return structured JSON error responses (never raw Python exceptions or 500s with stack traces).
- Log errors at the appropriate severity level using the application logger (not `print()`).

Frontend API calls MUST handle error states explicitly — no silent failures. User-visible error
states MUST render a meaningful message, not a blank screen or spinner that never resolves.

**Rationale**: HireIQ is positioned as production-ready. Unhandled exceptions or unvalidated inputs
are both a security risk (input smuggling, path traversal) and a UX failure.

### VI. Spec-First Development

No implementation code MUST be written until the feature specification (`.specify/specs/`) and
implementation plan have been reviewed and explicitly approved by the user. The sequence is:
spec → user approval → plan → user approval → tasks → implementation. Skipping or compressing
this gate requires explicit written consent in the conversation before proceeding.

**Rationale**: HireIQ is under active solo development. Misaligned implementation wastes effort and
introduces features the user did not intend.

### VII. Structure Fidelity

The existing folder layout documented in `README.md` (Backend/routers, Backend/services,
Backend/models, frontend/src/pages, frontend/src/components, etc.) MUST be followed for all new
code unless the user explicitly instructs a structural change. New modules MUST be placed in the
directory that matches their layer (route handler → `routers/`, business logic → `services/`,
data access → `models/`, etc.). No new top-level directories MUST be created without explicit
user approval.

**Rationale**: Predictable structure reduces cognitive overhead for a single-developer project and
ensures Docker volume mounts and import paths remain stable.

## Security & Compliance

- All file upload endpoints (`/cv/upload`) MUST validate MIME type and enforce a maximum file size
  server-side — client-side validation alone is insufficient.
- Path traversal protection MUST be enforced for any endpoint that reads from the filesystem using
  user-supplied identifiers.
- JWT secrets MUST be rotated by changing `JWT_SECRET` in `.env`; the system MUST invalidate all
  existing tokens on restart.
- Rate limiting (slowapi) MUST remain active on all write endpoints. Raising or removing limits
  requires explicit justification and user approval.
- Dependency updates that include security patches MUST be applied within 7 days of disclosure.

## Development Workflow

- Branch naming: `###-short-description` (e.g., `001-cv-upload-validation`).
- Every PR MUST reference the spec document it implements.
- Before opening a PR, run: `docker-compose up --build` and verify the health endpoint returns 200.
- Breaking changes to API contracts MUST be preceded by a migration plan documented in the spec.
- The user MUST be consulted before any action that affects: production data, deployed services,
  external API keys, or shared infrastructure. This includes force pushes, destructive migrations,
  and dependency removals.

## Governance

This constitution supersedes all implicit conventions. When a new rule conflicts with an existing
pattern in the codebase, the constitution wins and the codebase MUST be updated to comply.

**Amendment procedure**:
1. Propose the amendment in conversation with rationale.
2. User explicitly approves the amendment.
3. Update this file, increment the version per semver rules, and record `LAST_AMENDED_DATE`.
4. Run the consistency propagation checklist across all `.specify/templates/` files.

**Versioning policy**:
- MAJOR: Principle removed, renamed, or redefined in a backward-incompatible way.
- MINOR: New principle or section added, or material guidance expansion.
- PATCH: Clarification, wording fix, typo correction.

**Compliance review**: Every PR description MUST include a "Constitution Check" confirming no
principles are violated. If a violation is necessary (e.g., time-constrained workaround), it MUST
be documented with a linked follow-up task.

**Version**: 1.0.0 | **Ratified**: 2026-05-10 | **Last Amended**: 2026-05-10
