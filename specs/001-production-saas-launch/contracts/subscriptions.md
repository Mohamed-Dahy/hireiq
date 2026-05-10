# Subscriptions API Contracts

Base path: `/subscriptions`
All endpoints require Bearer token authentication.

---

## GET /subscriptions/plans

List all active subscription plans with their feature entitlements.

**Auth**: None required (public endpoint)

**Response `200`**:
```json
[
  {
    "slug": "free",
    "name": "Free",
    "price_egp": 0,
    "price_usd_cents": 0,
    "billing_cycle": "none",
    "features": ["cv-upload", "basic-analysis", "mock-interview"]
  },
  {
    "slug": "professional",
    "name": "Professional",
    "price_egp": 29900,
    "price_usd_cents": 999,
    "billing_cycle": "monthly",
    "features": ["cv-upload", "basic-analysis", "mock-interview", "enhanced-analysis",
                 "linkedin-import", "pdf-report", "job-tracker"]
  },
  {
    "slug": "recruiter",
    "name": "Recruiter",
    "price_egp": 79900,
    "price_usd_cents": 1999,
    "billing_cycle": "monthly",
    "features": ["cv-upload", "basic-analysis", "mock-interview", "enhanced-analysis",
                 "linkedin-import", "pdf-report", "job-tracker", "recruiter-dashboard"]
  }
]
```

---

## POST /subscriptions/checkout

Create a payment intent and return the gateway checkout URL.

**Auth**: Bearer token required

**Request**:
```json
{
  "plan_slug": "professional",
  "gateway": "paymob"
}
```

**Validation**:
- `plan_slug` MUST be a non-free plan slug
- `gateway` MUST be `"paymob"` or `"stripe"`

**Response `200`**:
```json
{
  "checkout_url": "https://accept.paymob.com/...",
  "subscription_id": 42,
  "expires_in_seconds": 3600
}
```

**Response `409`**: User already has an active subscription to this plan.
**Response `402`**: User already has a pending payment in progress.

---

## GET /subscriptions/status

Return the current user's subscription status.

**Auth**: Bearer token required

**Response `200`**:
```json
{
  "plan_slug": "professional",
  "plan_name": "Professional",
  "status": "active",
  "started_at": "2026-05-10T14:00:00Z",
  "ends_at": "2026-06-10T14:00:00Z",
  "gateway": "paymob",
  "entitlements": ["cv-upload", "enhanced-analysis", "linkedin-import", "pdf-report", "job-tracker"]
}
```

If user has no paid subscription:
```json
{
  "plan_slug": "free",
  "plan_name": "Free",
  "status": "active",
  "started_at": null,
  "ends_at": null,
  "gateway": null,
  "entitlements": ["cv-upload", "basic-analysis", "mock-interview"]
}
```

---

## POST /subscriptions/cancel

Cancel the current subscription at the end of the billing period.

**Auth**: Bearer token required

**Request**: no body

**Response `200`**:
```json
{
  "message": "Subscription cancelled. Access continues until 2026-06-10.",
  "ends_at": "2026-06-10T14:00:00Z"
}
```

**Response `404`**: No active paid subscription to cancel.

---

## Feature Gate — 402 Response Shape

When a user without the required entitlement hits a gated endpoint:

```json
{
  "detail": "This feature requires a Professional or higher subscription.",
  "required_plan": "professional",
  "upgrade_url": "/pricing"
}
```

HTTP status: `402 Payment Required`
