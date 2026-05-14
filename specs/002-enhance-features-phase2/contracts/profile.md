# API Contract: User Profile

All endpoints require `Authorization: Bearer <access_token>`.

Base path: `/profile`

---

## GET /profile/me

Returns full profile including activity stats, stored CV status, social links, and tier info.

**Response 200**:
```json
{
  "id": 1,
  "email": "user@example.com",
  "username": "johndoe",
  "created_at": "2026-01-15T10:00:00Z",
  "is_admin": false,
  "tier": "free",
  "total_sessions": 12,
  "avg_match_score": 74.5,
  "best_score": 91.0,
  "total_interviews": 8,
  "roadmaps_generated": 3,
  "linkedin_url": "https://linkedin.com/in/johndoe",
  "github_url": "https://github.com/johndoe",
  "portfolio_url": "https://johndoe.dev",
  "bio": "Backend engineer with 5 years experience.",
  "stored_cv_filename": "john_cv_2026.pdf",
  "has_stored_cv": true,
  "analyses_this_window": 1,
  "window_resets_at": "2026-05-24T10:00:00Z"
}
```

---

## PUT /profile/update

Updates editable profile fields. All fields optional (PATCH semantics).

**Request**:
```json
{
  "username": "newname",
  "bio": "Updated bio.",
  "linkedin_url": "https://linkedin.com/in/newname",
  "github_url": "https://github.com/newname",
  "portfolio_url": "https://newname.dev"
}
```

**Response 200**:
```json
{ "message": "Profile updated successfully." }
```

**Response 400 — username taken**:
```json
{ "detail": "Username already taken." }
```

**Response 422** — URL validation failure (e.g., LinkedIn URL doesn't start with `https://linkedin.com/`).

---

## POST /profile/cv

Upload a stored personal CV (replaces any existing stored CV).

**Content-Type**: `multipart/form-data`  
**Field**: `file` (PDF only, max 5MB)

**Response 200**:
```json
{ "message": "CV stored successfully.", "filename": "john_cv_2026.pdf" }
```

**Response 400 — wrong type**:
```json
{ "detail": "Only PDF files are accepted." }
```

**Response 413 — too large**:
```json
{ "detail": "File size exceeds the 5MB limit." }
```

---

## DELETE /profile/cv

Removes the stored CV.

**Response 200**:
```json
{ "message": "Stored CV removed." }
```

**Response 404**:
```json
{ "detail": "No stored CV found." }
```

---

## POST /profile/send-change-otp

Triggers an OTP send for a password change (requires auth — user is already logged in).

**Request**: (no body required — sends to the user's own email)

**Response 200**:
```json
{ "message": "A 5-digit confirmation code has been sent to your registered email." }
```

**Rate limit**: 3 requests per 30 minutes.

---

## POST /profile/change-password

Changes the authenticated user's password after OTP confirmation.

**Request**:
```json
{ "otp_code": "04827", "new_password": "newpass123" }
```

**Response 200**:
```json
{ "message": "Password changed successfully. All other sessions have been revoked." }
```

**Response 400 — wrong OTP**:
```json
{ "detail": "Invalid code. X attempts remaining." }
```

**Notes**: On success, sets `sessions_revoked_at = NOW()` to invalidate all other JWTs.
