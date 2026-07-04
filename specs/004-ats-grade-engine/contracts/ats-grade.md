# API Contract: ATS-Grade Engine Upgrade

**Feature**: `004-ats-grade-engine` | **Date**: 2026-07-03

Extends the spec-003 ATS endpoints. All endpoints stay authenticated + owner-scoped; errors return structured JSON. **No new endpoints and no migration** — changes are additive fields on existing routes plus `.docx` acceptance. The AI-assisted keyword path and all 003 guarantees are unchanged.

---

## 1. `POST /cv/upload` (modified)

Multipart form.

**New / changed fields**
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `cv_file` | file | yes | Now accepts **PDF or `.docx`**. Enforced by magic-byte + package check; legacy `.doc`/`.rtf`/`.txt`/images rejected with `422` listing accepted formats, **before** quota (FR-001/002). |
| `analysis_mode` | string | no (default `job_match`) | unchanged |
| `jd_text` | string | conditional | unchanged (required for `job_match`) |
| `target_role` | string | no | Optional role/industry profile that tailors relevant skills/keywords/checks + weights; sensible default when unset (FR-028). |

**Behavior**: for `ats_check`, runs the deterministic engine on PDF **or** docx (unified loader), builds the `ParsedResumeRecord`, applies the `target_role` profile, computes the richer result (point impacts, examples, sub-checks), and — when a JD is present — keyword coverage via AI (primary) or the deterministic fallback.

**Responses**: `200 CVUploadResponse` (unchanged shape) · `413` too large · `422` unsupported/unreadable format or missing `jd_text` for job_match · `429` quota.

---

## 2. `POST /cv/use-stored` (modified)

Same additions as `/cv/upload`: accepts `target_role`; the stored CV may be PDF or docx. Behavior/quota/cascade unchanged.

---

## 3. `GET /cv/{session_id}/ats` (modified — richer payload)

Owner-only. Returns `AtsResultResponse` extended with US2/US6 fields:

```jsonc
{
  "session_id": 123,
  "overall_score": 0,
  "ai_sections_available": true,
  "target_role": "Registered Nurse" | null,
  "categories": [
    { "key": "...", "label": "...", "score": 0.0, "weight": 0.0,
      "point_impact": 0.0,
      "sub_checks": [ { "name": "...", "passed": true, "detail": "..." } ],
      "ai_dependent": false, "confidence": "high|medium|best_effort" }
  ],
  "issues": [
    { "category": "...", "severity": "high|medium|low", "message": "...",
      "recommendation": "...", "point_impact": 0.0,
      "example": { "before": "...", "after": "..." } }
  ],
  "keyword_coverage": { "matched": [], "missing": [], "available": true, "source": "ai|deterministic" } | null,
  "strengths": [ { "category": "...", "message": "..." } ],
  "next_steps": [ "..." ],
  "score_explanation": "...",
  "parsed_record": { "contact": {...}, "experience": [...], "education": [...], "skills": [...],
                     "overall_parse_confidence": 0.0, "unextractable": [...] },
  "changed_since_previous": { "previous_score": 0.0, "delta": 0.0, "resolved_issues": [...] } | null
}
```

- `202 {status:"pending"}` if not yet computed · `404`/owner-mismatch as in 003.
- All new fields are additive; results stored before 004 omit them (client treats absent as empty/null).

**Depth toggle (FR-029)** is a **client-side** concern: the payload always carries the full detail; the UI renders a concise summary or the full report from it — no separate request.

---

## 4. `GET /cv/{session_id}/report` (modified)

The owner-only ATS PDF (from spec 003, `generate_ats_report`) additionally includes the parsed-record summary and (in detailed form) the point impacts + examples. Still an authenticated attachment — **no public/shareable URL** (FR-022).

---

## 5. Internal contract — score validation harness (US4 / FR-016)

Not an HTTP endpoint. `scripts/validate_ats_scoring.py`:
- **Input**: `Backend/data/ats_calibration/labels.json` + `labeled/` CVs.
- **Output**: prints mean-score gap between friendly/problematic groups and pairwise ranking accuracy; **exits non-zero** if below the SC-005 targets (so it can gate CI / releases).
- Ground truth = expert rating; used for evaluation only, never served to end users.

---

## Unchanged

- `GET /analyze` (job-match SSE), `/cv/sessions`, `/cv/{id}/detail`, `DELETE /cv/{id}` (+ file removal), `DELETE /profile/cv` (+ stored-CV cascade), all admin endpoints (aggregate-only) — behavior unchanged; `/cv/sessions` continues to expose `analysis_mode`/`ats_score`/`has_ats_result`.
