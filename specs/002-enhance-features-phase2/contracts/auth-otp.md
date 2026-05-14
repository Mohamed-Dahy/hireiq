# API Contract: Auth — OTP Flows

Replaces magic-link verification. All existing endpoints are modified or removed as noted.

---

## REMOVED endpoints

```
POST /auth/verify-email        → REMOVED (replaced by POST /auth/verify-otp)
POST /auth/resend-verification → REMOVED (replaced by POST /auth/resend-otp)
```

---

## MODIFIED: POST /auth/register

No request change. Response and side effect change.

**Request** (unchanged):
```json
{ "email": "user@example.com", "username": "johndoe", "password": "secret123" }
```

**Response 201** (modified message):
```json
{ "message": "Account created. A 5-digit verification code has been sent to your email.", "email": "user@example.com" }
```

**Side effect**: Creates `otp_codes` record (purpose=`registration`), sends OTP email (not a magic link).

---

## NEW: POST /auth/send-otp

Sends or resends an OTP for any purpose.

**Rate limit**: 3 requests per 30 minutes per email (Redis).

**Request**:
```json
{ "email": "user@example.com", "purpose": "registration" | "password_reset" }
```

**Response 200**:
```json
{ "message": "A 5-digit code has been sent to your email. Valid for 10 minutes." }
```

**Response 429**:
```json
{ "detail": "Too many OTP requests. Please wait before requesting a new code." }
```

**Notes**: Always returns 200 for `registration` even if email not found (anti-enumeration). `password_reset` purpose also returns 200 regardless. `password_change` purpose is handled via `POST /profile/send-change-otp` (requires auth).

---

## NEW: POST /auth/verify-otp

Verifies a submitted OTP code.

**Request**:
```json
{
  "email": "user@example.com",
  "code": "04827",
  "purpose": "registration" | "password_reset"
}
```

**Response 200 — registration**:
```json
{ "message": "Email verified. You can now log in." }
```

**Response 200 — password_reset** (returns a short-lived reset session token):
```json
{ "message": "Code verified.", "reset_token": "<uuid>" }
```

**Response 400 — wrong code**:
```json
{ "detail": "Invalid code. X attempts remaining." }
```

**Response 400 — expired**:
```json
{ "detail": "Code has expired. Please request a new one." }
```

**Response 400 — locked**:
```json
{ "detail": "Too many incorrect attempts. Please request a new code." }
```

---

## MODIFIED: POST /auth/forgot-password

Request unchanged. Side effect changes (OTP instead of magic link).

**Request**:
```json
{ "email": "user@example.com" }
```

**Response 200** (always, anti-enumeration):
```json
{ "message": "If that email is registered, a 5-digit reset code has been sent." }
```

---

## MODIFIED: POST /auth/reset-password

No longer accepts a UUID token. Uses the `reset_token` from `verify-otp` plus the new password.

**Request**:
```json
{ "reset_token": "<uuid from verify-otp>", "new_password": "newpass123" }
```

**Response 200**:
```json
{ "message": "Password reset successfully. You can now log in." }
```

**Response 400**:
```json
{ "detail": "Invalid or expired reset token." }
```

**Notes**: `reset_token` is a short-lived (15 min) UUID stored in Redis, issued only after OTP verification succeeds. It is consumed (deleted) on use.
