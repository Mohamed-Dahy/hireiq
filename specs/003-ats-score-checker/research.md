# Phase 0 Research: ATS Score Checker

**Feature**: `003-ats-score-checker` | **Date**: 2026-07-01

This document resolves the open technical questions for adding a production ATS check to the existing Analyze CV flow. No new infrastructure, services, or secrets are introduced; the work reuses dependencies already in the stack (PyMuPDF, spaCy, scikit-learn, sentence-transformers, Groq via LangChain).

---

## R1. Deterministic, AI-independent ATS scoring engine

**Decision**: Implement the ATS structural/quality checks as a pure-Python, deterministic engine (`services/ats_checker.py`) that runs synchronously at upload time and never calls an LLM.

**Rationale**:
- Satisfies FR-027 (ATS score available during an AI outage) and FR-032 (minimize PII sent to external processing) — structural analysis never leaves the server.
- Deterministic output is unit-testable without network or model variance (Constitution II).
- PyMuPDF (`fitz`, already used by `cv_parser`) exposes the page text, text blocks, fonts, images, and link annotations needed for parseability and formatting heuristics.

**Categories and signals** (each contributes to the weighted 0–100 score):

| Category | Signal source | Confidence |
|----------|---------------|------------|
| Parseability | extracted text length per page; images-vs-text ratio (image-only/scanned ⇒ near-zero text) | High |
| Standard sections present | heading wordlist match (contact, experience, education, skills) | High |
| Non-standard heading labels (FR-010a) | heading-like lines not matching canonical synonyms | Medium |
| Contact info (FR-011) | email + phone regex over extracted text | High |
| Parse-hostile formatting (FR-012) | PyMuPDF text-block geometry (column count), table-like alignment, images, header/footer zones | Best-effort / heuristic |
| ATS-unfriendly elements (FR-012a) | non-ASCII/decorative glyphs, embedded vs non-standard fonts, link/icon annotations rendered as non-text | Medium |
| Content quality (FR-013) | action-verb wordlist, quantified-achievement regex (numbers/%/$), word & page count, sentence-length readability | Medium |
| Date consistency (FR-014) | spaCy DATE entities + regex; detect inconsistent formats and unexplained gaps | Medium |

**Honest confidence note** (guards SC-003/SC-012): wordlist, glyph/font, and contact-regex checks are reliable. Multi-column / header-footer / table detection from PDF layout is heuristic and can mis-flag; these are surfaced as "possible" issues with lower severity so the feature does not over-promise "flags every problem." SC-003/SC-012 are written against the deterministic, high-confidence checks (missing skills section, image-only content, missing contact email, non-standard headings, decorative glyphs).

**Scoring**: each category yields a 0–1 sub-score; the overall ATS score is a fixed weighted sum × 100, with weights centralized in `app/config.py` (non-secret; defaults in `.env.example`). Severity per issue ∈ {high, medium, low}; issues are returned sorted by severity then category weight (FR-016).

**Alternatives considered**:
- *LLM-scored ATS check*: rejected — violates FR-027 (outage resilience) and FR-032 (PII minimization), and is non-deterministic so hard to test.
- *Third-party ATS-parsing API*: rejected — adds an external dependency/secret and ships CV PII off-platform; out of scope per spec Assumptions.

---

## R2. Keyword coverage (JD-dependent) — AI-assisted with graceful degradation

**Decision**: When a job description is supplied in ATS Check mode, keyword/skill coverage is produced by the existing LLM path (Groq via LangChain), returned separately from the deterministic score, and degrades gracefully (marked "unavailable", run not charged) when the AI is down — per FR-017/FR-018/FR-028.

**Rationale**: The user explicitly chose "keyword coverage requires AI" during clarification (Session 2026-07-01, Q2). LLM extraction of role-relevant keywords handles synonyms/phrasing better than literal matching.

**Alternatives considered (documented rejected alternative)**:
- *Deterministic TF-IDF / keyword-overlap coverage* (reusing `rag_scorer`'s scikit-learn path): technically would serve FR-027 (resilience) and FR-032 (less PII to the LLM) better, and remains available as a future fallback. **Rejected for this iteration** because the clarified requirement designates keyword coverage as AI-dependent. Recorded here so the decision is traceable; not reopened.

---

## R3. Making the job description optional end-to-end

**Decision**: Make `cv_sessions.jd_text` nullable (migration 019) and gate every JD-assuming code path so the ATS-no-JD flow provably never reaches them.

**JD-assuming call sites to guard** (enumerated so none is missed):
- `services/rag_scorer.compute_match_score(cv_text, jd_text)` — only called when a JD is present (job-match mode, or ATS mode *with* JD for the coverage step). Not called on ATS-no-JD.
- `services/rag_scorer.store_embeddings(session_id, cv_text, jd_text)` — only called when a JD is present. ATS-no-JD skips embedding storage (no JD vector to compare).
- `routers/analysis.py` `estimated_tokens = len(cv_text + jd_text_val) // 4` and the whole `/analyze` SSE — job-match only; unchanged. ATS keyword coverage uses its own token estimate from `cv_text` (+ JD when present).
- `routers/cv.py` `match_score` population — set to `None` when no JD; `CVSessionResponse.match_score` is already `Optional`.

**Rationale**: Confines the nullable-JD blast radius to a small, listed set of call sites; the deterministic ATS engine takes only the CV/PDF.

---

## R4. Where the mode chooser ("subsections") lives

**Decision**: Add the mode chooser at the top of the existing `frontend/src/pages/Upload.tsx` (reached by the existing "Analyze CV" nav button → `page: 'upload'`). Selecting a mode reveals that mode's inputs. No new route, no new top-level nav entry — satisfies "don't make it a new section."

**Rationale**: The Analyze CV experience is already the `Upload → Results` pair in `App.tsx`. A chooser inside `Upload.tsx` is the least-invasive way to introduce subsections while preserving the existing job-match flow and the active-session/stored-CV banners.

**Mode definitions** (FR-002):
- **ATS Check** — CV required; JD optional. Produces the ATS score view.
- **Job Match Analysis** — CV + JD required. Existing flow, unchanged.

`Upload.tsx` passes the chosen `analysis_mode` (and optional `jd_text`) to the upload call; `Results.tsx` branches on the returned session's `analysis_mode` to render either the ATS view or the existing job-match stream.

---

## R5. Quota semantics for the ATS Check (resolves the create-vs-check ordering)

**Decision**: For ATS Check, enforce the quota **before** creating the `CVSession` row, using a `count >= limit` test, so a blocked or invalid attempt creates **no** row and consumes **no** future slot (FR-025 + FR-026).

**Detail / why it differs from the existing flow**: Today the quota check lives in `/analyze` and uses `count > limit` *because the CVSession was already created at upload and is included in the count* (see `token_tracker.check_free_tier_quota` comment). The ATS path is create-and-check in one synchronous request, so the equivalent correct test, applied *before* insert, is `count >= limit`. Both modes therefore mean the same thing to the user: a free user with limit = N gets exactly N successful checks.

**Acceptance test (pins the most bug-prone area)**: integration test — free user with `limit = 2` runs 2 ATS checks successfully; the 3rd is blocked with HTTP 429; an invalid-file or AI-degraded attempt does **not** consume a slot (the user can still run a valid check afterward).

**AI-degraded runs**: an ATS Check whose AI-dependent keyword/suggestion step fails still returns the deterministic score and is **not** charged (FR-028).

---

## R6. Data-leakage hardening (clarification-driven)

**Decisions**:
- **Owner-only access (FR-029)**: `GET /cv/{id}/ats` reuses `require_ownership`. The `/analyze` keyword-coverage path reuses the manual ownership + JTI-blacklist checks already in `routers/analysis.py`.
- **No public share link (FR-022)**: report/export stays an authenticated, owner-only download (`GET /cv/{id}/report`, `Content-Disposition: attachment`). No tokenized or guessable URL is added; the ATS result is added to the existing report generator output.
- **Admin aggregate-only (FR-030)**: no admin endpoint returns CV content or individual ATS results; admin keeps the existing aggregate metrics only.
- **Delete also removes the file (leakage fix)**: `DELETE /cv/{id}` currently deletes the DB row, cache, and embeddings but **leaves the uploaded PDF on disk**. Fix: also delete `uploads/<cv_filename>` (path-join + existence guard, no traversal — filename is a server-generated UUID).
- **Stored-CV deletion cascade (FR-031)**: `use_stored_cv` copies bytes to a fresh UUID file with no back-reference, so a provenance marker is required. Add `cv_sessions.from_stored_cv` (Boolean, default False) in migration 019; `profile_service.delete_stored_cv` then also deletes that user's sessions where `from_stored_cv = True` (removing their rows, files, embeddings, and derived ATS results).

**Rationale**: Each maps directly to a clarification answer; the file-on-disk fix closes a real residual-PII gap and is in scope as a leakage fix.

---

## R7. System health / dependencies

**Decision**: No new Docker services, no new external dependencies, no new secrets. The external AI (Groq) is treated as a **non-critical** dependency for the ATS Check — its outage degrades only keyword coverage and written suggestions. The existing `/health` endpoint and admin system-health view remain the health signals; `docker-compose up --build` startup path is unchanged (Constitution III).

**New config (non-secret, `.env.example` only)**: ATS scoring category weights and thresholds (e.g., `ATS_MIN_WORDS`, `ATS_MAX_PAGES`) with sane defaults, loaded via Pydantic `BaseSettings`.

---

## R8. Score recalibration so the number discriminates (US5 / FR-033–FR-035, FR-040)

**Problem observed post-MVP**: the shipped engine returns ~98–100 for almost any text CV because several checks are inert or over-permissive, so 6–7 of 8 categories return a perfect sub-score.

**Decision**: Keep the deterministic, weighted-category model (weights unchanged, sum 1.0) but make each check accurate and, where sensible, partially graded so faults actually cost points:

| Check | Current fault | Fix |
|-------|---------------|-----|
| Quantified achievements | `_QUANTIFIED_RE` ends in `\b\d{3,}\b` → any 3+ digit number (incl. years) passes | Require a real metric: `%`, currency (`$€£`), multiplier (`3x`), magnitude+unit (`10k`, `2M`), or `N+ years/users/customers/requests/…`; **exclude bare 4-digit years** |
| Contact / phone | `_PHONE_RE` matches `YYYY - YYYY` date ranges | Require a genuine phone token (≥7 digits, optional leading `+`/parens) and reject pure year-range matches |
| Standard sections | loose substring match anywhere in text | Heading-anchored: a short standalone line equal to / starting with a canonical synonym |
| Tables / multi-column | `table_like` never computed (dead); multi-column heuristic weak | Actually compute both (R-detail below) |

**Table / multi-column detection**: use PyMuPDF `page.find_tables()` when available (guarded — older builds lack it) to set `table_like`; strengthen multi-column via x-position clustering of body text blocks (two dominant left-edge bands ⇒ multi-column). Both remain **best-effort** confidence so success criteria don't over-promise (consistent with R1).

**Calibration target (SC-013/014)**: a deliberately strong vs. weak CV differ by ≥ 25 points; scores across ordinary CVs are distributed, and a near-perfect score requires zero detected weaknesses in every category. New non-secret thresholds (strictness knobs, band cutoffs) go to `config.py` + `.env.example`.

**Alternatives considered**: (a) *re-weight categories to force spread* — rejected, it masks the real cause (inaccurate checks) rather than fixing it; (b) *LLM-scored calibration* — rejected, breaks FR-027 resilience and FR-032 PII-minimization and is non-deterministic (can't unit-test the spread).

---

## R9. Enriched, actionable result (US5 / FR-036–FR-039)

**Decision**: `ats_checker.evaluate()` additionally returns three fields inside the existing `ats_result` JSON (no migration — it's already a JSON text column):

- `strengths`: list of `{category, message}` for categories scoring strongly (≥ 0.9), phrased positively — so users get specific praise even at high scores (FR-036/039).
- `next_steps`: the top-N (≈3) highest-impact recommendations, deduped from `issues` and ranked by severity × category weight, phrased as imperative actions — distinct from the full issue list (FR-037).
- `score_explanation`: a short plain-language string stating the score band and the biggest up/down drivers (FR-038).

When there are no material weaknesses, `next_steps` becomes a brief "your CV is ATS-ready" affirmation and `strengths` carries the justification (FR-039) — the result is never empty.

**Surfacing**: `AtsResultView.tsx` gains a Strengths section, a "What to do next" section, and the explanation near the gauge. `AtsResultResponse` (backend) and `AtsResult` (frontend) gain the three fields as additive, optional/defaulted properties — backward compatible with results stored before this change (they simply lack the fields).

**Alternatives considered**: *AI-generated narrative feedback* — rejected for the core path (resilience/PII/determinism, per R1); the AI-assisted written suggestions remain the JD-dependent US3 feature that degrades gracefully.

---

## Summary of decisions

| # | Decision |
|---|----------|
| R1 | Deterministic, LLM-free ATS engine in `services/ats_checker.py`; weighted 0–100 + severity-ranked issues |
| R2 | Keyword coverage stays AI-assisted with graceful degradation (per clarification); TF-IDF fallback recorded as rejected alternative |
| R3 | `jd_text` nullable; JD-assuming call sites enumerated and guarded |
| R4 | Mode chooser inside `Upload.tsx`; `Results.tsx` branches on `analysis_mode` |
| R5 | ATS quota checked before row insert (`>= limit`); blocked/invalid/degraded runs never consume a slot; pinned by integration test |
| R6 | Owner-only access, no share links, admin aggregate-only, delete removes file, `from_stored_cv` enables FR-031 cascade |
| R7 | No new services/secrets; Groq is a non-critical dependency; ATS weights in config |
| R8 | Recalibrate: accurate quantified/contact/section detection, real table/column checks, graded sub-scores; strong-vs-weak spread ≥25pts; no migration |
| R9 | Enrich `ats_result` with strengths, next_steps, score_explanation (additive JSON fields); surfaced in `AtsResultView` |
