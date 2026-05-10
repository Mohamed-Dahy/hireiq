# Auth API Contracts

Base path: `/auth`

All existing endpoints (`/register`, `/login`, `/refresh`, `/me`) are unchanged.
New endpoints below.

---

## POST /auth/verify-email

Consume an email verification token sent to the user's inbox.

**Auth**: None required
**Rate limit**: 10/minute per IP

**Request**:
```json
{ "token": "uuid4-string" }
```

**Responses**:
- `200` — `{ "message": "Email verified successfully" }`
- `400` — `{ "detail": "Invalid or expired token" }`
- `409` — `{ "detail": "Email already verified" }`

---

## POST /auth/resend-verification

Resend the email verification link to the authenticated user's email.

**Auth**: Bearer token required
**Rate limit**: 3/hour per user

**Request**: no body

**Responses**:
- `200` — `{ "message": "Verification email sent" }`
- `409` — `{ "detail": "Email already verified" }`
- `429` — rate limit exceeded

---

## POST /auth/forgot-password

Initiate the password reset flow for a given email address.

**Auth**: None required
**Rate limit**: 3/hour per IP

**Request**:
```json
{ "email": "user@example.com" }
```

**Responses**:
- `200` — `{ "message": "If that email is registered, a reset link has been sent" }`
  (Always 200 — do not reveal whether the email exists)

---

## POST /auth/reset-password

Consume a password reset token and set a new password.

**Auth**: None required
**Rate limit**: 10/minute per IP

**Request**:
```json
{
  "token": "uuid4-string",
  "new_password": "minimum 8 characters"
}
```

**Responses**:
- `200` — `{ "message": "Password updated successfully" }`
- `400` — `{ "detail": "Invalid or expired token" }`
- `422` — password too short

**Side effects**: All active sessions for the user are invalidated (JTIs added to Redis blacklist).

---

## GET /auth/me (extended)

Existing endpoint — response schema extended with subscription fields.

**Additional fields in response**:
```json
{
  "email_verified": true,
  "subscription": {
    "plan_slug": "professional",
    "plan_name": "Professional",
    "status": "active",
    "ends_at": "2026-06-10T00:00:00Z"
  }
}
```
