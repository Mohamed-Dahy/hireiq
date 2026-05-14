# API Contract: Token & Quota Management

## Quota Enforcement (all users)

The existing `POST /cv/upload` and `GET /analyze` endpoints are modified to enforce tier quotas.

### Modified: GET /analyze (quota check added)

Before streaming begins, the backend checks the user's tier quota:

**Free tier — quota exceeded response** (HTTP 429):
```json
{
  "detail": "You've used your 2 free analyses for this period.",
  "quota_type": "free_tier_analyses",
  "used": 2,
  "limit": 2,
  "resets_at": "2026-05-24T10:00:00Z"
}
```

**Paid tier — token quota exceeded response** (HTTP 429):
```json
{
  "detail": "Daily AI token limit reached. Resets at midnight UTC.",
  "quota_type": "paid_tier_tokens",
  "used": 10000,
  "limit": 10000,
  "resets_at": "2026-05-15T00:00:00Z"
}
```

---

## Admin Endpoints

All require `Authorization: Bearer <token>` with `is_admin = true`.

Base path: `/admin`

### GET /admin/tokens/summary

**Response 200**:
```json
{
  "date": "2026-05-14",
  "total_tokens_today": 48200,
  "total_analyses_today": 34,
  "free_tier_users_active": 18,
  "paid_tier_users_active": 5,
  "estimated_monthly_cost_usd": 14.46,
  "provider": "groq",
  "model": "llama-3.3-70b-versatile"
}
```

### GET /admin/tokens/users

Returns per-user breakdown, sorted by tokens used descending.

**Query params**: `date` (optional, ISO date, default today), `limit` (default 50)

**Response 200**:
```json
{
  "date": "2026-05-14",
  "users": [
    {
      "user_id": 42,
      "username": "heavyuser",
      "tier": "paid",
      "tokens_today": 8200,
      "analyses_in_window": 0,
      "daily_limit": 10000,
      "pct_used": 82
    }
  ]
}
```

### PUT /admin/tokens/users/{user_id}/tier

Change a user's tier.

**Request**:
```json
{ "tier": "free" | "paid" }
```

**Response 200**:
```json
{ "message": "User tier updated to paid." }
```

---

## Environment Variables (new)

Add to `.env` and `.env.example`:

```
# AI Token / Quota Management
FREE_TIER_ANALYSIS_LIMIT=2
FREE_TIER_WINDOW_DAYS=10
PAID_TIER_DAILY_TOKEN_LIMIT=10000
LLM_PROVIDER=groq
LLM_MODEL=llama-3.3-70b-versatile
GROQ_PRICE_PER_1K_TOKENS=0.0006

# OTP Security
OTP_HMAC_SECRET=change-this-to-a-random-secret
OTP_EXPIRY_MINUTES=10
OTP_MAX_ATTEMPTS=5
OTP_RATE_LIMIT_PER_30MIN=3
```
