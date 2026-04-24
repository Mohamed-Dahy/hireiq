# HireIQ — AI-Powered CV Screener & Interview Coach

> An end-to-end AI platform that scores CVs against job descriptions, identifies skill gaps, generates tailored interview questions, and runs a voice-based mock interview with real-time webcam feedback. Built entirely on free-tier infrastructure — no OpenAI costs.

---

## Features

- **CV Match Scoring** — Upload a PDF CV and a job description; get a 0–100% semantic + keyword match score powered by `all-MiniLM-L6-v2` embeddings and TF-IDF
- **LLM Skill Gap Analysis** — LangChain + Groq `llama-3.3-70b-versatile` streams a full skill gap breakdown and 5 tailored interview questions via Server-Sent Events
- **JD Templates** — 5 built-in job description templates (Software Engineer, Data Scientist, Product Manager, DevOps, Frontend) for instant analysis
- **Mock Interview Engine** — Record voice answers; Groq Whisper transcribes, LLaMA 3 scores clarity / relevance / depth
- **Eye Contact Detection** — OpenCV Haar cascade analyzes webcam frames captured during recording and returns an eye-contact ratio
- **Dashboard & History** — Aggregate stats, past sessions, per-session detail with all interview results
- **PDF Report Export** — One-click download of a full report (score + skills + analysis + interview feedback)
- **Auth** — JWT access + refresh tokens, silent background refresh, forced logout on expiry
- **Rate Limiting** — Per-IP limits on all write endpoints (slowapi)
- **Offline Detection** — Animated banner when the backend is unreachable; toast on reconnect

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Tailwind CSS v4, Framer Motion, Vite |
| Backend | Python 3.11, FastAPI, Pydantic v2, SQLAlchemy 2 |
| LLM | LangChain + Groq API (`llama-3.3-70b-versatile`), free tier |
| Embeddings | `sentence-transformers` — `all-MiniLM-L6-v2`, runs locally |
| Speech | Groq Whisper API (`whisper-large-v3`), free tier |
| Vision | OpenCV headless (face + eye-contact detection) |
| Database | PostgreSQL (local) |
| Cache | Redis (match score caching, 1 hr TTL) |
| Auth | JWT — `python-jose`, bcrypt, silent refresh interceptor |
| Infra | Docker Compose (Redis + backend + frontend via nginx) |

---

## Project structure

```
HireIQ/
├── Backend/
│   ├── app/
│   │   ├── main.py          # FastAPI app, CORS, rate limiter, router registration
│   │   └── config.py        # Pydantic settings from .env
│   ├── routers/
│   │   ├── auth.py          # /auth/register, /login, /refresh, /me
│   │   ├── cv.py            # /cv/upload, /sessions, /{id}/detail, /{id}/report, /{id}/score
│   │   ├── analysis.py      # /analyze  (SSE stream)
│   │   └── interview.py     # /interview/answer, /eye-contact, /history
│   ├── services/
│   │   ├── auth_service.py  # JWT creation/decode, bcrypt, get_current_user dependency
│   │   ├── cv_parser.py     # PyMuPDF text extraction + spaCy NER
│   │   ├── rag_scorer.py    # sentence-transformers + TF-IDF cosine scoring
│   │   ├── llm_analyzer.py  # LangChain chain → Groq LLaMA 3 (stream + invoke)
│   │   ├── interview_engine.py  # Groq Whisper transcription + LLaMA 3 scoring
│   │   ├── cv_vision.py     # OpenCV eye-contact ratio from webcam frames
│   │   ├── report_generator.py  # fpdf2 PDF report builder
│   │   └── cache.py         # Redis score cache helpers
│   ├── models/
│   │   ├── user.py          # SQLAlchemy: User, CVSession, InterviewResult
│   │   └── schemas.py       # Pydantic request/response schemas
│   ├── rag/
│   │   └── prompts.py       # LangChain prompt templates
│   ├── database.py          # SQLAlchemy engine + get_db dependency
│   ├── limiter.py           # Shared slowapi Limiter instance
│   ├── requirements.txt
│   ├── Dockerfile
│   ├── .env.example
│   └── .env.docker          # Docker-specific URL overrides (loaded on top of .env)
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Landing.tsx      # Marketing landing page
│   │   │   ├── Auth.tsx         # Login / register toggle
│   │   │   ├── Dashboard.tsx    # Stats, recent sessions, charts
│   │   │   ├── Upload.tsx       # CV + JD upload with template chips
│   │   │   ├── Results.tsx      # Score gauge, skills, streaming analysis
│   │   │   ├── History.tsx      # All past sessions
│   │   │   ├── SessionDetail.tsx  # Per-session detail + interview results
│   │   │   ├── Interview.tsx    # Webcam + mic + eye-contact + feedback
│   │   │   └── Profile.tsx      # User profile and aggregate stats
│   │   ├── components/
│   │   │   ├── FeedbackPanel.tsx  # Score bars + transcript
│   │   │   └── Toast.tsx          # Toast notification system
│   │   ├── hooks/
│   │   │   ├── useWebcam.ts    # getUserMedia stream manager
│   │   │   └── useRecorder.ts  # MediaRecorder → audio blob
│   │   └── api.ts              # Axios instance, JWT interceptor, all typed API calls
│   ├── nginx.conf           # Serves SPA + proxies /auth /cv /analyze /interview to backend
│   ├── Dockerfile
│   └── vite.config.ts
│
└── docker-compose.yml       # redis + backend + frontend
```

---

## Quick start (Docker)

**Prerequisites:** Docker Desktop, a local PostgreSQL instance, a free [Groq API key](https://console.groq.com).

```bash
# 1. Clone
git clone https://github.com/Mohamed-Dahy/HireIQ.git
cd HireIQ

# 2. Create your .env from the example
cp Backend/.env.example Backend/.env
# Edit Backend/.env — fill in GROQ_API_KEY, DATABASE_URL, JWT_SECRET

# 3. Create the database in your local PostgreSQL
# (psql, pgAdmin, or any client)
CREATE DATABASE hireiq;

# 4. Build and start
docker-compose up --build
```

Open **http://localhost** — the full app is running.

> **Note:** PostgreSQL runs locally (managed by pgAdmin or your existing instance). Redis and the backend/frontend run in Docker. The backend connects to your local postgres via `host.docker.internal`.

---

## Environment variables

Copy `Backend/.env.example` to `Backend/.env` and fill in:

```env
GROQ_API_KEY=gsk_...               # From console.groq.com (free)
DATABASE_URL=postgresql://postgres:password@localhost:5432/hireiq
REDIS_URL=redis://localhost:6379
JWT_SECRET=any-long-random-string
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
UPLOAD_DIR=./uploads
ALLOWED_ORIGINS=http://localhost:5173  # use http://localhost for Docker
```

`Backend/.env.docker` (already committed) overrides the service URLs for Docker — you don't need to edit it.

---

## API reference

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | — | Create account, returns JWT pair |
| POST | `/auth/login` | — | Login, returns JWT pair |
| POST | `/auth/refresh` | — | Exchange refresh token for new pair |
| GET | `/auth/me` | ✓ | Current user profile + aggregate stats |
| POST | `/cv/upload` | ✓ | Upload PDF CV + JD text → session |
| GET | `/cv/sessions` | ✓ | All sessions for current user |
| GET | `/cv/{id}/detail` | ✓ | Session + all interview results |
| GET | `/cv/{id}/score` | ✓ | Match score (Redis-cached) |
| GET | `/cv/{id}/report` | ✓ | Download PDF report |
| DELETE | `/cv/{id}` | ✓ | Delete session + cache |
| GET | `/analyze` | ✓ | SSE stream — skill gap + questions |
| POST | `/interview/answer` | ✓ | Submit audio → transcript + scores |
| POST | `/interview/eye-contact` | ✓ | Submit frames → eye-contact ratio |
| GET | `/interview/history` | ✓ | All interview results for user |
| GET | `/health` | — | Server health check |

---

## Running locally without Docker

```bash
# Backend
cd Backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173** — Vite proxies all API calls to `localhost:8000`.

---

## Groq free tier

| Model | Used for | Free limit |
|---|---|---|
| `llama-3.3-70b-versatile` | Skill gap analysis + interview scoring | 100k tokens/day |
| `whisper-large-v3` | Audio transcription | 7,200 seconds/day |

No credit card required. Limits reset every 24 hours — more than enough for demos and portfolio use.
