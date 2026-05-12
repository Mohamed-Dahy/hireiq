# Phase 3 Manual Test Guide

Run these after `docker compose up --build` (all containers healthy).
The backend is at `http://localhost:3000` (via nginx) or `http://localhost:8000` (direct).

Use direct backend port for curl tests: `http://localhost:8000`

---

## 1. Register — expect 201, message + email, no tokens

```bash
curl -s -X POST http://localhost:8000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","username":"yourname","password":"SecurePass1!"}' | python -m json.tool
```

Expected: `{"message":"Account created...","email":"you@example.com"}`

---

## 2. Login before verifying — expect 403

```bash
curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"SecurePass1!"}' | python -m json.tool
```

Expected: `{"detail":"Email not verified..."}`

---

## 3. Get the verification token from Adminer

1. Open http://localhost:8080
2. System: PostgreSQL, Server: postgres, User/Pass/DB from your `.env`
3. Browse `email_verification_tokens` → copy the `token` value

---

## 4. Verify email — expect 200

```bash
curl -s -X POST http://localhost:8000/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{"token":"PASTE-TOKEN-HERE"}' | python -m json.tool
```

Expected: `{"message":"Email verified. You can now log in."}`

---

## 5. Login after verifying — expect 200 with tokens

```bash
curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"SecurePass1!"}' | python -m json.tool
```

Save the `access_token` and `refresh_token` from the response.

---

## 6. Access /auth/me with token

```bash
curl -s http://localhost:8000/auth/me \
  -H "Authorization: Bearer ACCESS_TOKEN_HERE" | python -m json.tool
```

---

## 7. Logout — blacklists the tokens

```bash
curl -s -X POST http://localhost:8000/auth/logout \
  -H "Authorization: Bearer ACCESS_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"refresh_token":"REFRESH_TOKEN_HERE"}' | python -m json.tool
```

Expected: `{"message":"Logged out successfully"}`

---

## 8. Use the same token after logout — expect 401

```bash
curl -s http://localhost:8000/auth/me \
  -H "Authorization: Bearer ACCESS_TOKEN_HERE" | python -m json.tool
```

Expected: `{"detail":"Token has been revoked"}`

---

## 9. Password reset flow

```bash
# Request reset
curl -s -X POST http://localhost:8000/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com"}' | python -m json.tool
```

Get token from `password_reset_tokens` table in Adminer.

```bash
# Use reset token
curl -s -X POST http://localhost:8000/auth/reset-password \
  -H "Content-Type: application/json" \
  -d '{"token":"PASTE-RESET-TOKEN","new_password":"NewPass456!"}' | python -m json.tool
```

---

## 10. Account lockout test

```bash
# Run 5 bad login attempts
for i in 1 2 3 4 5; do
  curl -s -X POST http://localhost:8000/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"you@example.com","password":"wrongpassword"}' | python -m json.tool
  echo "Attempt $i done"
done

# 6th attempt — expect 423 Locked
curl -s -X POST http://localhost:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"wrongpassword"}' | python -m json.tool
```

Expected on 6th: `{"detail":"Account locked until..."}`

---

## 11. Run automated tests

```bash
cd Backend
python -m pytest tests/unit/test_auth_service.py -v
python -m pytest tests/integration/test_auth.py -v
```

Requirements: local PostgreSQL with `hireiq_test` DB, local Redis running.

Create test DB if needed:
```bash
psql -U postgres -c "CREATE DATABASE hireiq_test;"
```
