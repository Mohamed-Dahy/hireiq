# Recruiter Dashboard API Contracts

Base path: `/recruiter`
All endpoints require Bearer token + `recruiter-dashboard` feature entitlement.
Unauthenticated or non-Recruiter-tier requests receive `402`.

---

## GET /recruiter/lists

List all recruiter candidate lists owned by the current user.

**Response `200`**:
```json
[
  {
    "id": 1,
    "name": "Backend Engineers — May 2026",
    "job_title": "Senior Backend Engineer",
    "candidate_count": 5,
    "created_at": "2026-05-01T00:00:00Z"
  }
]
```

---

## POST /recruiter/lists

Create a new candidate list.

**Request**:
```json
{
  "name": "Backend Engineers — May 2026",
  "job_title": "Senior Backend Engineer"
}
```

**Response `201`**: Full list object with `id`
**Validation**: `name` max 100 chars; required

---

## DELETE /recruiter/lists/{id}

Delete a candidate list and all its candidate entries.

**Response `204`**: No content
**Response `404`**: List not found or not owned

---

## GET /recruiter/lists/{id}/candidates

List all candidates in a recruiter list, sorted by match_score descending.

**Response `200`**:
```json
{
  "list_id": 1,
  "list_name": "Backend Engineers — May 2026",
  "candidates": [
    {
      "id": 10,
      "rank": 1,
      "cv_filename": "ahmed_cv.pdf",
      "match_score": 91.2,
      "skill_inventory": { "hard": ["Python", "FastAPI", "PostgreSQL"], "soft": ["Leadership"] },
      "session_id": 55,
      "created_at": "2026-05-10T09:00:00Z"
    }
  ]
}
```

---

## POST /recruiter/lists/{id}/candidates

Add a CV session to a recruiter list.

**Request**:
```json
{ "session_id": 55 }
```

**Validation**:
- `session_id` MUST exist and be owned by the current user
- The session MUST have a `match_score` (analysis must have been run)
- Max 20 candidates per list (Recruiter plan limit)

**Response `201`**: Created candidate entry
**Response `409`**: Candidate already in this list
**Response `422`**: Limit exceeded

---

## DELETE /recruiter/lists/{id}/candidates/{candidate_id}

Remove a candidate from a list.

**Response `204`**: No content

---

## PATCH /recruiter/lists/{id}/candidates/{candidate_id}

Update the manual rank override for a candidate.

**Request**:
```json
{ "rank": 2 }
```

**Response `200`**: Updated candidate entry

---

## GET /recruiter/lists/{id}/export

Export the candidate list as a PDF report.

**Response `200`**: `application/pdf` download
Content: Ranked table of candidates with scores, top skills, gap highlights.

**Feature gate**: Requires `recruiter-dashboard` entitlement.
