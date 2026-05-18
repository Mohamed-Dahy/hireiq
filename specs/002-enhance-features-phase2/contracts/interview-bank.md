# API Contract: Interview Question Bank

Base path: `/interview-bank`

All progress endpoints require `Authorization: Bearer <access_token>`. Question listing endpoints are public.

---

## GET /interview-bank/roles

Returns all roles that have questions in the bank.

**Response 200**:
```json
{
  "roles": ["Backend Engineer", "Data Scientist", "Product Manager", "..."]
}
```

---

## GET /interview-bank/questions

Returns questions for a role + level, grouped by category.

**Query parameters**:
- `role` (required): must match a value from `/interview-bank/roles`
- `level` (required): `junior` | `mid` | `senior` | `all`

**Example**: `GET /interview-bank/questions?role=Backend+Engineer&level=mid`

**Response 200**:
```json
{
  "role": "Backend Engineer",
  "level": "mid",
  "total_questions": 45,
  "categories": {
    "technical": [
      {
        "id": 1,
        "question_text": "Explain the difference between SQL and NoSQL databases.",
        "model_answer": "SQL databases use structured schemas...",
        "practiced": false
      }
    ],
    "behavioral": [...],
    "system_design": [...],
    "culture_fit": [...]
  }
}
```

**Notes**: When the request includes a valid `Authorization` header, `practiced` is populated from `user_question_progress`. For unauthenticated requests, `practiced` is always `false`.

---

## GET /interview-bank/search

Full-text search across all questions.

**Query parameters**:
- `q` (required): search term, min 2 characters
- `role` (optional): filter by role
- `level` (optional): filter by level

**Response 200**:
```json
{
  "query": "API design",
  "results": [
    {
      "id": 12,
      "role": "Backend Engineer",
      "level": "mid",
      "category": "technical",
      "question_text": "How would you design a RESTful API for a social media platform?",
      "model_answer": "...",
      "practiced": false
    }
  ],
  "total": 7
}
```

**Performance target**: Results returned in < 500ms (PostgreSQL `ILIKE` on indexed text column, or `tsvector` full-text index).

---

## POST /interview-bank/progress (auth required)

Marks a question as practiced (or toggles it off if already marked).

**Request**:
```json
{ "question_id": 12, "practiced": true }
```

**Response 200**:
```json
{ "question_id": 12, "practiced": true, "practiced_at": "2026-05-14T10:30:00Z" }
```

---

## GET /interview-bank/progress (auth required)

Returns readiness summary for a user across role + level.

**Query parameters**:
- `role` (required)
- `level` (required)

**Response 200**:
```json
{
  "role": "Backend Engineer",
  "level": "mid",
  "overall_readiness_pct": 42,
  "by_category": {
    "technical":     { "practiced": 8,  "total": 20, "pct": 40 },
    "behavioral":    { "practiced": 5,  "total": 10, "pct": 50 },
    "system_design": { "practiced": 2,  "total": 10, "pct": 20 },
    "culture_fit":   { "practiced": 4,  "total": 5,  "pct": 80 }
  }
}
```
