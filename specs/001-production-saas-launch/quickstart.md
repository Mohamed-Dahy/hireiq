# Quickstart: HireIQ Production SaaS

**Updated**: 2026-05-10

## Prerequisites

- Docker Desktop (Windows/Mac) or Docker Engine (Linux)
- Git
- A free [Groq API key](https://console.groq.com)
- A free [Resend API key](https://resend.com) (transactional email)
- Paymob developer account (for payments — optional for local dev)

---

## Local Development

### 1. Clone and configure

```bash
git clone https://github.com/Mohamed-Dahy/HireIQ.git
cd HireIQ
cp Backend/.env.example Backend/.env
```

Edit `Backend/.env` — fill in every required value:

```env
# AI
GROQ_API_KEY=gsk_...

# Database (Docker manages the container; use these exact values)
POSTGRES_USER=hireiq
POSTGRES_PASSWORD=choose-a-strong-password
POSTGRES_DB=hireiq
DATABASE_URL=postgresql://hireiq:choose-a-strong-password@postgres:5432/hireiq

# Redis
REDIS_URL=redis://redis:6379

# Auth
JWT_SECRET=any-long-random-string-32-chars-minimum
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# Email
RESEND_API_KEY=re_...
FROM_EMAIL=noreply@yourdomain.com
APP_BASE_URL=http://localhost:3000

# Payments (leave blank for local dev without payment testing)
PAYMOB_API_KEY=
PAYMOB_INTEGRATION_ID=
PAYMOB_HMAC_SECRET=
STRIPE_SECRET_KEY=
STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=

# File uploads
UPLOAD_DIR=/app/uploads
ALLOWED_ORIGINS=http://localhost:3000

# Admin panel (Adminer)
ADMINER_PASSWORD=choose-admin-password
```

### 2. Start all services

```bash
docker compose up --build
```

This starts: PostgreSQL, Redis, ChromaDB, Adminer, Backend (runs Alembic migrations on start), Frontend/nginx.

### 3. Verify

| URL | What to check |
|-----|---------------|
| http://localhost:3000 | App loads, landing page visible |
| http://localhost:8000/health | `{"status": "ok"}` |
| http://localhost:8080 | Adminer login — use `ADMINER_PASSWORD` |

### 4. Run backend tests

```bash
docker compose exec backend pytest tests/ -v
```

### 5. Run frontend tests

```bash
cd frontend
npm run test
```

---

## Inner-loop development (without Docker rebuild)

```bash
# Backend hot-reload
cd Backend
python -m venv venv
venv\Scripts\activate     # Windows
pip install -r requirements.txt
alembic upgrade head      # run migrations against local DB
uvicorn app.main:app --reload --port 8000

# Frontend hot-reload (separate terminal)
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 — Vite proxies all API calls to `localhost:8000`.

---

## Production Deployment (VPS)

### Server requirements

- Ubuntu 22.04 LTS (or equivalent)
- 2 vCPU / 4 GB RAM minimum
- Docker + Docker Compose installed
- Domain name with A record pointing to server IP

### Steps

```bash
# On the server
git clone https://github.com/Mohamed-Dahy/HireIQ.git
cd HireIQ
cp Backend/.env.example Backend/.env
# Fill in all values — use strong secrets
# Set APP_BASE_URL=https://yourdomain.com
# Set ALLOWED_ORIGINS=https://yourdomain.com

docker compose up -d --build
```

### HTTPS (Let's Encrypt)

Add a Caddy or nginx reverse proxy service to docker-compose.yml that handles
TLS termination. Caddy is recommended — automatic HTTPS with one config line:

```
yourdomain.com {
    reverse_proxy frontend:80
}
```

### Health monitoring

The backend exposes `GET /health`. Configure your VPS provider's health checks
or a free uptime monitor (UptimeRobot) to alert on failure.

---

## Environment Variable Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `GROQ_API_KEY` | ✅ | Groq LLM + Whisper key |
| `POSTGRES_USER` | ✅ | DB username |
| `POSTGRES_PASSWORD` | ✅ | DB password (never commit this) |
| `POSTGRES_DB` | ✅ | DB name |
| `DATABASE_URL` | ✅ | Full PostgreSQL connection string |
| `REDIS_URL` | ✅ | Redis connection string |
| `JWT_SECRET` | ✅ | JWT signing secret (min 32 chars) |
| `RESEND_API_KEY` | ✅ | Transactional email |
| `FROM_EMAIL` | ✅ | Sender email address |
| `APP_BASE_URL` | ✅ | Public URL (for email links) |
| `PAYMOB_API_KEY` | Payments only | Paymob integration |
| `PAYMOB_INTEGRATION_ID` | Payments only | Paymob card integration ID |
| `PAYMOB_HMAC_SECRET` | Payments only | Webhook verification |
| `PAYMOB_IFRAME_ID` | Payments only | Paymob iframe ID for hosted card form |
| `ADMINER_PASSWORD` | ✅ | Database admin panel password |
| `UPLOAD_DIR` | ✅ | File upload path (default: `/app/uploads`) |
| `ALLOWED_ORIGINS` | ✅ | CORS allowed origins |

---

## Alembic Commands

```bash
# Apply all pending migrations
alembic upgrade head

# Create a new migration after model changes
alembic revision --autogenerate -m "describe_the_change"

# Roll back one migration
alembic downgrade -1

# Show current revision
alembic current
```
