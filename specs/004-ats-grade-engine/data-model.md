# Phase 1 Data Model: ATS-Grade Engine Upgrade

**Feature**: `004-ats-grade-engine` | **Date**: 2026-07-03

**No database migration.** Everything new rides inside the existing `cv_sessions.ats_result` JSON text column (added in migration 019) or is a new upload request field. Historical results remain valid — they simply lack the new keys, and the API defaults them.

---

## Data files (new, non-secret — bundled in the image)

- `Backend/data/vocab/action_verbs.txt` — broad, multi-industry action verbs (one per line). *(US5)*
- `Backend/data/vocab/skills.json` — multi-industry skill terms, optionally grouped by domain. *(US5)*
- `Backend/data/vocab/keyword_synonyms.json` — map of canonical term → synonyms/abbreviations (e.g. `"kubernetes": ["k8s"]`, `"registered nurse": ["rn"]`). *(US3/US5)*
- `Backend/data/ats_calibration/labels.json` — `{ "<filename>": {"label": "friendly|problematic", "notes": "..."} }`. *(US4)*
- `Backend/data/ats_calibration/labeled/` — the expert-rated sample CVs referenced by `labels.json`. *(US4, evaluation-only, never served to users)*

---

## New value object: `ParsedResumeRecord` (embedded in `ats_result`, US2)

Deterministic, no-LLM extraction of what an ATS reads. JSON shape:

```jsonc
{
  "contact": {
    "name": "string|null", "email": "string|null", "phone": "string|null",
    "links": ["string"], "confidence": 0.0
  },
  "experience": [
    { "role": "string|null", "employer": "string|null",
      "start": "string|null", "end": "string|null",
      "confidence": 0.0, "gaps": ["missing_dates"|"missing_employer"|...] }
  ],
  "education": [
    { "institution": "string|null", "qualification": "string|null",
      "year": "string|null", "confidence": 0.0 }
  ],
  "skills": ["string"],
  "overall_parse_confidence": 0.0,   // feeds the parseability category (FR-008)
  "unextractable": ["skills_block_unreadable"|"experience_dates_missing"|...]
}
```

**Rules**: fully deterministic; produced without external AI (FR-009). Each entry carries a confidence and explicit gap flags so the UI can show "partially parsed" warnings (FR-007). `overall_parse_confidence` is a required input to the parseability sub-score.

---

## Extended value object: `ats_result` JSON (additive to spec 003)

Existing keys (003 + US5 enrichment) retained: `overall_score`, `generated_at`, `ai_sections_available`, `categories[]`, `issues[]`, `keyword_coverage`, `strengths[]`, `next_steps[]`, `score_explanation`. **Added for 004:**

```jsonc
{
  // ... existing 003 keys ...
  "parsed_record": { /* ParsedResumeRecord above */ },   // US2
  "target_role": "string|null",                          // US6/FR-028 (the profile used)
  "keyword_coverage": {
    "matched": [], "missing": [], "available": true,
    "source": "ai|deterministic"                         // US3/FR-011
  },
  "categories": [
    { "key": "...", "label": "...", "score": 0.0, "weight": 0.0,
      "point_impact": 0.0,                               // US6/FR-025 (points this category cost)
      "sub_checks": [                                    // US6/FR-027 (drill-down)
        { "name": "string", "passed": true, "detail": "string" }
      ],
      "ai_dependent": false, "confidence": "high|medium|best_effort" }
  ],
  "issues": [
    { "category": "...", "severity": "high|medium|low",
      "message": "...", "recommendation": "...",
      "point_impact": 0.0,                               // US6/FR-025
      "example": { "before": "string", "after": "string" } }  // US6/FR-026 (illustrative template)
  ],
  "changed_since_previous": {                            // US6/FR-030 (best-effort; null if no prior)
    "previous_score": 0.0, "delta": 0.0, "resolved_issues": ["string"]
  }
}
```

**Rules**:
- **Category `point_impact` is exact and reconciling**: the sum of category impacts explains `100 − overall_score` (this is the explainability guarantee, FR-031). A category's impact = `weight × (1 − sub_score) × 100`.
- **Per-issue `point_impact` is an *indicative apportionment*, not an exact figure**: a category's deduction is not a clean sum of its N issues, so an issue's impact is derived by apportioning its category's deduction across that category's issues (weighted by severity) and is displayed accordingly (e.g. "up to −X" / "≈ −X"). It MUST NOT be presented as an exact, independently-additive number — the exact, reconciling figures are at the category level.
- `example` is a static, per-issue-type template — illustrative, never fabricating the user's actual content (FR-026).
- `keyword_coverage.source` records which path produced it; `available` is true if either the AI or deterministic path succeeded (FR-011).
- `target_role` records the profile the analysis ran against; `null`/default when unset (FR-028).
- `changed_since_previous` is populated only when the user has a prior ATS session to diff against; otherwise `null`.
- All fields are **additive** — pre-004 results omit them and the API/UI treat them as absent.

---

## Request/response schema changes (`models/schemas.py`)

- **Upload requests** (`/cv/upload`, `/cv/use-stored`): add optional `target_role: Optional[str]` alongside `analysis_mode`/`jd_text`. Accepted file types extended to include `.docx`.
- **`AtsResultResponse`**: add `parsed_record`, `target_role`, `changed_since_previous`; extend the category schema with `point_impact` + `sub_checks`, the issue schema with `point_impact` + `example`, and `keyword_coverage` with `source`. All additive/optional so historical results deserialize cleanly.
- **`CVUploadResponse`**: unchanged shape (already carries `analysis_mode`, `ats_score`).

---

## Unchanged / non-regression

- `cv_sessions` columns unchanged (migration head stays **019**). `analysis_mode`, `ats_score`, `ats_result`, `from_stored_cv` reused as-is.
- Ownership, deletion (file + stored-CV cascade), admin-aggregate-only, and export (owner-only attachment) all unchanged (FR-022).
- Pre-004 `ats_result` payloads remain viewable (FR-023).
