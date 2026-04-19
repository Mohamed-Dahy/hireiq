# HIREIQ — AI-Powered CV Screener & Interview Coach

> An end-to-end AI platform that scores CVs against job descriptions, identifies skill gaps, generates tailored interview questions, and runs a voice-based mock interview with real-time feedback. Built entirely on free-tier infrastructure — Groq for LLM inference, HuggingFace for embeddings, no OpenAI costs.

---

## Project goal

Build a production-ready, deployable portfolio project that demonstrates:
- RAG pipeline (CV + JD embeddings → cosine match score)
- LLM skill gap analysis via LangChain + Groq (llama-3.1-70b) 
- Voice mock interview using Groq Whisper API 
- Computer vision eye-contact detection via OpenCV
- Full-stack deployment with FastAPI + React + Docker

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Tailwind CSS, Vite |
| Backend | Python 3.11, FastAPI, Pydantic v2 |
| AI / LLM | LangChain, Groq API (llama-3.1-70b), free tier |
| Embeddings | HuggingFace sentence-transformers (all-MiniLM-L6-v2), runs locally, free |
| RAG | ChromaDB, cosine similarity scoring |
| Speech | Groq Whisper API (whisper-large-v3), free tier |
| Vision | OpenCV (face + eye contact detection) |
| Database | PostgreSQL (users, sessions, results) |
| Cache | Redis (score caching, session state) |
| Storage | Local filesystem (dev) / AWS S3 (prod) |
| Auth | JWT (access + refresh tokens) |
| Infra | Docker Compose, GitHub Actions CI/CD |
| Deploy | Railway (quick) or AWS EC2 (prod) |

---

## Core features

### Feature 1 — CV + JD upload & parsing
- User uploads a PDF CV and pastes a job description
- Backend extracts structured text from CV using PyMuPDF
- spaCy NER extracts skills, job titles, education, years of experience
- Both CV and JD are embedded using `all-MiniLM-L6-v2` from HuggingFace sentence-transformers (runs locally, no API cost)
- Embeddings stored in ChromaDB

### Feature 2 — Match score
- Cosine similarity between CV embedding and JD embedding → 0–100% match score
- scikit-learn TF-IDF keyword overlap as a secondary signal
- Final score = weighted average of semantic + keyword scores
- Result cached in Redis for 1 hour per (cv_id, jd_id) pair

### Feature 3 — LLM skill gap analysis
- LangChain chain takes structured CV + JD → Groq `llama-3.1-70b`
- Output: list of missing skills ranked by importance, with learning suggestions per skill
- Output: 5 tailored interview questions based on the role and the candidate's gaps
- Streamed response to frontend via Server-Sent Events (SSE)
- Groq free tier: 100,000 tokens/day — sufficient for demos and portfolio use

### Feature 4 — Mock interview engine
- User selects a question and clicks "Start Answer"
- Frontend captures microphone audio via MediaRecorder API
- Audio sent to backend → Groq Whisper API (`whisper-large-v3`) transcribes to text
- Groq `llama-3.1-70b` scores the answer on: clarity, relevance, depth (0–10 each)
- OpenCV.js (frontend) streams webcam frames → detects face presence + eye contact ratio
- Final feedback panel: transcript + scores + eye contact percentage

### Feature 5 — Dashboard & history
- User can view all past CV sessions with scores and feedback
- Export full report as PDF (pdfkit)
- Auth: register / login / JWT refresh

---

## Folder structure

```
screena/
├── backend/
│   ├── app/
│   │   ├── main.py                  # FastAPI app, CORS, router registration
│   │   └── config.py                # Settings from .env (pydantic-settings)
│   ├── routers/
│   │   ├── auth.py                  # POST /register, POST /login, POST /refresh
│   │   ├── cv.py                    # POST /cv/upload, GET /cv/{id}/score
│   │   ├── analysis.py              # POST /analyze (SSE stream)
│   │   └── interview.py             # POST /interview/answer, GET /interview/history
│   ├── services/
│   │   ├── cv_parser.py             # PyMuPDF + spaCy extraction → structured dict
│   │   ├── rag_scorer.py            # Embed CV+JD → ChromaDB → cosine score
│   │   ├── llm_analyzer.py          # LangChain chain → Groq llama-3.1-70b → skill gaps + questions
│   │   ├── interview_engine.py      # Groq Whisper transcribe → llama-3.1-70b score answer
│   │   ├── cv_vision.py             # OpenCV face + eye contact detection
│   │   └── cache.py                 # Redis get/set helpers
│   ├── models/
│   │   ├── user.py                  # SQLAlchemy: User, CVSession, InterviewResult
│   │   └── schemas.py               # Pydantic request/response schemas
│   ├── rag/
│   │   ├── vectorstore.py           # ChromaDB init, upsert, similarity_search
│   │   ├── embeddings.py            # HuggingFace sentence-transformers wrapper (local, free)
│   │   └── prompts.py               # All LangChain prompt templates
│   ├── requirements.txt
│   └── Dockerfile
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Upload.tsx           # CV + JD upload form
│   │   │   ├── Results.tsx          # Score card + skill gap list
│   │   │   ├── Interview.tsx        # Webcam + mic + live feedback
│   │   │   └── History.tsx          # Past sessions dashboard
│   │   ├── components/
│   │   │   ├── ScoreGauge.tsx       # Circular match % visual
│   │   │   ├── SkillGapList.tsx     # Missing skills with suggestions
│   │   │   ├── QuestionCard.tsx     # Interview Q + answer recorder
│   │   │   └── FeedbackPanel.tsx    # GPT scoring + eye contact metric
│   │   ├── hooks/
│   │   │   ├── useWebcam.ts         # Webcam stream + OpenCV.js bridge
│   │   │   └── useRecorder.ts       # MediaRecorder → send audio blob
│   │   └── api.ts                   # Axios instance, all API calls typed
│   ├── Dockerfile
│   └── vite.config.ts
│
├── docker-compose.yml               # frontend + api + postgres + chromadb + redis
├── .github/
│   └── workflows/
│       └── ci.yml                   # pytest → build image → deploy on push to main
└── README.md
```

---

## Environment variables

Create a `.env` file in `/backend`:

```env
# Groq (free tier — get key at console.groq.com)
GROQ_API_KEY=gsk_...

# Embeddings — HuggingFace runs locally, no key needed
EMBEDDING_MODEL=all-MiniLM-L6-v2

# Database
DATABASE_URL=postgresql://postgres:password@localhost:5432/screena

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-key
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Storage
UPLOAD_DIR=./uploads
```

---

## Build plan — 4 weeks

### Week 1 — CV parsing + RAG scoring pipeline
**Goal:** User can upload a CV + JD and get a match score.

Tasks:
1. Initialize FastAPI project with folder structure above
2. Set up PostgreSQL with SQLAlchemy models (User, CVSession)
3. Set up Docker Compose with postgres + redis + chromadb services
4. Build `cv_parser.py`: PyMuPDF text extraction + spaCy NER
5. Build `rag_scorer.py`: embed with `all-MiniLM-L6-v2` (sentence-transformers, local) → ChromaDB → cosine score
6. Build `routers/cv.py`: POST /cv/upload → parse → embed → score → return result
7. Build React Upload page with file input + JD textarea
8. Build Results page showing the match score as a gauge

Deliverable: Working upload → score flow, end to end.

---

### Week 2 — LLM skill gap analysis + interview questions
**Goal:** After scoring, user gets skill gaps and interview questions streamed live.

Tasks:
1. Build `rag/prompts.py` with skill gap prompt template
2. Build `llm_analyzer.py`: LangChain chain → Groq `llama-3.1-70b` → structured output (missing skills + questions)
3. Add SSE streaming to `routers/analysis.py`
4. Build `SkillGapList.tsx` component with animated stream rendering
5. Build `QuestionCard.tsx` showing generated questions
6. Add Redis caching to skip re-analysis for same (cv_id, jd_id) pair

Deliverable: Full analysis screen with streaming skill gaps and questions.

---

### Week 3 — Mock interview engine (Whisper + OpenCV)
**Goal:** User can answer questions by voice and get scored with eye contact feedback.

Tasks:
1. Build `useRecorder.ts` hook: MediaRecorder → audio blob → POST to backend
2. Build `interview_engine.py`: receive audio → Groq Whisper (`whisper-large-v3`) transcribe → Groq `llama-3.1-70b` score (clarity, relevance, depth)
3. Build `cv_vision.py`: receive webcam frames → OpenCV face cascade → eye contact ratio
4. Build `useWebcam.ts` hook: stream frames to backend every 500ms during recording
5. Build `Interview.tsx` page: webcam preview + record button + live transcript display
6. Build `FeedbackPanel.tsx`: transcript + 3 score bars + eye contact percentage
7. Build `InterviewResult` SQLAlchemy model + save results to DB

Deliverable: Full working mock interview with voice + vision feedback.

---

### Week 4 — Dashboard, PDF export, CI/CD, deploy
**Goal:** Polish, deploy live, get a shareable demo link.

Tasks:
1. Build `History.tsx` page: list all past CV sessions with scores
2. Add PDF report export using pdfkit (score + skill gaps + interview feedback)
3. Write GitHub Actions CI: `pytest` → build Docker images → push to registry
4. Write `docker-compose.yml` for full local stack
5. Deploy to Railway (or AWS EC2) — get a live HTTPS URL
6. Record a 2-minute demo GIF for the README
7. Write final README with architecture diagram, setup guide, and demo GIF

Deliverable: Live deployed app at a public URL. Portfolio-ready.

---

## API reference

| Method | Endpoint | Description |
|---|---|---|
| POST | `/auth/register` | Create account |
| POST | `/auth/login` | Get JWT tokens |
| POST | `/cv/upload` | Upload CV PDF + JD text → returns session_id |
| GET | `/cv/{session_id}/score` | Get match score for a session |
| POST | `/analyze` | Stream skill gaps + interview questions (SSE) |
| POST | `/interview/answer` | Submit audio answer → get transcript + scores |
| GET | `/interview/history` | Get all past interview results for user |
| GET | `/cv/{session_id}/report` | Download PDF report |

---

## How to run locally

```bash
# 1. Clone the repo
git clone https://github.com/yourusername/screena
cd screena

# 2. Start all services
docker-compose up -d

# 3. Install backend dependencies
cd backend
pip install -r requirements.txt

# 4. Run backend
uvicorn app.main:app --reload --port 8000

# 5. Install and run frontend
cd ../frontend
npm install
npm run dev
```

Open `http://localhost:5173`

---

## Groq setup (free)

1. Go to [console.groq.com](https://console.groq.com) and create a free account
2. Generate an API key and add it to `.env` as `GROQ_API_KEY`
3. Free tier limits: 100,000 tokens/day on `llama-3.1-70b`, 7,200 seconds/day on `whisper-large-v3` — more than enough for development and demos
4. LangChain integration: use `langchain-groq` package — `ChatGroq(model="llama-3.1-70b-versatile")`
5. Whisper integration: use the Groq Python SDK — `groq.audio.transcriptions.create(model="whisper-large-v3")`

No credit card required. The free tier resets every 24 hours.

---

## Instructions for Claude Code

When you open this project, follow this sequence:

1. Read this README fully before writing any code
2. Start with Week 1 tasks only — do not jump ahead
3. For each file you create, match exactly the folder structure above
4. Use Python type hints everywhere in the backend
5. Use TypeScript strict mode in the frontend — no `any` types
6. Write a pytest test for every service function in `/backend/services/`
7. After completing each week's tasks, summarize what was built and ask before moving to the next week
8. Keep all LangChain prompts in `rag/prompts.py` — never inline them
9. Every API endpoint must have a Pydantic response model — no raw dicts returned
11. Use `langchain-groq` for all LLM calls — never `langchain-openai`
12. Use `sentence-transformers` for embeddings — never call any external embedding API
13. Use the `groq` Python SDK for Whisper transcription
