# HireIQ — Deployment Guide

This guide covers everything needed to take HireIQ from a local repo to a live production server.
Complete every section **in order** before going live.

---

## Table of Contents

1. [Server Requirements](#1-server-requirements)
2. [Resend — Email Setup](#2-resend--email-setup)
3. [Environment Configuration](#3-environment-configuration)
4. [First Deploy](#4-first-deploy)
5. [Post-Deploy Verification](#5-post-deploy-verification)
6. [Paymob — Payment Gateway](#6-paymob--payment-gateway)
7. [Ongoing Operations](#7-ongoing-operations)

---

## 1. Server Requirements

**Minimum specs** for a production server:

| Resource | Minimum | Recommended |
|---|---|---|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 4 GB | 8 GB |
| Disk | 30 GB SSD | 60 GB SSD |
| OS | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |

**Required software on the server:**

```bash
# Install Docker Engine
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker

# Install Docker Compose plugin
sudo apt-get install docker-compose-plugin

# Verify
docker compose version   # must be v2.x
```

**Open ports on your firewall / security group:**

```
80   (HTTP  — redirects to 443)
443  (HTTPS — main traffic)
22   (SSH   — your IP only)
```
> Close port 8080 (Adminer) in production — it should never be publicly accessible.

---

## 2. Resend — Email Setup

HireIQ sends OTP codes and account emails via [Resend](https://resend.com).
Without this, users cannot register or reset passwords.

### Step 1 — Create a Resend account

Go to [resend.com](https://resend.com) → Sign up → Free plan covers 3,000 emails/month.

### Step 2 — Add and verify your domain

1. In the Resend dashboard → **Domains** → **Add Domain**
2. Enter your domain, e.g. `hireiq.app`
3. Resend gives you DNS records to add. Add all of them in your domain registrar:

   | Type | Name | Value |
   |---|---|---|
   | TXT | `resend._domainkey` | `p=MIGf...` (DKIM key from Resend) |
   | MX | `send` | `feedback-smtp.us-east-1.amazonses.com` |
   | TXT | `_dmarc` | `v=DMARC1; p=none;` |

4. Click **Verify** in Resend — DNS can take up to 48 hours to propagate.
5. Once verified, the domain shows a green "Verified" badge.

### Step 3 — Get your API key

1. Resend dashboard → **API Keys** → **Create API Key**
2. Name it `hireiq-production`, permission: **Full access**
3. Copy the key — you only see it once

### Step 4 — Set your sender address

In `.env`:
```env
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxx
FROM_EMAIL=noreply@yourdomain.com
```

> `FROM_EMAIL` must use the domain you verified in Step 2, e.g. `noreply@hireiq.app`  
> Using `onboarding@resend.dev` only works for testing to your own email address.

### Step 5 — Test it

After deploy, register a new account on the live site — you should receive the OTP email within seconds.

---

## 3. Environment Configuration

### 3.1 — Generate secrets

On your server (or any terminal with Python):

```bash
# JWT secret — paste result into JWT_SECRET
python3 -c "import secrets; print(secrets.token_hex(64))"

# OTP HMAC secret — paste result into OTP_HMAC_SECRET
python3 -c "import secrets; print(secrets.token_hex(64))"
```

### 3.2 — Edit `Backend/.env`

Open the file and fill in every value:

```env
# ── LLM ──────────────────────────────────────────────────────────────────────
GROQ_API_KEY=gsk_your_actual_key_here

# ── Database ──────────────────────────────────────────────────────────────────
POSTGRES_USER=postgres
POSTGRES_PASSWORD=a_strong_db_password_here
POSTGRES_DB=hireiq
DATABASE_URL=postgresql://postgres:a_strong_db_password_here@localhost:5432/hireiq

# ── Redis ────────────────────────────────────────────────────────────────────
REDIS_URL=redis://localhost:6379

# ── JWT ──────────────────────────────────────────────────────────────────────
JWT_SECRET=paste_64_char_hex_from_step_3_1_here
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# ── OTP ──────────────────────────────────────────────────────────────────────
OTP_HMAC_SECRET=paste_other_64_char_hex_from_step_3_1_here
OTP_EXPIRY_MINUTES=10
OTP_MAX_ATTEMPTS=5
OTP_RATE_LIMIT_PER_30MIN=3

# ── Email (Resend) ────────────────────────────────────────────────────────────
RESEND_API_KEY=re_your_actual_key_here
FROM_EMAIL=noreply@yourdomain.com
APP_BASE_URL=https://yourdomain.com

# ── Admin account ─────────────────────────────────────────────────────────────
ADMIN_EMAIL=you@yourdomain.com
ADMIN_PASSWORD=a_very_strong_admin_password

# ── Paymob (fill after Section 6) ────────────────────────────────────────────
PAYMOB_API_KEY=
PAYMOB_INTEGRATION_ID=
PAYMOB_HMAC_SECRET=
PAYMOB_IFRAME_ID=

# ── Tiers ─────────────────────────────────────────────────────────────────────
FREE_TIER_ANALYSIS_LIMIT=2
FREE_TIER_WINDOW_DAYS=10
```

### 3.3 — Edit `Backend/.env.docker`

Change `ALLOWED_ORIGINS` to your production domain:

```env
DATABASE_URL=postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}
REDIS_URL=redis://redis:6379
ALLOWED_ORIGINS=https://yourdomain.com
UPLOAD_DIR=/app/uploads
```

> If you have both `www` and non-www, use a comma-separated list:
> `ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com`

---

## 4. First Deploy

Run every command on your **production server** from the project root (`/home/user/HireIQ`).

### Step 1 — Clone the repo

```bash
git clone https://github.com/your-username/HireIQ.git
cd HireIQ
git checkout main
```

### Step 2 — Add your `.env` file

```bash
# Copy your local .env to the server — from your local machine:
scp Backend/.env user@your-server-ip:~/HireIQ/Backend/.env
```

### Step 3 — Build and start

```bash
docker compose build --no-cache
docker compose up -d
```

> The backend container automatically runs `alembic upgrade head` on startup
> before uvicorn starts (see `Backend/Dockerfile` CMD).

### Step 4 — Watch startup logs

```bash
docker compose logs -f backend
```

Wait until you see:
```
INFO     Application startup complete.
```

### Step 5 — Seed the admin account

```bash
docker compose exec backend python scripts/seed_admin.py
```

Expected output:
```
[seed_admin] Created admin account: you@yourdomain.com
```

### Step 6 — Import interview question bank

```bash
docker compose exec backend python scripts/import_questions.py
```

### Step 7 — Set up HTTPS with Certbot

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate (replace with your domain)
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal is set up automatically — verify it works:
sudo certbot renew --dry-run
```

### Step 8 — Nginx reverse proxy for HTTPS (outside Docker)

If you're running nginx on the host to terminate SSL before Docker:

```nginx
# /etc/nginx/sites-available/hireiq
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/hireiq /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 5. Post-Deploy Verification

Run through this checklist after every fresh deploy:

```
□ https://yourdomain.com loads the landing page
□ Register a new account → OTP email arrives in inbox (not spam)
□ Enter OTP → account verified → login works
□ Upload a CV + JD → analysis streams and completes
□ Admin panel at https://yourdomain.com/admin → login with ADMIN_EMAIL/ADMIN_PASSWORD
□ docker compose ps → all containers show "healthy"
□ docker compose logs backend | grep ERROR → no errors
```

---

## 6. Paymob — Payment Gateway

> Complete this section after the payment feature is built and before enabling paid tiers.

### Step 1 — Create a Paymob account

Go to [accept.paymob.com](https://accept.paymob.com) → **Create Account**  
Select **Egypt** as your country and fill in your business details.

### Step 2 — Get your API key

1. Dashboard → **Settings** → **Account Info**
2. Copy the **API Key** (long string starting with `ZXlK...`)
3. Add to `.env`:
   ```env
   PAYMOB_API_KEY=ZXlJ...your_key_here
   ```

### Step 3 — Create a payment integration

1. Dashboard → **Developers** → **Payment Integrations** → **New Integration**
2. Choose:
   - **Type**: Online Card
   - **Currency**: EGP (or USD if selling internationally)
   - **Name**: HireIQ Pro
3. Save → copy the **Integration ID** (a 5–6 digit number)
4. Add to `.env`:
   ```env
   PAYMOB_INTEGRATION_ID=123456
   ```

### Step 4 — Create an iframe

1. Dashboard → **Developers** → **iframes** → **New iframe**
2. Select the integration you just created
3. Copy the **iframe ID**
4. Add to `.env`:
   ```env
   PAYMOB_IFRAME_ID=789012
   ```

### Step 5 — Get your HMAC secret

1. Dashboard → **Settings** → **Account Info** → scroll to **HMAC Secret**
2. Copy the value
3. Add to `.env`:
   ```env
   PAYMOB_HMAC_SECRET=your_hmac_secret_here
   ```

### Step 6 — Set up the webhook (callback URL)

1. Dashboard → **Developers** → **Webhooks**
2. Set the **Transaction Processed Callback** to:
   ```
   https://yourdomain.com/payments/webhook
   ```
3. Paymob will POST to this URL when a payment completes.  
   The backend verifies the HMAC signature before updating the user's tier.

### Step 7 — Test with Paymob test cards

Before going live, test using Paymob's test environment cards:

| Card Number | Expiry | CVV | Result |
|---|---|---|---|
| `4987654321098769` | Any future date | `123` | Success |
| `4111111111111111` | Any future date | `123` | Decline |

Switch to live mode in your Paymob dashboard only after successful test transactions.

### Step 8 — Enable paid tier in the app

Once the payment backend is built:
1. Re-deploy with the filled Paymob env vars
2. The webhook handler will automatically set `user.tier = "pro"` on successful payment
3. Quota checks in `analysis.py` will enforce free vs pro limits from that point

---

## 7. Ongoing Operations

### Redeploy after code changes

```bash
git pull origin main
docker compose build backend frontend
docker compose up -d --no-deps backend frontend
```

### View live logs

```bash
docker compose logs -f backend     # API logs
docker compose logs -f frontend    # nginx access logs
```

### Database backup

```bash
docker compose exec postgres pg_dump -U postgres hireiq > backup_$(date +%Y%m%d).sql
```

### Run database migrations (after a code update)

Migrations run automatically on container start. To run manually:

```bash
docker compose exec backend alembic upgrade head
```

### Rotate secrets

If a secret is ever compromised:

1. Generate a new value (see Section 3.1)
2. Update `.env` on the server
3. Restart the backend: `docker compose restart backend`
4. If `JWT_SECRET` changed, all logged-in users are automatically signed out
   (their tokens will fail validation)

### Scale the backend

To run multiple backend workers:

```bash
# In docker-compose.yml, change the backend CMD to use multiple workers:
# CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4"]
```
