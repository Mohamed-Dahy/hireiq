# Jobs (ATS Tracker) API Contracts

Base path: `/jobs`
All endpoints require Bearer token + `job-tracker` feature entitlement.
Unauthenticated or free-tier requests receive `402`.

---

## GET /jobs

List all job applications for the current user.

**Query params**: `status` (optional filter), `page` (default 1), `per_page` (default 20)

**Response `200`**:
```json
{
  "total": 12,
  "page": 1,
  "items": [
    {
      "id": 1,
      "job_title": "Senior Python Engineer",
      "company": "Acme Corp",
      "job_url": "https://example.com/job",
      "status": "interview",
      "match_score": 87.5,
      "applied_at": "2026-05-09T10:00:00Z",
      "created_at": "2026-05-08T09:00:00Z"
    }
  ]
}
```

---

## POST /jobs

Create a new job application.

**Request**:
```json
{
  "job_title": "Senior Python Engineer",
  "company": "Acme Corp",
  "job_url": "https://example.com/job",
  "status": "saved",
  "session_id": 42,
  "notes": "Referral from Ahmed"
}
```

**Validation**: `status` MUST be one of `saved | applied | screening | interview | offer | rejected`

**Response `201`**: Full job application object

---

## PATCH /jobs/{id}

Update a job application (status, notes, applied_at).

**Request** (partial):
```json
{
  "status": "interview",
  "notes": "First round scheduled for 2026-05-15"
}
```

**Response `200`**: Updated job application object
**Response `404`**: Job not found or not owned by current user

---

## DELETE /jobs/{id}

Delete a job application.

**Response `204`**: No content
**Response `404`**: Not found or not owned

---

## GET /jobs/stats

Return aggregate statistics for the current user's job tracker.

**Response `200`**:
```json
{
  "total": 12,
  "by_status": {
    "saved": 3,
    "applied": 4,
    "screening": 2,
    "interview": 2,
    "offer": 1,
    "rejected": 0
  },
  "avg_match_score": 76.4
}
```
