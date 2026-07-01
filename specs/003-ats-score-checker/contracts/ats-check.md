# API Contract: ATS Score Checker

**Feature**: `003-ats-score-checker` | **Date**: 2026-07-01

All endpoints are authenticated (Bearer JWT) and owner-scoped unless noted. Errors return structured JSON (`{"detail": ...}`) per Constitution V. New/changed endpoints live in `routers/cv.py`; the job-match SSE in `routers/analysis.py` is unchanged.

---

## 1. `POST /cv/upload` (modified)

Multipart form. Now mode-aware; `jd_text` optional for ATS Check.

**Form fields**
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `cv_file` | file (PDF) | yes | ≤ 10 MB, `%PDF` magic-byte check (unchanged) |
| `analysis_mode` | string | no (default `job_match`) | `job_match` \| `ats_check` |
| `jd_text` | string | conditional | required iff `analysis_mode = job_match`; optional for `ats_check` |

**Behavior**
- `job_match`: unchanged — requires `jd_text`, computes `match_score`, stores embeddings.
- `ats_check`: **quota checked before row insert** (`count >= limit` ⇒ `429`, no row created); creates session with `analysis_mode='ats_check'`; runs deterministic `ats_checker`; if `jd_text` present, also computes `match_score` + attempts AI keyword coverage.

**Responses**
- `200 CVUploadResponse`: `{ session_id, cv_filename, analysis_mode, match_score?: float|null, ats_score?: float|null, skills_found, is_linkedin }`
- `413` file too large · `422` not a PDF / `jd_text` missing for `job_match` · `429` quota exceeded (`{code, message, window_resets_at, analyses_used, limit}`)

---

## 2. `POST /cv/use-stored` (modified)

JSON body. Uses the caller's stored CV; sets `from_stored_cv = true`.

**Body**: `{ "analysis_mode": "ats_check"|"job_match" (default job_match), "jd_text": string|null }`
- `job_match` ⇒ `jd_text` required. `ats_check` ⇒ `jd_text` optional.

**Responses**: same as `/cv/upload`. `400` when no stored CV exists / file missing.

---

## 3. `GET /cv/{session_id}/ats` (new)

Returns the stored ATS result for a session. Owner-only (`require_ownership`).

**Responses**
- `200 AtsResultResponse`:
  ```jsonc
  {
    "session_id": 123,
    "overall_score": 0,
    "ai_sections_available": true,
    "categories": [ { "key": "...", "label": "...", "score": 0.0, "weight": 0.0, "ai_dependent": false, "confidence": "high" } ],
    "issues":     [ { "category": "...", "severity": "high|medium|low", "message": "...", "recommendation": "..." } ],
    "keyword_coverage": { "matched": [], "missing": [], "available": true } | null,
    "strengths":   [ { "category": "...", "message": "..." } ],   // US5 (FR-036)
    "next_steps":  [ "..." ],                                     // US5 (FR-037), top-N actions
    "score_explanation": "..."                                    // US5 (FR-038), plain-language
  }
  ```
  US5 fields are additive/optional — results stored before US5 omit them (server defaults to empty/None).
- `202 {status:"pending"}` if the session exists but the ATS result is not yet computed (parity with `/cv/{id}/analysis`).
- `404` not found · `403` not your session.

---

## 4. Keyword coverage — computed synchronously at upload (implemented) + streaming SSE (deferred)

**As implemented (US3)**: keyword coverage is computed **synchronously during `/cv/upload` (and `/cv/use-stored`)** when an `ats_check` request includes a JD. `services/ats_keywords.compute_keyword_coverage(cv_text, jd)` makes one bounded LLM call (hard timeout `ATS_KEYWORD_TIMEOUT_SECONDS`, default 20s), and the result is merged into `ats_result.keyword_coverage` and read back via **`GET /cv/{id}/ats`** (section 3). This satisfies FR-017/018/019 (matched/missing keywords) and FR-028 (degrades to `keyword_coverage.available=false`, deterministic score intact, run **not** charged) without putting an SSE lifecycle on the critical path.

**Degradation (FR-028)**: on AI error/timeout, `keyword_coverage.available=false` and `ai_sections_available=false`; the deterministic categories/issues/score are unaffected; no `ats_keyword_coverage` token row is logged (not charged). A successful call logs one token row.

**Deferred — `GET /analyze/ats-keywords` (SSE)**: streaming *written qualitative suggestions* was scoped out (tasks T026/T029 deferred). It is **gold-plating beyond the matched/missing keyword requirement** — the FRs are met by the synchronous path above. It touches `analysis.py` + `Results.tsx` and can be added later without changing the stored `ats_result` shape.

---

## 5. `GET /cv/{session_id}/report` (modified)

Unchanged contract (authenticated owner-only PDF download, `Content-Disposition: attachment` — **no public/shareable URL**, FR-022). For `ats_check` sessions the generated report now includes the ATS score, category breakdown, issues/recommendations, and keyword coverage (when present).

---

## 6. `DELETE /cv/{session_id}` (modified — leakage fix)

Unchanged contract (`204`). Behavior change: in addition to deleting the row, cached score, and embeddings, it now **deletes the uploaded PDF file** `uploads/<cv_filename>` from disk (existence-guarded; filename is a server-generated UUID, no traversal risk). Removing an `ats_check` session removes its `ats_result` (same row). FR-029/FR-031, leakage.

---

## 7. `DELETE /profile/cv` (modified — FR-031 cascade)

Existing stored-CV delete. Behavior change: also deletes the caller's `cv_sessions` where `from_stored_cv = true` (and their files/embeddings/ATS results), so deleting a stored CV removes its derived ATS results.

---

## Unchanged

- `GET /analyze` (job-match SSE), `GET /cv/{id}/analysis`, `GET /cv/sessions`, `GET /cv/{id}/detail`, `GET /cv/{id}/score`, `PATCH /cv/{id}/save-questions` — unchanged except `GET /cv/sessions` now returns `analysis_mode`, `ats_score`, `has_ats_result` per session (FR-021).
- Admin endpoints — unchanged; aggregate-only, no CV content or individual ATS results (FR-030).
