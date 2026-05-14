# API Contract: Salary Benchmark Explorer

Base path: `/salary`

Public endpoints (no auth required for queries). Admin endpoints require auth + `is_admin = true`.

---

## GET /salary/roles

Returns all distinct roles available in the salary dataset.

**Response 200**:
```json
{
  "roles": [
    "Backend Engineer",
    "Data Scientist",
    "DevOps/SRE",
    "Frontend Engineer",
    "...up to all seeded roles"
  ]
}
```

---

## GET /salary/countries

Returns all distinct countries/regions available.

**Response 200**:
```json
{
  "countries": ["Egypt", "UAE", "Saudi Arabia", "USA (remote)", "United Kingdom (remote)"]
}
```

---

## GET /salary/query

Query salary range for a role + level + country combination.

**Query parameters**:
- `role` (required): must match a value from `/salary/roles`
- `level` (required): `junior` | `mid` | `senior` | `staff`
- `country` (required): must match a value from `/salary/countries`

**Example**: `GET /salary/query?role=Backend+Engineer&level=mid&country=Egypt`

**Response 200**:
```json
{
  "role": "Backend Engineer",
  "level": "mid",
  "country": "Egypt",
  "currency": "EGP",
  "min_salary": 25000,
  "median_salary": 40000,
  "max_salary": 60000,
  "usd_min": 500,
  "usd_max": 1200,
  "confidence": "high",
  "last_updated_at": "2026-05-14T00:00:00Z",
  "source": "manual_2026"
}
```

**Response 404 — no data**:
```json
{ "detail": "No salary data available for this role/level/country combination." }
```

**Response 422** — invalid `level` value.

**Notes**: Query parameters are reflected in the browser URL by the frontend (no server-side redirect needed).

---

## POST /salary/refresh (admin only)

Triggers the AI-assisted salary data refresh job. Runs synchronously for admin; may take 30–120 seconds.

**Auth**: Requires `is_admin = true`.

**Request**: (no body)

**Response 200**:
```json
{
  "message": "Salary data refresh complete.",
  "updated": 12,
  "unchanged": 88,
  "errors": 0
}
```

**Response 403**:
```json
{ "detail": "Admin access required." }
```
