# CV API Contracts (Extended)

Base path: `/cv`
Existing endpoints unchanged. New and extended endpoints below.

---

## POST /cv/upload (extended)

Unchanged signature. Now also accepts LinkedIn PDF exports.
The backend detects whether the uploaded PDF is a LinkedIn export
(checks for "LinkedIn" in the first page) and applies the LinkedIn
parser path if detected.

**Gating**: Uploading a LinkedIn PDF requires the `linkedin-import` entitlement.
Regular CV uploads require `cv-upload` entitlement.

**New response fields**:
```json
{
  "session_id": 42,
  "match_score": 87.5,
  "is_linkedin_import": false
}
```

---

## GET /cv/{id}/analysis

Return the full enhanced analysis for a session (requires `enhanced-analysis` entitlement).

**Auth**: Bearer token required
**Feature gate**: `enhanced-analysis` (402 if not entitled)

**Response `200`**:
```json
{
  "session_id": 42,
  "skill_inventory": {
    "hard": [
      { "skill": "Python", "level": "expert", "years": 5 },
      { "skill": "FastAPI", "level": "proficient", "years": 2 }
    ],
    "soft": [
      { "skill": "Communication", "level": "demonstrated" }
    ]
  },
  "gap_report": [
    {
      "skill": "Kubernetes",
      "importance": "critical",
      "reason": "Required in 90% of similar job postings",
      "resources": ["https://kubernetes.io/docs", "Linux Foundation CKA course"]
    }
  ],
  "study_roadmap": [
    {
      "topic": "Kubernetes fundamentals",
      "priority": 1,
      "estimated_hours": 20,
      "resources": ["Kubernetes.io interactive tutorial"]
    }
  ]
}
```

**Response `404`**: Session not found or not owned by current user
**Response `202`**: Analysis still in progress (retry after 5 seconds)

---

## GET /analyze (extended SSE stream)

Existing endpoint. Now streams richer structured output when the user
has `enhanced-analysis` entitlement. Free-tier users receive the existing
basic stream (skills gap summary + 5 questions only).

**Event types added for premium**:
- `event: skill_inventory` — JSON skills object
- `event: gap_report` — JSON array of gaps
- `event: study_roadmap` — JSON array of roadmap items
- `event: questions` — existing question stream (all tiers)
