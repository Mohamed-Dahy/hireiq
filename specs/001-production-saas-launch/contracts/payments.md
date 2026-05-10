# Payments API Contracts

Base path: `/payments`
**Gateway**: Paymob only (Stripe deferred to future version)

Webhook endpoints — called by Paymob, NOT by the frontend.
All webhook endpoints verify the Paymob HMAC-SHA512 signature before processing.

---

## POST /payments/webhook/paymob

Receive Paymob transaction notifications.

**Auth**: None (HMAC-SHA512 signature verified in handler; duplicate idempotency check)
**Content-Type**: `application/json`

**Signature verification** (FR-022):
1. Concatenate the required Paymob HMAC fields in the documented order.
2. Compute HMAC-SHA512 using `PAYMOB_HMAC_SECRET`.
3. Compare with the `hmac` field in the request body.
4. Reject with `401` and log if mismatch — log the source IP and payload hash.

**Idempotency** (FR-022):
- Before processing, check if `Payment` record with this `gateway_reference`
  already has `status=paid`.
- If already processed: return `200 { "received": true, "status": "already_processed" }` immediately.
- Do NOT re-trigger subscription activation or email on duplicate delivery.

**Handled events**:
- `success=true, pending=false` → mark Payment as `paid`, activate Subscription
- `success=false` → increment failure count; after 3 failures, lapse Subscription

**Response**: Always `200 { "received": true }` (Paymob retries on non-200)

**Side effects on success**:
1. Set `Payment.status = "paid"`, `Payment.completed_at = now`
2. Set `Subscription.status = "active"`, `Subscription.started_at = now`, `Subscription.ends_at = now + 30 days`
3. Write `SecurityAuditLog` entry: event=`payment.webhook.success`, gateway_ref, user_id
4. Send payment confirmation email to user

**Side effects on signature failure**:
1. Write `SecurityAuditLog` entry: event=`payment.webhook.invalid_signature`, source_ip
2. Return `401` — do NOT process subscription

---

## POST /subscriptions/checkout

Create a Paymob payment intent and return the iframe token for the frontend.

**Auth**: Bearer token required

**Request**:
```json
{
  "plan_slug": "professional"
}
```

**Paymob flow**:
1. Backend authenticates with Paymob API using `PAYMOB_API_KEY` → receives `auth_token`
2. Backend creates Paymob order with amount in piastres → receives `order_id`
3. Backend creates Paymob payment key with `order_id`, `auth_token`, `PAYMOB_INTEGRATION_ID` → receives `payment_key`
4. Backend creates `Payment` record (status=`pending`) and `Subscription` (status=`pending`)
5. Backend returns `payment_key` to frontend
6. Frontend renders Paymob iframe: `https://accept.paymob.com/api/acceptance/iframes/{PAYMOB_IFRAME_ID}?payment_token={payment_key}`

**Response `200`**:
```json
{
  "payment_key": "paymob-payment-key-token",
  "iframe_id": "12345",
  "subscription_id": 42
}
```

**Response `409`**: User already has an active paid subscription.
**Response `503`**: Paymob API unreachable — try again later.

---

## GET /payments/history

Return the current user's payment history.

**Auth**: Bearer token required

**Response `200`**:
```json
[
  {
    "id": 1,
    "amount_display": "299 EGP",
    "currency": "EGP",
    "gateway": "paymob",
    "status": "paid",
    "created_at": "2026-05-10T14:00:00Z"
  }
]
```

---

## Security Notes

- `PAYMOB_API_KEY`, `PAYMOB_INTEGRATION_ID`, `PAYMOB_HMAC_SECRET`, `PAYMOB_IFRAME_ID`
  MUST be supplied via environment variables — never hardcoded.
- The frontend MUST render the Paymob iframe directly — card data MUST NOT be
  intercepted, proxied, or logged by HireIQ backend code at any point.
- All Paymob API calls from the backend MUST use HTTPS.
- Log ALL webhook receipts (success and failure) to `SecurityAuditLog`.
