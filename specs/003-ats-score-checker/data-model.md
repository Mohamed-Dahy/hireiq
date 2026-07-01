# Phase 1 Data Model: ATS Score Checker

**Feature**: `003-ats-score-checker` | **Date**: 2026-07-01

The feature extends the existing `cv_sessions` table rather than introducing a new table, so ATS results and job-match results live in one unified history (spec: "Analysis Session extends the existing CV analysis session"). Migration head is `018`; this feature adds **migration `019_ats_check.py`**.

---

## Modified entity: `CVSession` (`cv_sessions`)

Existing columns (unchanged): `id`, `user_id`, `cv_filename`, `match_score`, `created_at`, `skill_inventory`, `gap_report`, `study_roadmap`, `is_linkedin`, `ai_interview_questions`, `original_cv_filename`.

### Column changes (migration 019)

| Column | Change | Type / default | Reason (FR) |
|--------|--------|----------------|-------------|
| `jd_text` | **Alter** `NOT NULL` → nullable | `Text`, nullable | FR-007 — ATS Check runs with no JD |
| `analysis_mode` | **Add** | `String(20)`, NOT NULL, server_default `'job_match'` | FR-002, FR-021 — distinguish modes in history |
| `ats_score` | **Add** | `Float`, nullable | FR-008 — overall 0–100 ATS score (distinct from `match_score`) |
| `ats_result` | **Add** | `Text` (JSON), nullable | FR-008/FR-015/FR-017/FR-020 — full ATS result payload |
| `from_stored_cv` | **Add** | `Boolean`, NOT NULL, server_default `false` | FR-031 — provenance for stored-CV deletion cascade |

**Backfill**: existing rows get `analysis_mode = 'job_match'` via the server default — they already have a non-null `jd_text` and a `match_score`, so they remain valid job-match sessions (FR-024). Downgrade drops the four added columns and restores `jd_text NOT NULL` (safe only if no null `jd_text` rows exist; documented in the migration).

### Validation / invariants

- `analysis_mode ∈ {'job_match', 'ats_check'}` (enforced in the Pydantic request schema, not a DB enum, to match existing project style).
- `analysis_mode = 'job_match'` ⇒ `jd_text` required (non-empty); `match_score` set; `ats_score`/`ats_result` null.
- `analysis_mode = 'ats_check'` ⇒ `jd_text` optional; `ats_score` + `ats_result` set; `match_score` set **only if** a JD was supplied (keyword-coverage step), else null.
- `ats_score ∈ [0, 100]`.

### New computed property

- `has_ats_result -> bool` (mirrors `has_gap_report`) — true when `ats_result` is populated; used by history responses.

---

## Embedded value object: `ats_result` (JSON, not a table)

Stored as JSON text in `cv_sessions.ats_result`. Shape:

```jsonc
{
  "overall_score": 0,            // 0-100, == ats_score (denormalized for export convenience)
  "generated_at": "ISO-8601",
  "ai_sections_available": true, // false when AI-dependent parts were skipped/degraded (FR-028)
  "categories": [
    {
      "key": "parseability|sections|headings|contact|formatting|unfriendly_elements|content_quality|dates|keyword_coverage",
      "label": "string",
      "score": 0.0,              // 0-1 sub-score
      "weight": 0.0,             // contribution weight
      "ai_dependent": false,     // true only for keyword_coverage
      "confidence": "high|medium|best_effort"
    }
  ],
  "issues": [                    // ordered by severity then category weight (FR-016)
    {
      "category": "string",
      "severity": "high|medium|low",
      "message": "string",       // what is wrong
      "recommendation": "string" // how to fix (FR-015)
    }
  ],
  "keyword_coverage": {          // present ONLY when a JD was supplied (FR-017/FR-019); null otherwise
    "matched": ["string"],
    "missing": ["string"],
    "available": true            // false if AI was unavailable (FR-028)
  },

  // US5 (FR-036–FR-039) — additive; older results simply lack these fields
  "strengths": [                 // categories the CV handles well (score ≥ 0.9)
    { "category": "string", "message": "string" }
  ],
  "next_steps": ["string"],      // top-N highest-impact actions (deduped from issues, ranked severity×weight)
  "score_explanation": "string"  // plain-language: score band + main up/down drivers
}
```

**Rules**:
- `keyword_coverage` is `null` when no (or empty/meaningless) JD was supplied (FR-019).
- When the AI-dependent step fails, `ai_sections_available = false`, `keyword_coverage.available = false`, and any written suggestions are omitted — the deterministic `categories`/`issues`/`overall_score` are still fully populated (FR-027/FR-028).
- `strengths`/`next_steps`/`score_explanation` are always populated for new results (US5); when no material weaknesses exist, `next_steps` is a brief "ATS-ready" affirmation and `strengths` carries the justification (FR-039). These are **additive JSON fields — no migration** (the `ats_result` column is already JSON text); results stored before US5 simply omit them and the API defaults them.

---

## Unchanged related entities

- **InterviewResult** — unchanged; still linked to `CVSession` for job-match interview practice.
- **UserProfile** — unchanged shape; behavior change only: `delete_stored_cv` now cascades to delete the user's `from_stored_cv = True` sessions (FR-031).
- **TokenUsageLog** — unchanged; ATS keyword-coverage usage logs with `operation_type = "ats_keyword_coverage"` (deterministic ATS scoring logs nothing, as it uses no tokens).

---

## Response schema additions (`models/schemas.py`)

- **`CVSessionResponse`** — add `analysis_mode: str` and `ats_score: Optional[float]` and `has_ats_result: bool` so history can distinguish and display ATS vs job-match results (FR-021).
- **`CVUploadResponse`** — `match_score` becomes `Optional[float]`; add `analysis_mode: str` and `ats_score: Optional[float]`.
- **New `AtsResultResponse`** — typed mirror of the `ats_result` JSON (categories, issues, keyword_coverage) returned by `GET /cv/{id}/ats`. **US5**: add `strengths: list[{category,message}]`, `next_steps: list[str]`, `score_explanation: Optional[str]` — all additive/defaulted so pre-US5 results deserialize cleanly. Frontend `AtsResult` gains the mirror fields.
- **New `AtsCheckRequest` fields** are carried on the existing multipart upload form (`analysis_mode`, optional `jd_text`); `use-stored` gains `analysis_mode` + optional `jd_text` in its JSON body.

---

## State / lifecycle

```
upload (mode chosen)
  ├─ job_match: JD required → match_score computed → /analyze SSE (unchanged)
  └─ ats_check:
        quota check (before insert, >= limit) ──fail──> 429, no row created
        │ pass
        ▼
        create CVSession(analysis_mode='ats_check', jd_text=optional)
        run deterministic ats_checker → ats_score, ats_result persisted   [always succeeds]
        if JD present: AI keyword-coverage + suggestions
              ├─ success → merge into ats_result, log tokens
              └─ failure → ai_sections_available=false (not charged)      [FR-028]

delete CVSession  → row + uploaded PDF file + cache + embeddings removed   [leakage fix]
delete stored CV  → also deletes from_stored_cv sessions (cascade)         [FR-031]
```
