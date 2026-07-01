# HireIQ — System Workflow Guide

> This document is your complete map of the system: architecture, code flow, feature integration, testing, and database design. Read it top-to-bottom once, then use it as a reference when adding anything new.

---

## Table of Contents

1. [Tech Stack Overview](#1-tech-stack-overview)
2. [How to Add a New Feature (End-to-End)](#2-how-to-add-a-new-feature-end-to-end)
3. [Project Folder Map](#3-project-folder-map)
4. [Database: Schema, Migrations & Design](#4-database-schema-migrations--design)
5. [API Design & All Endpoints](#5-api-design--all-endpoints)
6. [How Tests Work](#6-how-tests-work)
7. [System Code Flow (Request Lifecycle)](#7-system-code-flow-request-lifecycle)
8. [Docker & Infrastructure](#8-docker--infrastructure)
9. [Frontend Architecture](#9-frontend-architecture)
10. [Security Architecture](#10-security-architecture)
11. [Configuration & Startup Details](#11-configuration--startup-details)
12. [Mini Todo App — Build Everything From Scratch](#12-mini-todo-app--build-everything-from-scratch)

---

## 1. Tech Stack Overview

```
┌──────────────────────────────────────────────────────┐
│                    BROWSER (React 19)                │
│         Vite + TypeScript + Tailwind CSS v4          │
│                  Axios + React Router                 │
└─────────────────────┬────────────────────────────────┘
                      │ HTTP / SSE
                      ▼
┌──────────────────────────────────────────────────────┐
│                  NGINX (Port 3000)                   │
│           Serves SPA + proxies /api to backend       │
└─────────────────────┬────────────────────────────────┘
                      │ HTTP (port 8000)
                      ▼
┌──────────────────────────────────────────────────────┐
│           FASTAPI BACKEND (Python 3.11)              │
│       Uvicorn (async ASGI) + SQLAlchemy ORM          │
│    Routers → Services → Models → DB / Cache / AI    │
└───┬────────────────┬──────────────────┬──────────────┘
    │                │                  │
    ▼                ▼                  ▼
PostgreSQL 16    Redis 7          ChromaDB
(primary store)  (cache + JWT     (vector store for
                  blacklist)       CV/JD embeddings)
```

| Layer       | Technology                       | Purpose                                 |
|-------------|----------------------------------|-----------------------------------------|
| Frontend    | React 19 + TypeScript + Vite     | SPA, pages, components, API calls       |
| Web Server  | Nginx (Alpine)                   | Serve built SPA, proxy API requests     |
| Backend     | FastAPI + Uvicorn                | REST API, business logic, AI services   |
| ORM         | SQLAlchemy 2.0                   | Database models, sessions               |
| Migrations  | Alembic                          | Version-controlled schema changes       |
| Primary DB  | PostgreSQL 16                    | Relational data (users, sessions, jobs) |
| Cache       | Redis 7                          | Score cache, JWT blacklist, OTP         |
| Vector DB   | ChromaDB                         | CV + JD semantic embeddings             |
| LLM         | Groq API (LLaMA 3.3 70B)         | Text analysis, roadmaps, job prep       |
| Speech      | Groq Whisper                     | Audio transcription in interviews       |
| Vision      | OpenCV                           | Eye-contact detection from webcam       |
| Embeddings  | sentence-transformers (local)    | Semantic similarity for CV scoring      |
| PDF Parse   | PyMuPDF                          | Extract text from uploaded CVs          |
| NER         | spaCy (en_core_web_sm)           | Named entity recognition in CV text     |
| Email       | Resend API                       | OTP codes, notifications                |
| Auth        | python-jose (JWT) + bcrypt       | Token-based auth, password hashing      |
| Rate Limit  | slowapi                          | Per-IP request limits                   |
| Testing     | pytest + pytest-asyncio          | Unit + integration tests                |
| Container   | Docker + Docker Compose          | 6-service orchestration                 |

---

## 2. How to Add a New Feature (End-to-End)

> This is the step-by-step recipe for adding any new feature — database to UI. Follow these steps in order, just like you would in MEAN stack.

---

### Step 1 — Define the Database Schema

**File**: `Backend/models/`

Create or extend an SQLAlchemy model. Each model maps to a database table.

```python
# Backend/models/notifications.py
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean
from sqlalchemy.orm import relationship
from database import Base
import datetime

class Notification(Base):
    __tablename__ = "notifications"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=False)
    message    = Column(String, nullable=False)
    is_read    = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.datetime.now(datetime.timezone.utc))

    user = relationship("User", back_populates="notifications")
```

Then register the relationship on the `User` model in `Backend/models/user.py`:

```python
notifications = relationship("Notification", back_populates="user")
```

---

### Step 2 — Create a Database Migration

**Folder**: `Backend/migrations/versions/`

Alembic tracks every schema change as a versioned file. Never change a deployed table manually.

```bash
# Inside the Backend container or your local venv:
cd Backend
alembic revision --autogenerate -m "add_notifications_table"
```

This generates a new file like `018_add_notifications_table.py`. Review the auto-generated `upgrade()` and `downgrade()` functions, then apply it:

```bash
alembic upgrade head
```

**Rule**: one migration = one logical change. Never edit existing migration files after they run in any environment.

---

### Step 3 — Define Pydantic Schemas

**File**: `Backend/models/schemas.py`

Pydantic schemas validate request bodies and shape response data. They are separate from SQLAlchemy models.

```python
# In Backend/models/schemas.py

class NotificationCreate(BaseModel):
    message: str

class NotificationResponse(BaseModel):
    id: int
    message: str
    is_read: bool
    created_at: datetime

    class Config:
        from_attributes = True
```

---

### Step 4 — Write the Service (Business Logic)

**Folder**: `Backend/services/`

Services contain all business logic. Routers only call services — they never query the database directly.

```python
# Backend/services/notification_service.py
from sqlalchemy.orm import Session
from models.notifications import Notification
from models.schemas import NotificationCreate

def create_notification(db: Session, user_id: int, data: NotificationCreate) -> Notification:
    notif = Notification(user_id=user_id, message=data.message)
    db.add(notif)
    db.commit()
    db.refresh(notif)
    return notif

def get_user_notifications(db: Session, user_id: int) -> list[Notification]:
    return db.query(Notification).filter(
        Notification.user_id == user_id
    ).order_by(Notification.created_at.desc()).all()

def mark_as_read(db: Session, notif_id: int, user_id: int) -> Notification | None:
    notif = db.query(Notification).filter(
        Notification.id == notif_id,
        Notification.user_id == user_id   # IDOR guard: always check ownership
    ).first()
    if notif:
        notif.is_read = True
        db.commit()
        db.refresh(notif)
    return notif
```

---

### Step 5 — Create the Router (API Endpoints)

**Folder**: `Backend/routers/`

The router exposes HTTP endpoints. It handles auth, rate limiting, and delegates to the service.

```python
# Backend/routers/notifications.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from services.auth_service import get_current_user
from services import notification_service
from models.schemas import NotificationCreate, NotificationResponse
from models.user import User

router = APIRouter(prefix="/notifications", tags=["notifications"])

@router.get("/", response_model=list[NotificationResponse])
def list_notifications(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return notification_service.get_user_notifications(db, current_user.id)

@router.post("/", response_model=NotificationResponse, status_code=201)
def create_notification(
    data: NotificationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return notification_service.create_notification(db, current_user.id, data)

@router.patch("/{notif_id}/read", response_model=NotificationResponse)
def mark_read(
    notif_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    notif = notification_service.mark_as_read(db, notif_id, current_user.id)
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    return notif
```

---

### Step 6 — Register the Router in main.py

**File**: `Backend/app/main.py`

```python
from routers import notifications   # add this import

# Inside create_app() where all routers are registered:
app.include_router(notifications.router)
```

---

### Step 7 — Write Tests

**Folder**: `Backend/tests/`

Always write tests before or alongside the feature. There are two levels:

**Unit test** (no DB, no HTTP):
```python
# Backend/tests/unit/test_notification_service.py
from unittest.mock import MagicMock
from services import notification_service
from models.schemas import NotificationCreate

def test_create_notification():
    db = MagicMock()
    data = NotificationCreate(message="Hello")
    # service should call db.add, db.commit, db.refresh
    notification_service.create_notification(db, user_id=1, data=data)
    db.add.assert_called_once()
    db.commit.assert_called_once()
```

**Integration test** (full HTTP + test DB):
```python
# Backend/tests/integration/test_notifications.py
def test_list_notifications_empty(client, user_token):
    resp = client.get(
        "/notifications/",
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert resp.status_code == 200
    assert resp.json() == []

def test_create_and_read_notification(client, user_token):
    resp = client.post(
        "/notifications/",
        json={"message": "Test notif"},
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert resp.status_code == 201
    notif_id = resp.json()["id"]

    resp2 = client.patch(
        f"/notifications/{notif_id}/read",
        headers={"Authorization": f"Bearer {user_token}"}
    )
    assert resp2.status_code == 200
    assert resp2.json()["is_read"] is True
```

Run tests:
```bash
cd Backend
pytest tests/ -v
# or a single file:
pytest tests/integration/test_notifications.py -v
```

---

### Step 8 — Add API Endpoint to Frontend API Layer

**File**: `frontend/src/api.ts`

```typescript
// In the relevant section or at the bottom of api.ts

export interface Notification {
  id: number;
  message: string;
  is_read: boolean;
  created_at: string;
}

export const notificationsApi = {
  list: (): Promise<Notification[]> =>
    api.get("/notifications/").then(r => r.data),

  create: (message: string): Promise<Notification> =>
    api.post("/notifications/", { message }).then(r => r.data),

  markRead: (id: number): Promise<Notification> =>
    api.patch(`/notifications/${id}/read`).then(r => r.data),
};
```

---

### Step 9 — Create the Frontend Page or Component

**Folder**: `frontend/src/pages/` or `frontend/src/components/`

```tsx
// frontend/src/pages/Notifications.tsx
import { useEffect, useState } from "react";
import { notificationsApi, Notification } from "../api";

export default function Notifications() {
  const [items, setItems] = useState<Notification[]>([]);

  useEffect(() => {
    notificationsApi.list().then(setItems);
  }, []);

  const handleMarkRead = async (id: number) => {
    const updated = await notificationsApi.markRead(id);
    setItems(prev => prev.map(n => n.id === id ? updated : n));
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Notifications</h1>
      {items.map(n => (
        <div key={n.id} className={`p-4 mb-2 rounded ${n.is_read ? "opacity-50" : "bg-white"}`}>
          <p>{n.message}</p>
          {!n.is_read && (
            <button onClick={() => handleMarkRead(n.id)} className="text-sm text-blue-500">
              Mark as read
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
```

---

### Step 10 — Register the Route in App.tsx

**File**: `frontend/src/App.tsx`

```tsx
import Notifications from "./pages/Notifications";

// Inside <Routes>:
<Route path="/notifications" element={<Notifications />} />
```

---

### Step 11 — Add Nginx Proxy Rule (if new route prefix)

**File**: `frontend/nginx.conf`

If your backend endpoint uses a new prefix (e.g., `/notifications`), add it to the nginx proxy block:

```nginx
location /notifications {
    proxy_pass http://backend:8000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

---

### Step 12 — Rebuild Docker and Test

```bash
# Rebuild and restart all services
docker compose down
docker compose up --build

# Or rebuild only the backend:
docker compose up --build backend

# View logs
docker compose logs -f backend
docker compose logs -f frontend
```

---

### Complete Feature Checklist

```
[ ] 1. SQLAlchemy model in Backend/models/
[ ] 2. Alembic migration in Backend/migrations/versions/
[ ] 3. Pydantic schemas in Backend/models/schemas.py
[ ] 4. Service in Backend/services/
[ ] 5. Router in Backend/routers/
[ ] 6. Register router in Backend/app/main.py
[ ] 7. Unit tests in Backend/tests/unit/
[ ] 8. Integration tests in Backend/tests/integration/
[ ] 9. API types and calls in frontend/src/api.ts
[10. Page or component in frontend/src/pages/ or components/
[11. Route in frontend/src/App.tsx
[12. Nginx proxy rule (if new URL prefix)
[13. Docker rebuild + smoke test
```

---

## 3. Project Folder Map

```
HireIQ/
│
├── Backend/                          ← Python FastAPI application
│   │
│   ├── app/
│   │   ├── main.py                   ← App factory: creates FastAPI, registers routers,
│   │   │                               adds middleware, health check at GET /health
│   │   └── config.py                 ← Loads all env vars via Pydantic Settings class
│   │
│   ├── routers/                      ← One file per feature domain (HTTP layer only)
│   │   ├── auth.py                   ← /auth/* — register, login, logout, OTP, password reset
│   │   ├── cv.py                     ← /cv/* — upload, sessions, score, report, delete
│   │   ├── analysis.py               ← /analyze — SSE streaming AI analysis
│   │   ├── interview.py              ← /interview/* — audio answer, eye-contact, history
│   │   ├── jobs.py                   ← /jobs/* — ATS kanban: CRUD + stats + contacts
│   │   ├── recruiter.py              ← /recruiter/* — shortlists, ranked candidates
│   │   ├── referrals.py              ← /referrals/* — referral links and leaderboard
│   │   ├── roadmap.py                ← /roadmap/* — AI career roadmap generation
│   │   ├── profile.py                ← /profile/* — user profile + avatar upload
│   │   ├── interview_bank.py         ← /interview-bank/* — curated question library
│   │   └── admin.py                  ← /admin/* — BI dashboard, audit logs, user mgmt
│   │
│   ├── services/                     ← Business logic layer (no HTTP, no direct DB calls in routers)
│   │   ├── auth_service.py           ← JWT creation/verification, bcrypt, JTI blacklist
│   │   ├── cv_parser.py              ← PDF text extraction (PyMuPDF) + spaCy NER
│   │   ├── rag_scorer.py             ← Sentence embeddings + ChromaDB + TF-IDF match scoring
│   │   ├── llm_analyzer.py           ← LangChain → Groq LLaMA: structured JSON analysis
│   │   ├── interview_engine.py       ← Groq Whisper transcription + answer scoring
│   │   ├── cv_vision.py              ← OpenCV: face detection + eye-contact ratio
│   │   ├── cache.py                  ← Redis wrapper (get/set match scores, 1hr TTL)
│   │   ├── report_generator.py       ← fpdf2 PDF report builder
│   │   ├── job_service.py            ← Job stats, status validation, stale detection
│   │   ├── email_service.py          ← Resend API: OTP emails, notifications
│   │   ├── otp_service.py            ← HMAC-SHA256 OTP generation + verification
│   │   ├── linkedin_service.py       ← LinkedIn PDF header detection
│   │   ├── roadmap_service.py        ← Career roadmap generation via Groq
│   │   ├── referral_service.py       ← Referral code CRUD + conversion tracking
│   │   ├── analytics_service.py      ← Admin metrics queries (MRR, churn, usage)
│   │   ├── admin_service.py          ← Admin user management operations
│   │   ├── security_service.py       ← Audit log writes + security event helpers
│   │   ├── token_tracker.py          ← LLM token quota tracking (free vs paid tier)
│   │   ├── profile_service.py        ← Profile CRUD + avatar file handling
│   │   └── interview_bank_service.py ← Question library queries + CSV import
│   │
│   ├── models/                       ← Database layer
│   │   ├── user.py                   ← User, CVSession, InterviewResult, OtpCode, UserProfile
│   │   ├── jobs.py                   ← JobApplication, ApplicationActivity, ApplicationContact
│   │   ├── roadmap.py                ← CareerRoadmap
│   │   ├── referral.py               ← ReferralCode, ReferralConversion
│   │   ├── security.py               ← SecurityAuditLog
│   │   ├── token_tracking.py         ← TokenUsage
│   │   ├── content.py                ← Static content / FAQ models
│   │   └── schemas.py                ← All Pydantic request + response schemas (100+ schemas)
│   │
│   ├── migrations/                   ← Alembic schema versioning
│   │   ├── alembic.ini               ← Alembic config (points to DATABASE_URL)
│   │   ├── env.py                    ← Connects Alembic to SQLAlchemy metadata
│   │   ├── script.py.mako            ← Template for generated migration files
│   │   └── versions/                 ← 17 numbered migration files (001 → 017)
│   │
│   ├── rag/
│   │   └── prompts.py                ← LangChain PromptTemplate strings for LLM calls
│   │
│   ├── middleware/
│   │   ├── security_headers.py       ← Injects HSTS, CSP, X-Frame-Options into every response
│   │   └── csrf.py                   ← Validates X-Requested-With header on state-changing requests
│   │
│   ├── tests/
│   │   ├── conftest.py               ← Shared fixtures: test DB, HTTP client, auth tokens
│   │   ├── unit/                     ← Pure function tests (no HTTP, no real DB)
│   │   └── integration/              ← Full endpoint tests against in-memory SQLite
│   │
│   ├── data/questions/               ← CSV files for seeding the interview question bank
│   ├── scripts/                      ← One-off utility scripts (seed data, migrations helpers)
│   ├── uploads/                      ← Runtime file storage (CV PDFs, avatar images)
│   │
│   ├── database.py                   ← SQLAlchemy engine + SessionLocal factory + get_db dependency
│   ├── limiter.py                    ← slowapi Limiter instance (shared across routers)
│   ├── Dockerfile                    ← Multi-layer Python image build
│   ├── requirements.txt              ← Python dependencies (pinned versions)
│   ├── .env.example                  ← All required env vars with descriptions
│   └── .env.docker                   ← Overrides for Docker network (localhost → service names)
│
├── frontend/                         ← React 19 + TypeScript SPA
│   ├── src/
│   │   ├── pages/                    ← One component per route (16 pages)
│   │   ├── components/               ← Reusable UI components (20+)
│   │   ├── hooks/
│   │   │   ├── useWebcam.ts          ← getUserMedia stream manager
│   │   │   └── useRecorder.ts        ← MediaRecorder → Blob
│   │   ├── lib/
│   │   │   ├── constants.ts          ← API base URL, endpoint strings, JD templates
│   │   │   └── utils.ts              ← Date formatting, type guards, class name helpers
│   │   ├── api.ts                    ← Axios instance + all API call functions + TS types
│   │   ├── App.tsx                   ← React Router setup + global auth state
│   │   └── main.tsx                  ← React entry point (renders <App /> to DOM)
│   │
│   ├── public/                       ← Static files (favicon, og-image, etc.)
│   ├── dist/                         ← Built output (created by npm run build)
│   ├── Dockerfile                    ← 2-stage build: Node builder → Nginx server
│   ├── nginx.conf                    ← SPA routing + API proxy rules
│   ├── vite.config.ts                ← Vite bundler configuration
│   ├── package.json                  ← Frontend dependencies + scripts
│   └── tsconfig.json                 ← TypeScript compiler options
│
├── specs/                            ← Feature specifications and implementation plans
│   ├── 001-production-saas-launch/   ← Phases 1–9 design documents
│   └── 002-enhance-features-phase2/  ← Phases 10–14 design documents
│
├── docker-compose.yml                ← Orchestrates all 6 services
├── CLAUDE.md                         ← Claude Code project instructions
├── DEPLOY.md                         ← Production deployment steps
├── FEATURE_MAP.md                    ← Feature completion matrix
├── AGENTS.md                         ← AI agent configuration
└── Readme.md                         ← Project overview
```

---

## 4. Database: Schema, Migrations & Design

### 4.1 Complete Schema

```
┌──────────────────┐     ┌──────────────────────┐     ┌───────────────────────┐
│      users       │     │     cv_sessions       │     │   interview_results   │
├──────────────────┤     ├──────────────────────┤     ├───────────────────────┤
│ id (PK)          │────►│ id (PK)               │────►│ id (PK)               │
│ email (unique)   │     │ user_id (FK→users)    │     │ session_id (FK→cv)    │
│ username (unique)│     │ cv_filename           │     │ question              │
│ hashed_password  │     │ original_cv_filename  │     │ transcript            │
│ email_verified   │     │ jd_text               │     │ clarity_score         │
│ failed_login_cnt │     │ match_score           │     │ relevance_score       │
│ locked_until     │     │ skill_inventory (JSON)│     │ depth_score           │
│ sessions_revoked │     │ gap_report (JSON)     │     │ eye_contact_ratio     │
│ is_admin         │     │ study_roadmap (JSON)  │     │ created_at            │
│ tier             │     │ ai_interview_qs (JSON)│     └───────────────────────┘
│ created_at       │     │ is_linkedin           │
└──────────────────┘     │ created_at            │
         │               └──────────────────────┘
         │
         ├──────────────────────────────────────────────────────────┐
         │                                                          │
         ▼                                                          ▼
┌──────────────────┐     ┌──────────────────────┐     ┌──────────────────────┐
│   otp_codes      │     │   user_profiles       │     │  job_applications    │
├──────────────────┤     ├──────────────────────┤     ├──────────────────────┤
│ id (PK)          │     │ id (PK)               │     │ id (PK)              │
│ email            │     │ user_id (FK→users)    │     │ user_id (FK→users)   │
│ user_id (FK)     │     │ stored_cv_path        │     │ cv_session_id (FK)   │
│ code_hmac        │     │ linkedin_url          │     │ company              │
│ purpose          │     │ github_url            │     │ title                │
│ expires_at       │     │ portfolio_url         │     │ location             │
│ attempt_count    │     │ bio                   │     │ remote_type          │
│ used_at          │     │ avatar_url            │     │ job_url              │
└──────────────────┘     │ updated_at            │     │ jd_text              │
                         └──────────────────────┘     │ status               │
                                                       │ stage_entered_at     │
                                                       │ source / priority    │
                                                       │ applied_date         │
                                                       │ deadline_date        │
                                                       │ followup_date        │
                                                       │ notes / cover_letter │
                                                       │ match_score          │
                                                       │ ai_gap_summary       │
                                                       │ ai_prep_questions    │
                                                       │ is_archived          │
                                                       │ created_at/updated_at│
                                                       └──────────────────────┘
                                                                  │
                              ┌───────────────────────────────────┤
                              │                                   │
                              ▼                                   ▼
                   ┌──────────────────────┐          ┌──────────────────────┐
                   │ application_activities│         │  application_contacts│
                   ├──────────────────────┤          ├──────────────────────┤
                   │ id (PK)              │          │ id (PK)              │
                   │ job_application_id   │          │ job_application_id   │
                   │ user_id (FK)         │          │ name / email / phone │
                   │ event_type           │          │ relationship / notes │
                   │ event_date           │          └──────────────────────┘
                   │ notes / created_at   │
                   └──────────────────────┘

┌──────────────────┐     ┌──────────────────────┐     ┌──────────────────────┐
│  career_roadmaps │     │   referral_codes      │     │ referral_conversions │
├──────────────────┤     ├──────────────────────┤     ├──────────────────────┤
│ id (PK)          │     │ id (PK)               │     │ id (PK)              │
│ user_id (FK)     │     │ user_id (FK→users)    │     │ referrer_id (FK)     │
│ cv_session_id(FK)│     │ code (unique)         │     │ convertee_id (FK)    │
│ target_role      │     │ created_at            │     │ converted_at         │
│ roadmap_data(JSON│     └──────────────────────┘     └──────────────────────┘
│ created_at       │
└──────────────────┘

┌──────────────────────┐     ┌──────────────────────┐
│  security_audit_logs │     │    token_usage        │
├──────────────────────┤     ├──────────────────────┤
│ id (PK)              │     │ id (PK)               │
│ user_id (FK)         │     │ user_id (FK)          │
│ event_type (18 types)│     │ session_id (FK)       │
│ resource_id          │     │ event_type            │
│ details (JSON)       │     │ token_count           │
│ ip_address           │     │ created_at            │
│ created_at           │     └──────────────────────┘
└──────────────────────┘
```

### 4.2 Status Enums

**Job Application Status** (Kanban columns):
```
saved → applied → interviewing → offer → accepted
                                       → rejected
```

**User Tier**:
```
free → pro → recruiter
```

**Security Audit Event Types** (18 types):
```
login_success, login_failed, logout, register,
password_reset_request, password_reset_complete,
otp_sent, otp_verified, otp_failed,
email_verified, cv_uploaded, cv_deleted,
job_created, job_deleted, account_deleted,
admin_action, suspicious_activity, token_quota_exceeded
```

### 4.3 Migrations Folder Deep Dive

**Location**: `Backend/migrations/`

```
migrations/
├── alembic.ini          ← Points to DATABASE_URL, sets migration file location
├── env.py               ← Imports all SQLAlchemy models so Alembic can detect schema changes
├── script.py.mako       ← Jinja2 template used when generating new migration files
└── versions/
    ├── 001_initial.py                        ← users, cv_sessions, interview_results
    ├── 002_auth_hardening.py                 ← email_verified, failed_login_count, locked_until
    ├── 003_cv_session_extended.py            ← skill_inventory, gap_report, study_roadmap columns
    ├── 004_jobs_recruiter.py                 ← job_applications, activities, contacts tables
    ├── 005_user_sessions_revoked_at.py       ← sessions_revoked_at for logout-all
    ├── 006_recruiter_tables.py               ← recruiter_lists, recruiter_candidates
    ├── 007_referrals.py                      ← referral_codes, referral_conversions
    ├── 008_career_roadmap.py                 ← career_roadmaps table
    ├── 009_otp_codes.py                      ← otp_codes table
    ├── 010_user_profiles.py                  ← user_profiles table
    ├── 012_interview_bank.py                 ← interview_question_bank table
    ├── 013_token_tracking.py                 ← token_usage table
    ├── 014_recruiter_candidate_fields.py     ← Additional fields on recruiter candidates
    ├── 015_recruiter_standalone_candidates.py← Standalone candidate support (no CV session)
    ├── 016_cv_session_interview_questions.py ← ai_interview_questions column on cv_sessions
    └── 017_cv_session_original_filename.py   ← original_cv_filename column
```

**How migrations work**:
1. Each file has `upgrade()` (apply) and `downgrade()` (rollback) functions
2. Alembic tracks which migrations ran in a `alembic_version` table in PostgreSQL
3. `alembic upgrade head` applies all pending migrations in order
4. `alembic downgrade -1` rolls back the last migration
5. The Docker backend `CMD` runs `alembic upgrade head` before starting Uvicorn — this ensures the DB is always up-to-date on deploy

**Migration file anatomy**:
```python
"""add_notifications_table

Revision ID: abc123
Revises: prev_id
Create Date: 2025-01-01
"""
from alembic import op
import sqlalchemy as sa

def upgrade() -> None:
    op.create_table(
        "notifications",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("user_id", sa.Integer, sa.ForeignKey("users.id"), nullable=False),
        sa.Column("message", sa.String, nullable=False),
        sa.Column("is_read", sa.Boolean, default=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )

def downgrade() -> None:
    op.drop_table("notifications")
```

---

## 5. API Design & All Endpoints

> All endpoints require `Authorization: Bearer <access_token>` unless marked **[public]**.

### Auth — `/auth`

| Method | Path                    | Description                                  |
|--------|-------------------------|----------------------------------------------|
| POST   | /auth/register          | Create account, send OTP email [public]      |
| POST   | /auth/login             | Password login → access + refresh tokens [public] |
| POST   | /auth/logout            | Blacklist current JWT                        |
| POST   | /auth/refresh           | Exchange refresh token for new access token  |
| GET    | /auth/me                | Current user info                            |
| POST   | /auth/send-otp          | Resend OTP to email                          |
| POST   | /auth/verify-otp        | Verify OTP code → mark email verified        |
| POST   | /auth/forgot-password   | Send password reset OTP [public]             |
| POST   | /auth/reset-password    | Set new password with OTP token [public]     |
| DELETE | /auth/account           | Delete user account + all data               |

### CV — `/cv`

| Method | Path                    | Description                                          |
|--------|-------------------------|------------------------------------------------------|
| POST   | /cv/upload              | Upload CV PDF + JD text → score + create session     |
| GET    | /cv/sessions            | List all user sessions                               |
| GET    | /cv/{id}/detail         | Full session detail with interview results           |
| GET    | /cv/{id}/score          | Cached match score (Redis, 1hr TTL)                  |
| GET    | /cv/{id}/report         | Download PDF analysis report                         |
| DELETE | /cv/{id}                | Delete session and associated files                  |
| POST   | /cv/save-questions      | Save AI-generated interview questions to session     |

### Analysis — `/analyze`

| Method | Path       | Description                                              |
|--------|------------|----------------------------------------------------------|
| GET    | /analyze   | SSE stream of AI analysis (token in query param for EventSource) |

### Interview — `/interview`

| Method | Path                    | Description                                          |
|--------|-------------------------|------------------------------------------------------|
| POST   | /interview/answer       | Submit audio → transcribe → score answer             |
| POST   | /interview/eye-contact  | Submit webcam frame → return eye-contact ratio       |
| GET    | /interview/history      | All past interview results for current user          |

### Jobs (ATS) — `/jobs`

| Method | Path                        | Description                                    |
|--------|-----------------------------|------------------------------------------------|
| GET    | /jobs                       | List all job applications (filter/sort/search) |
| POST   | /jobs                       | Create new job application                     |
| GET    | /jobs/stats                 | Funnel analytics (counts per status)           |
| GET    | /jobs/upcoming              | Deadlines + followups within 7 days            |
| GET    | /jobs/stale                 | No activity in 14+ days                        |
| GET    | /jobs/{id}                  | Single job application detail                  |
| PATCH  | /jobs/{id}                  | Update job application fields                  |
| DELETE | /jobs/{id}                  | Delete job application                         |
| PATCH  | /jobs/{id}/status           | Change status (validates transitions)          |
| POST   | /jobs/{id}/activities       | Log activity (call, email, interview)          |
| GET    | /jobs/{id}/activities       | List activities timeline                       |
| POST   | /jobs/{id}/contacts         | Add contact to job                             |
| GET    | /jobs/{id}/contacts         | List contacts                                  |
| DELETE | /jobs/{id}/contacts/{cid}   | Remove contact                                 |
| POST   | /jobs/{id}/analyze          | AI gap analysis for this job                   |
| GET    | /jobs/{id}/prep             | AI interview prep questions                    |

### Recruiter — `/recruiter`

| Method | Path                                | Description                               |
|--------|-------------------------------------|-------------------------------------------|
| GET    | /recruiter/shortlists               | List all shortlists                       |
| POST   | /recruiter/shortlists               | Create shortlist                          |
| PATCH  | /recruiter/shortlists/{id}          | Update shortlist                          |
| DELETE | /recruiter/shortlists/{id}          | Delete shortlist                          |
| POST   | /recruiter/shortlists/{id}/candidates | Add candidate                           |
| DELETE | /recruiter/shortlists/{id}/candidates/{cid} | Remove candidate               |
| GET    | /recruiter/shortlists/{id}/export   | Download PDF shortlist report             |
| GET    | /recruiter/candidates               | All candidates across shortlists          |

### Referrals — `/referrals`

| Method | Path                    | Description                                          |
|--------|-------------------------|------------------------------------------------------|
| GET    | /referrals              | Current user's referral link + stats                 |
| GET    | /referrals/leaderboard  | Top referrers [public]                               |
| POST   | /referrals/track        | Record referral conversion [public]                  |

### Roadmap — `/roadmap`

| Method | Path                | Description                                              |
|--------|---------------------|----------------------------------------------------------|
| POST   | /roadmap/generate   | Generate career roadmap from CV session via LLM          |
| GET    | /roadmap            | List all saved roadmaps                                  |
| GET    | /roadmap/{id}       | Single roadmap with phases + quick wins                  |

### Profile — `/profile`

| Method | Path              | Description                                              |
|--------|-------------------|----------------------------------------------------------|
| GET    | /profile          | Current user profile                                     |
| PATCH  | /profile          | Update profile fields                                    |
| POST   | /profile/avatar   | Upload avatar image                                      |

### Interview Bank — `/interview-bank`

| Method | Path                   | Description                                         |
|--------|------------------------|-----------------------------------------------------|
| GET    | /interview-bank        | List questions (filter by role, difficulty, type)   |
| GET    | /interview-bank/{id}   | Single question detail                              |

### Admin — `/admin`

| Method | Path              | Description                                              |
|--------|-------------------|----------------------------------------------------------|
| GET    | /admin/tokens     | LLM token quota metrics                                  |
| GET    | /admin/analytics  | Platform metrics: users, MRR, churn, session stats       |
| GET    | /admin/audit      | Security audit log (paginated)                           |
| GET    | /admin/users      | User management list                                     |

### Health

| Method | Path      | Description                     |
|--------|-----------|---------------------------------|
| GET    | /health   | Service liveness check [public] |

---

## 6. How Tests Work

### Structure

```
Backend/tests/
├── conftest.py           ← Fixtures shared by all tests
├── unit/                 ← Fast, no I/O, pure logic tests
│   ├── test_auth_service.py
│   ├── test_otp_service.py
│   ├── test_llm_analyzer.py
│   ├── test_job_service.py
│   ├── test_roadmap_service.py
│   ├── test_referral_service.py
│   ├── test_analytics_service.py
│   ├── test_security_service.py
│   └── test_token_tracker.py
└── integration/          ← Full HTTP + real DB (in-memory SQLite)
    ├── test_auth.py
    ├── test_auth_otp.py
    ├── test_cv.py
    ├── test_jobs.py
    ├── test_recruiter.py
    ├── test_referrals.py
    ├── test_roadmap.py
    ├── test_profile.py
    ├── test_interview.py
    ├── test_interview_bank.py
    ├── test_admin.py
    ├── test_admin_tokens.py
    └── test_security.py
```

### conftest.py — Shared Fixtures

```python
# What conftest.py provides to every test:

@pytest.fixture
def db()          # In-memory SQLite session (fresh per test)

@pytest.fixture
def client()      # FastAPI TestClient with test DB injected

@pytest.fixture
def admin_token() # Pre-created admin user JWT

@pytest.fixture
def user_token()  # Pre-created regular user JWT

@pytest.fixture
def user_id()     # The ID of the test regular user
```

The test DB uses SQLite (`sqlite:///./test.db`) instead of PostgreSQL — it's fast and requires no Docker for running tests. The `db` fixture creates all tables before each test and drops them after.

### Unit Tests

Unit tests test individual service functions in isolation using `unittest.mock`:

```python
# Example: test_auth_service.py
from unittest.mock import MagicMock, patch
from services.auth_service import hash_password, verify_password

def test_hash_and_verify():
    pw = "MySecret123"
    hashed = hash_password(pw)
    assert verify_password(pw, hashed) is True
    assert verify_password("wrong", hashed) is False

def test_create_tokens():
    tokens = create_tokens(user_id=1, email="a@b.com")
    assert "access_token" in tokens
    assert "refresh_token" in tokens
```

### Integration Tests

Integration tests send real HTTP requests to FastAPI using TestClient:

```python
# Example: test_jobs.py
def test_full_job_lifecycle(client, user_token):
    headers = {"Authorization": f"Bearer {user_token}"}

    # Create
    resp = client.post("/jobs", json={"company": "Acme", "title": "Dev"}, headers=headers)
    assert resp.status_code == 201
    job_id = resp.json()["id"]

    # Update status
    resp = client.patch(f"/jobs/{job_id}/status", json={"status": "applied"}, headers=headers)
    assert resp.status_code == 200

    # IDOR check: another user should NOT see this job
    other_token = create_other_user_token(client)
    resp = client.get(f"/jobs/{job_id}", headers={"Authorization": f"Bearer {other_token}"})
    assert resp.status_code == 404  # not 403 — don't leak existence

    # Delete
    resp = client.delete(f"/jobs/{job_id}", headers=headers)
    assert resp.status_code == 204
```

### Running Tests

```bash
cd Backend

# All tests
pytest tests/ -v

# Only unit tests
pytest tests/unit/ -v

# Only integration tests
pytest tests/integration/ -v

# Single file
pytest tests/integration/test_jobs.py -v

# With coverage report
pytest tests/ --cov=. --cov-report=html

# Run inside Docker
docker compose exec backend pytest tests/ -v
```

### Test Results

Current status: **221 pass, 1 skipped** (Paymob webhook test is skipped — requires live Paymob credentials).

---

## 7. System Code Flow (Request Lifecycle)

### 7.1 Authentication Flow

```
Browser
  │
  │  POST /auth/login  {email, password}
  ▼
Nginx (port 3000)
  │  proxy_pass → backend:8000
  ▼
FastAPI (routers/auth.py)
  │
  ├── 1. Validate request body via Pydantic schema (LoginRequest)
  ├── 2. Call auth_service.authenticate_user(db, email, password)
  │       ├── Query User by email
  │       ├── Check account not locked (locked_until < now)
  │       ├── bcrypt.verify(password, user.hashed_password)
  │       ├── If wrong: increment failed_login_count, lock if >= 5
  │       └── Return user or raise 401
  ├── 3. Call auth_service.create_tokens(user_id, email)
  │       ├── Access token (JWT, 30min expiry, contains jti claim)
  │       └── Refresh token (JWT, 7d expiry)
  ├── 4. Write SecurityAuditLog(event_type="login_success")
  └── 5. Return {access_token, refresh_token, token_type: "bearer"}

Browser stores tokens in localStorage
```

### 7.2 Authenticated Request Flow (e.g., GET /cv/sessions)

```
Browser
  │
  │  GET /cv/sessions
  │  Headers: Authorization: Bearer <access_token>
  │           X-Requested-With: XMLHttpRequest   (CSRF header)
  ▼
Nginx
  │  proxy_pass → backend:8000
  ▼
FastAPI Middleware Stack (applied in reverse order)
  │
  ├── 1. SecurityHeadersMiddleware — adds HSTS, CSP, etc. to response
  ├── 2. CSRFMiddleware — validates X-Requested-With header
  └── 3. CORSMiddleware — validates Origin header
  │
  ▼
FastAPI (routers/cv.py → list_sessions endpoint)
  │
  ├── 4. Depends(get_current_user) — dependency injection:
  │       ├── Extract Bearer token from Authorization header
  │       ├── Decode JWT → get user_id + jti
  │       ├── Check Redis: jti not in blacklist (not logged out)
  │       ├── Check user.sessions_revoked_at (not password-reset)
  │       └── Query DB → return User object
  │
  ├── 5. Depends(get_db) — dependency injection:
  │       └── Yield SQLAlchemy session, close it after response
  │
  ├── 6. Call cv_service.get_user_sessions(db, current_user.id)
  │       └── db.query(CVSession).filter(CVSession.user_id == user_id).all()
  │
  └── 7. Serialize via Pydantic response_model → JSON
        Return 200 [{id, cv_filename, match_score, created_at}, ...]
```

### 7.3 CV Upload & AI Scoring Flow

```
Browser
  │
  │  POST /cv/upload
  │  Body: multipart/form-data (cv_file PDF, jd_text string)
  ▼
FastAPI (routers/cv.py)
  │
  ├── 1. Rate limit check: 2 uploads/minute per IP (slowapi)
  ├── 2. Auth: get_current_user
  ├── 3. Token quota check (free tier: 2 analyses per 10 days)
  │
  ├── 4. cv_parser.extract_text(cv_file)
  │       ├── Validate MIME type (PDF magic bytes: %PDF)
  │       ├── Validate file size (< 10MB)
  │       ├── pymupdf: extract raw text from all pages
  │       └── spaCy NER: extract skills, job titles, education
  │
  ├── 5. linkedin_service.is_linkedin_pdf(text) → bool flag
  │
  ├── 6. rag_scorer.compute_match_score(cv_text, jd_text)
  │       ├── sentence-transformers: embed CV text
  │       ├── sentence-transformers: embed JD text
  │       ├── ChromaDB: store embeddings with session_id
  │       ├── Cosine similarity between embeddings
  │       ├── TF-IDF keyword overlap score
  │       └── Weighted average → match_score (0-100)
  │
  ├── 7. Save cv_file to uploads/
  │
  ├── 8. db: Create CVSession(user_id, cv_filename, jd_text, match_score)
  │
  ├── 9. cache.set(f"score:{session_id}", match_score, ttl=3600)
  │
  └── 10. Return {session_id, match_score, redirect to /results/{id}}

  ── User then hits GET /analyze (SSE) ──

FastAPI (routers/analysis.py)
  │
  ├── 11. SSE connection opens (token in query param, EventSource can't set headers)
  │
  ├── 12. llm_analyzer.stream_analysis(cv_text, jd_text)
  │       ├── LangChain PromptTemplate (from rag/prompts.py)
  │       ├── Groq API: llama-3.3-70b-versatile
  │       └── Stream tokens as they arrive
  │
  ├── 13. Yield SSE events: data: {type: "token", content: "..."}
  │         Final event:    data: {type: "done", structured: {skills, gaps, score}}
  │
  └── 14. Update CVSession with skill_inventory, gap_report, study_roadmap
```

### 7.4 Interview Flow

```
Browser (Interview.tsx)
  │
  ├── useWebcam() → getUserMedia({video: true, audio: true})
  ├── useRecorder() → MediaRecorder records 60s chunks
  │
  │  POST /interview/answer
  │  Body: multipart (audio_file WebM, session_id, question_text)
  ▼
FastAPI (routers/interview.py)
  │
  ├── 1. Rate limit: 5 answers/minute
  ├── 2. Auth check
  ├── 3. Save audio to uploads/
  │
  ├── 4. interview_engine.transcribe(audio_file)
  │       └── Groq Whisper API: whisper-large-v3 → text transcript
  │
  ├── 5. interview_engine.score_answer(question, transcript, jd_text)
  │       └── Groq LLaMA 3: score clarity(0-10), relevance(0-10), depth(0-10)
  │
  │  POST /interview/eye-contact (parallel, from webcam frames)
  ├── 6. cv_vision.analyze_eye_contact(frame_bytes)
  │       ├── OpenCV: detect face (Haar cascade)
  │       ├── OpenCV: detect eyes within face region
  │       └── eye_contact_ratio = frames_with_eye_contact / total_frames
  │
  ├── 7. db: Create InterviewResult(session_id, question, transcript,
  │                                 clarity, relevance, depth, eye_contact)
  │
  └── 8. Return {transcript, clarity_score, relevance_score, depth_score}
```

### 7.5 Frontend → Backend Data Flow

```
frontend/src/api.ts
│
│  Axios instance:
│    baseURL = import.meta.env.VITE_API_URL || "/api"
│    interceptors.request:
│      ├── Attach Authorization: Bearer <localStorage token>
│      └── Attach X-Requested-With: XMLHttpRequest
│    interceptors.response:
│      ├── On 401: attempt silent token refresh → retry original request
│      ├── On network error: emit "offline" event
│      └── On 403: redirect to login
│
▼
All API calls are typed functions in api.ts:
  cvApi.upload(formData)          → POST /cv/upload
  cvApi.getSessions()             → GET /cv/sessions
  analysisApi.stream(sessionId)   → GET /analyze (SSE via EventSource)
  interviewApi.submitAnswer(...)  → POST /interview/answer
  jobsApi.create(data)            → POST /jobs
  ...
```

---

## 8. Docker & Infrastructure

### Services Map

```
┌─────────────────────────────────────────────────────────────┐
│                    docker-compose.yml                        │
│                                                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                  │
│  │ postgres │  │  redis   │  │ chromadb │                  │
│  │ :5432    │  │  :6379   │  │  :8000   │                  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                  │
│       │healthy      │healthy       │healthy                  │
│       └─────────────┴──────────────┘                        │
│                           │ depends_on                       │
│                    ┌──────┴──────┐                          │
│                    │   backend   │                          │
│                    │   :8000     │                          │
│                    └──────┬──────┘                          │
│                           │ depends_on (healthy)            │
│                    ┌──────┴──────┐                          │
│                    │  frontend   │◄── Browser (port 3000)  │
│                    │  :3000/80   │                          │
│                    └─────────────┘                          │
│                                                              │
│  ┌──────────┐                                                │
│  │ adminer  │ (DB admin UI, port 8080, internal only)       │
│  └──────────┘                                                │
└─────────────────────────────────────────────────────────────┘
```

### Backend Dockerfile

```dockerfile
FROM python:3.11-slim

# System deps for ML libraries
RUN apt-get install -y gcc libpq-dev curl libgomp1

# PyTorch CPU-only (avoid the 2GB GPU build)
RUN pip install torch --index-url https://download.pytorch.org/whl/cpu

# App dependencies (cached layer — only rebuilds if requirements.txt changes)
COPY requirements.txt .
RUN pip install -r requirements.txt

# Download spaCy NER model
RUN python -m spacy download en_core_web_sm

COPY . .

# Run migrations THEN start server
CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
```

### Frontend Dockerfile (Multi-stage)

```dockerfile
# Stage 1: Build the React app
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json .
RUN npm ci                    # install exact versions from package-lock.json
COPY . .
RUN npm run build             # output → /app/dist

# Stage 2: Serve with Nginx
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

### Nginx proxy rules (nginx.conf)

```nginx
server {
    listen 80;

    # Serve SPA — all unknown routes → index.html (React Router handles them)
    location / {
        root   /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
    }

    # Cache built assets for 1 year (Vite hashes filenames)
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Proxy all API calls to backend
    location ~ ^/(auth|cv|analyze|interview|jobs|recruiter|referrals|roadmap|profile|interview-bank|admin|notifications|health) {
        proxy_pass http://backend:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # SSE: disable buffering so tokens stream immediately
    location /analyze {
        proxy_pass http://backend:8000;
        proxy_buffering off;
        proxy_cache off;
        proxy_set_header Connection "";
        chunked_transfer_encoding on;
    }
}
```

### Common Docker Commands

```bash
# Start everything
docker compose up

# Rebuild after code changes
docker compose up --build

# Rebuild only one service
docker compose up --build backend

# View logs
docker compose logs -f
docker compose logs -f backend

# Run tests inside container
docker compose exec backend pytest tests/ -v

# Run a migration manually
docker compose exec backend alembic upgrade head

# Open a Python shell in backend
docker compose exec backend python

# Open PostgreSQL shell
docker compose exec postgres psql -U hireiq_user -d hireiq

# Stop everything
docker compose down

# Stop and delete volumes (full reset)
docker compose down -v
```

---

## 9. Frontend Architecture

### Page → Component → API hierarchy

```
App.tsx (Router + auth state)
│
├── Landing.tsx            (public)
│   └── No API calls — static marketing content
│
├── Auth.tsx               (public)
│   ├── authApi.register()
│   ├── authApi.login()    → store tokens in localStorage
│   └── Navigate to /verify-otp or /dashboard
│
├── Dashboard.tsx
│   ├── cvApi.getSessions()
│   ├── ScoreGauge component (recharts)
│   └── SkillGapChart component (recharts)
│
├── Upload.tsx
│   ├── cvApi.upload(formData)
│   └── Navigate to /results/{sessionId}
│
├── Results.tsx
│   ├── cvApi.getScore(sessionId)     → match score gauge
│   ├── analysisApi.stream(sessionId) → EventSource (SSE)
│   │   └── Updates UI token-by-token as LLM generates
│   └── FeedbackPanel component
│
├── Interview.tsx
│   ├── useWebcam() hook
│   ├── useRecorder() hook
│   ├── interviewApi.submitAnswer()
│   ├── interviewApi.submitEyeContact()
│   └── FeedbackPanel component
│
├── Jobs.tsx (ATS Kanban)
│   ├── jobsApi.list()
│   ├── jobsApi.updateStatus()   → drag-and-drop columns
│   └── JobCard component
│
└── Admin.tsx
    ├── adminApi.getAnalytics()
    ├── adminApi.getAuditLog()
    └── recharts (BarChart, LineChart)
```

### Token Refresh Flow (api.ts interceptor)

```
Request fails with 401
    │
    ▼
interceptors.response catches 401
    │
    ▼
Call POST /auth/refresh with refresh_token from localStorage
    │
    ├── Success: store new access_token → retry original request
    └── Failure: clear localStorage → redirect to /auth
```

---

## 10. Security Architecture

### Defense-in-Depth Layers

```
Layer 1: TRANSPORT
  └── HTTPS (TLS) in production (configured in nginx/reverse proxy)

Layer 2: AUTH
  └── JWT (HS256, 30min expiry)
  └── Refresh token (7d, stored in localStorage)
  └── JTI blacklist in Redis on logout
  └── sessions_revoked_at: invalidates all tokens on password reset

Layer 3: RATE LIMITING (slowapi)
  └── /cv/upload: 2/minute
  └── /interview/answer: 5/minute
  └── /auth/login: 10/minute (per IP)

Layer 4: INPUT VALIDATION
  └── Pydantic schemas validate all request bodies
  └── PDF magic bytes check (MIME validation)
  └── 10MB file size limit

Layer 5: AUTHORIZATION (IDOR Prevention)
  └── Every resource query adds .filter(resource.user_id == current_user.id)
  └── Return 404 (not 403) to avoid leaking resource existence

Layer 6: ACCOUNT SECURITY
  └── bcrypt cost-12 password hashing
  └── 5 failed attempts → 15min lockout
  └── OTP: HMAC-SHA256 hashed, 10min expiry, max 5 attempts

Layer 7: CSRF
  └── CSRFMiddleware validates X-Requested-With header on POST/PATCH/DELETE

Layer 8: SECURITY HEADERS
  └── HSTS, CSP, X-Frame-Options: DENY, X-Content-Type-Options: nosniff

Layer 9: AUDIT LOGGING
  └── All auth events + admin actions → SecurityAuditLog table

Layer 10: ERROR HANDLING
  └── No stack traces in API responses
  └── UUID error references (errors logged server-side only)
```

---

## 11. Configuration & Startup Details

These patterns are easy to miss but important when debugging or deploying.

### 11.1 How Settings Work (Pydantic BaseSettings)

`config.py` uses **`pydantic_settings.BaseSettings`**. This means:

- Every field in the `Settings` class maps **directly to an env var name** (same name, case-insensitive)
- Values are loaded from `.env` file first, then from the actual OS environment (OS wins)
- `extra="ignore"` means extra env vars in `.env` are silently skipped — no errors
- The `settings` object is a **singleton** — imported and used everywhere:

```python
from app.config import settings

print(settings.groq_api_key)   # reads GROQ_API_KEY from environment
print(settings.redis_url)      # reads REDIS_URL, or "redis://localhost:6379" default
```

So when you add a new env var to the system, you add it here and access it via `settings.your_var` — never call `os.getenv()` directly in service files.

### 11.2 Enabling Swagger / OpenAPI Docs

The API docs (`/docs`, `/redoc`) are **disabled by default in production**. They only work when `DEBUG=true`:

```python
# main.py
_debug = os.getenv("DEBUG", "false").lower() == "true"
app = FastAPI(
    docs_url="/docs" if _debug else None,   # ← disabled unless DEBUG=true
    redoc_url="/redoc" if _debug else None,
    openapi_url="/openapi.json" if _debug else None,
)
```

To enable during local development, add to `Backend/.env`:
```
DEBUG=true
```

Then visit `http://localhost:8000/docs` for the interactive Swagger UI.

### 11.3 Middleware Registration Order (Matters)

In FastAPI, middleware is applied in **reverse registration order** (last registered = outermost). The order in `main.py` is intentional:

```python
app.add_middleware(SecurityHeadersMiddleware)  # registered first → runs last (innermost)
app.add_middleware(CSRFMiddleware)             # runs second-to-last
app.add_middleware(CORSMiddleware, ...)        # registered last → runs first (outermost)
```

This means CORS preflight is handled before CSRF checks — which is correct. Never reorder these.

### 11.4 Logging Modes

`configure_logging()` in `config.py` sets up **Loguru** with two modes controlled by `LOG_FORMAT`:

| `LOG_FORMAT` | Output | Use for |
|---|---|---|
| `text` (default) | Colorized `HH:mm:ss \| LEVEL \| message` | Local development |
| `json` | Structured JSON per line | Production (log aggregation tools like Datadog, Loki) |

Set in `.env`:
```
LOG_FORMAT=json   # for production
LOG_FORMAT=text   # for local dev (default)
```

### 11.5 `app_base_url` — Required for Email Links

The `app_base_url` setting (default: `http://localhost:3000`) is injected into OTP and password-reset emails as the clickable link. In production this **must** be set to the real public domain:

```
app_base_url=https://hireiq.app
```

If left as localhost in production, email links will point to the user's own machine and won't work.

### 11.6 `create_tables()` — Do NOT Use in Production

`database.py` has a `create_tables()` function that calls `Base.metadata.create_all()`. This will create tables if they don't exist but **does not track versions or run migrations**. It is a last-resort fallback only.

Always use Alembic instead:
```bash
alembic upgrade head   # correct way — versioned, reversible
```

`create_tables()` exists only as a safety net for isolated test environments where Alembic is not configured. The Docker `CMD` already runs `alembic upgrade head` on startup — you should never need to call `create_tables()` manually.

### 11.7 CORS Origins — Multi-Origin Support

`allowed_origins` accepts **comma-separated values**, so you can allow multiple origins at once:

```
# .env
ALLOWED_ORIGINS=https://hireiq.app,https://www.hireiq.app,https://staging.hireiq.app
```

`main.py` splits on `,` and strips whitespace before passing to `CORSMiddleware`.

---

## Quick Reference

### Adding a Feature Cheat Sheet

```
1. models/       → SQLAlchemy table definition
2. migrations/   → alembic revision --autogenerate → alembic upgrade head
3. schemas.py    → Pydantic request/response types
4. services/     → Business logic (pure Python functions)
5. routers/      → HTTP endpoints (call services, not DB directly)
6. main.py       → app.include_router(new_router.router)
7. tests/unit/   → Mock-based function tests
8. tests/integration/ → Full HTTP tests with TestClient
9. frontend/api.ts    → TypeScript API functions
10. frontend/pages/   → React component
11. App.tsx           → Add route
12. nginx.conf        → Add proxy location if new URL prefix
```

### Key File Paths

| What                         | Where                                     |
|------------------------------|-------------------------------------------|
| App startup                  | [Backend/app/main.py](Backend/app/main.py)|
| Config / env vars            | [Backend/app/config.py](Backend/app/config.py)|
| Database connection          | [Backend/database.py](Backend/database.py)|
| All Pydantic schemas         | [Backend/models/schemas.py](Backend/models/schemas.py)|
| Auth logic                   | [Backend/services/auth_service.py](Backend/services/auth_service.py)|
| CV scoring pipeline          | [Backend/services/rag_scorer.py](Backend/services/rag_scorer.py)|
| LLM analysis                 | [Backend/services/llm_analyzer.py](Backend/services/llm_analyzer.py)|
| Test fixtures                | [Backend/tests/conftest.py](Backend/tests/conftest.py)|
| Frontend API layer           | [frontend/src/api.ts](frontend/src/api.ts)|
| Frontend router              | [frontend/src/App.tsx](frontend/src/App.tsx)|
| Nginx config                 | [frontend/nginx.conf](frontend/nginx.conf)|
| Docker orchestration         | [docker-compose.yml](docker-compose.yml)  |
| Environment variables        | [Backend/.env.example](Backend/.env.example)|

---

## 12. Mini Todo App — Build Everything From Scratch

> This is a self-contained walkthrough that builds a small app using **the exact same patterns as HireIQ**: FastAPI backend, PostgreSQL database, Alembic migrations, React + TypeScript frontend, Nginx, and Docker Compose. Follow every step in order and you will have a fully running app.

### What we are building

- A user can **register** and **log in** (JWT auth)
- A logged-in user can **add**, **check off**, and **delete** todo items
- Each user only sees their own todos (ownership check — same as HireIQ's IDOR guard)

### Final folder structure

```
todoapp/
├── Backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── config.py
│   │   └── main.py
│   ├── models/
│   │   ├── __init__.py
│   │   ├── user.py
│   │   └── schemas.py
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── auth.py
│   │   └── todos.py
│   ├── services/
│   │   ├── __init__.py
│   │   ├── auth_service.py
│   │   └── todo_service.py
│   ├── migrations/
│   │   ├── env.py
│   │   ├── script.py.mako
│   │   └── versions/
│   │       └── 001_initial.py
│   ├── database.py
│   ├── alembic.ini
│   ├── requirements.txt
│   ├── .env
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── api.ts
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── index.css
│   │   └── pages/
│   │       ├── Auth.tsx
│   │       └── Todos.tsx
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── Dockerfile
│   └── nginx.conf
└── docker-compose.yml
```

---

### Step 1 — Create the folder structure

Run these commands once to create all the folders:

```bash
mkdir todoapp
cd todoapp

mkdir -p Backend/app
mkdir -p Backend/models
mkdir -p Backend/routers
mkdir -p Backend/services
mkdir -p Backend/migrations/versions
mkdir -p frontend/src/pages
```

---

### Step 2 — Backend

#### 2.1 `Backend/requirements.txt`

```
fastapi==0.109.2
uvicorn[standard]==0.29.0
sqlalchemy==2.0.30
psycopg2-binary==2.9.9
alembic==1.13.1
python-jose[cryptography]==3.3.0
bcrypt==4.0.1
pydantic-settings==2.2.1
python-multipart==0.0.9
passlib[bcrypt]==1.7.4
```

---

#### 2.2 `Backend/.env`

```
DATABASE_URL=postgresql://todo_user:todo_pass@postgres:5432/tododb
JWT_SECRET=change-this-to-a-long-random-string
ACCESS_TOKEN_EXPIRE_MINUTES=60
```

---

#### 2.3 `Backend/app/__init__.py`

Empty file. Just create it:
```bash
touch Backend/app/__init__.py
```

---

#### 2.4 `Backend/app/config.py`

This is the settings singleton. Every env var is defined here. Any file that needs config imports `settings`.

```python
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60


settings = Settings()
```

---

#### 2.5 `Backend/database.py`

Creates the SQLAlchemy engine and the `get_db` dependency that routers use.

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from app.config import settings

engine = create_engine(settings.database_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

---

#### 2.6 `Backend/models/__init__.py`

Empty file.

---

#### 2.7 `Backend/models/user.py`

Two tables: `users` and `todo_items`. The relationship lets you do `user.todos` in Python without writing a JOIN.

```python
from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import declarative_base, relationship

Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id              = Column(Integer, primary_key=True, index=True)
    email           = Column(String, unique=True, nullable=False, index=True)
    username        = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    created_at      = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))

    todos = relationship("TodoItem", back_populates="user")


class TodoItem(Base):
    __tablename__ = "todo_items"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=False)
    title      = Column(String(200), nullable=False)
    done       = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))

    user = relationship("User", back_populates="todos")
```

---

#### 2.8 `Backend/models/schemas.py`

Pydantic schemas validate incoming request bodies and shape outgoing JSON. They are completely separate from the SQLAlchemy models above.

```python
from datetime import datetime
from pydantic import BaseModel


# --- Auth ---

class RegisterRequest(BaseModel):
    email: str
    username: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str


class MeResponse(BaseModel):
    id: int
    email: str
    username: str


# --- Todos ---

class TodoCreate(BaseModel):
    title: str


class TodoResponse(BaseModel):
    id: int
    title: str
    done: bool
    created_at: datetime

    class Config:
        from_attributes = True  # allows creating this from a SQLAlchemy object
```

---

#### 2.9 `Backend/services/__init__.py`

Empty file.

---

#### 2.10 `Backend/services/auth_service.py`

All auth logic lives here. The router never calls bcrypt or JWT directly — it calls these functions.

```python
from datetime import datetime, timedelta, timezone
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.config import settings
from database import get_db
from models.user import User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
bearer_scheme = HTTPBearer()


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def create_access_token(user_id: int, email: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {"sub": str(user_id), "email": email, "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user
```

---

#### 2.11 `Backend/services/todo_service.py`

All database operations for todos. Notice every query filters by `user_id` — this prevents one user from seeing or touching another user's data.

```python
from fastapi import HTTPException
from sqlalchemy.orm import Session

from models.user import TodoItem
from models.schemas import TodoCreate


def get_todos(db: Session, user_id: int) -> list[TodoItem]:
    return (
        db.query(TodoItem)
        .filter(TodoItem.user_id == user_id)
        .order_by(TodoItem.created_at.desc())
        .all()
    )


def create_todo(db: Session, user_id: int, data: TodoCreate) -> TodoItem:
    todo = TodoItem(user_id=user_id, title=data.title)
    db.add(todo)
    db.commit()
    db.refresh(todo)
    return todo


def toggle_todo(db: Session, todo_id: int, user_id: int) -> TodoItem:
    todo = (
        db.query(TodoItem)
        .filter(TodoItem.id == todo_id, TodoItem.user_id == user_id)
        .first()
    )
    if not todo:
        raise HTTPException(status_code=404, detail="Todo not found")
    todo.done = not todo.done
    db.commit()
    db.refresh(todo)
    return todo


def delete_todo(db: Session, todo_id: int, user_id: int) -> None:
    todo = (
        db.query(TodoItem)
        .filter(TodoItem.id == todo_id, TodoItem.user_id == user_id)
        .first()
    )
    if not todo:
        raise HTTPException(status_code=404, detail="Todo not found")
    db.delete(todo)
    db.commit()
```

---

#### 2.12 `Backend/routers/__init__.py`

Empty file.

---

#### 2.13 `Backend/routers/auth.py`

The router only handles HTTP concerns: request parsing, response shaping, calling the service. No bcrypt, no JWT, no DB queries directly.

```python
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models.schemas import LoginRequest, MeResponse, RegisterRequest, TokenResponse
from models.user import User
from services.auth_service import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)

router = APIRouter()


@router.post("/register", response_model=TokenResponse, status_code=201)
def register(data: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    if db.query(User).filter(User.username == data.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")
    user = User(
        email=data.email,
        username=data.username,
        hashed_password=hash_password(data.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"access_token": create_access_token(user.id, user.email), "token_type": "bearer"}


@router.post("/login", response_model=TokenResponse)
def login(data: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not verify_password(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"access_token": create_access_token(user.id, user.email), "token_type": "bearer"}


@router.get("/me", response_model=MeResponse)
def me(current_user: User = Depends(get_current_user)):
    return current_user
```

---

#### 2.14 `Backend/routers/todos.py`

```python
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from database import get_db
from models.schemas import TodoCreate, TodoResponse
from models.user import User
from services.auth_service import get_current_user
from services import todo_service

router = APIRouter()


@router.get("/", response_model=list[TodoResponse])
def list_todos(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return todo_service.get_todos(db, current_user.id)


@router.post("/", response_model=TodoResponse, status_code=status.HTTP_201_CREATED)
def create_todo(
    data: TodoCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return todo_service.create_todo(db, current_user.id, data)


@router.patch("/{todo_id}/toggle", response_model=TodoResponse)
def toggle_todo(
    todo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return todo_service.toggle_todo(db, todo_id, current_user.id)


@router.delete("/{todo_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_todo(
    todo_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    todo_service.delete_todo(db, todo_id, current_user.id)
```

---

#### 2.15 `Backend/app/main.py`

Creates the FastAPI app, registers the two routers, adds CORS, and exposes a health check.

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import auth, todos
from app.config import settings

app = FastAPI(title="Todo API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router,  prefix="/auth",  tags=["auth"])
app.include_router(todos.router, prefix="/todos", tags=["todos"])


@app.get("/health")
def health():
    return {"status": "ok"}
```

---

#### 2.16 Alembic migration setup

**`Backend/alembic.ini`** — Alembic config file. Points to the `migrations/` folder and reads the DB URL from the environment via `env.py`.

```ini
[alembic]
script_location = migrations
prepend_sys_path = .

[loggers]
keys = root,sqlalchemy,alembic

[handlers]
keys = console

[formatters]
keys = generic

[logger_root]
level = WARN
handlers = console
qualname =

[logger_sqlalchemy]
level = WARN
handlers =
qualname = sqlalchemy.engine

[logger_alembic]
level = INFO
handlers =
qualname = alembic

[handler_console]
class = StreamHandler
args = (sys.stderr,)
level = NOTSET
formatter = generic

[formatter_generic]
format = %(levelname)-5.5s [%(name)s] %(message)s
datefmt = %H:%M:%S
```

**`Backend/migrations/env.py`** — Connects Alembic to your SQLAlchemy models so it knows the schema to compare against.

```python
import sys
import os
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.config import settings
from models.user import Base

config = context.config
config.set_main_option("sqlalchemy.url", settings.database_url)

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

**`Backend/migrations/script.py.mako`** — Template used when Alembic generates new migration files. Copy this exactly.

```
"""${message}

Revision ID: ${up_revision}
Revises: ${down_revision | comma,n}
Create Date: ${create_date}

"""
from alembic import op
import sqlalchemy as sa
${imports if imports else ""}

revision = ${repr(up_revision)}
down_revision = ${repr(down_revision)}
branch_labels = ${repr(branch_labels)}
depends_on = ${repr(depends_on)}


def upgrade() -> None:
    ${upgrades if upgrades else "pass"}


def downgrade() -> None:
    ${downgrades if downgrades else "pass"}
```

**`Backend/migrations/versions/001_initial.py`** — The first migration: creates both tables.

```python
"""initial tables

Revision ID: 001
Revises:
Create Date: 2025-01-01
"""
from alembic import op
import sqlalchemy as sa

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(), nullable=False, unique=True),
        sa.Column("username", sa.String(), nullable=False, unique=True),
        sa.Column("hashed_password", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_users_email", "users", ["email"])
    op.create_index("ix_users_username", "users", ["username"])

    op.create_table(
        "todo_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("title", sa.String(200), nullable=False),
        sa.Column("done", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("todo_items")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_index("ix_users_username", table_name="users")
    op.drop_table("users")
```

---

#### 2.17 `Backend/Dockerfile`

```dockerfile
FROM python:3.11-slim

RUN apt-get update && apt-get install -y gcc libpq-dev && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
```

---

### Step 3 — Frontend

#### 3.1 `frontend/package.json`

```json
{
  "name": "todo-frontend",
  "version": "1.0.0",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "axios": "^1.6.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.22.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.3.0",
    "vite": "^5.2.0"
  }
}
```

---

#### 3.2 `frontend/vite.config.ts`

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
});
```

---

#### 3.3 `frontend/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true
  },
  "include": ["src"]
}
```

---

#### 3.4 `frontend/tailwind.config.js`

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
};
```

---

#### 3.5 `frontend/postcss.config.js`

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

---

#### 3.6 `frontend/index.html`

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Todo App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

---

#### 3.7 `frontend/src/index.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

---

#### 3.8 `frontend/src/api.ts`

One Axios instance shared by everything. The request interceptor automatically attaches the JWT from localStorage so every call to `/todos` is authenticated.

```typescript
import axios from "axios";

const api = axios.create({ baseURL: "/" });

// Attach JWT to every request automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Todo {
  id: number;
  title: string;
  done: boolean;
  created_at: string;
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export const authApi = {
  register: (email: string, username: string, password: string) =>
    api.post<{ access_token: string }>("/auth/register", { email, username, password })
       .then((r) => r.data),

  login: (email: string, password: string) =>
    api.post<{ access_token: string }>("/auth/login", { email, password })
       .then((r) => r.data),
};

// ─── Todos ───────────────────────────────────────────────────────────────────

export const todosApi = {
  list: () =>
    api.get<Todo[]>("/todos/").then((r) => r.data),

  create: (title: string) =>
    api.post<Todo>("/todos/", { title }).then((r) => r.data),

  toggle: (id: number) =>
    api.patch<Todo>(`/todos/${id}/toggle`).then((r) => r.data),

  remove: (id: number) =>
    api.delete(`/todos/${id}`),
};
```

---

#### 3.9 `frontend/src/main.tsx`

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

---

#### 3.10 `frontend/src/App.tsx`

Handles routing and auth state. If a token is in localStorage the user is logged in; otherwise redirect to `/auth`.

```tsx
import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Auth from "./pages/Auth";
import Todos from "./pages/Todos";

export default function App() {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    setToken(localStorage.getItem("token"));
  }, []);

  const handleLogin = (t: string) => {
    localStorage.setItem("token", t);
    setToken(t);
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    setToken(null);
  };

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/auth"
          element={token ? <Navigate to="/todos" /> : <Auth onLogin={handleLogin} />}
        />
        <Route
          path="/todos"
          element={token ? <Todos onLogout={handleLogout} /> : <Navigate to="/auth" />}
        />
        <Route path="*" element={<Navigate to={token ? "/todos" : "/auth"} />} />
      </Routes>
    </BrowserRouter>
  );
}
```

---

#### 3.11 `frontend/src/pages/Auth.tsx`

Login / Register on the same page — a toggle switches between the two forms.

```tsx
import { useState } from "react";
import { authApi } from "../api";

interface Props {
  onLogin: (token: string) => void;
}

export default function Auth({ onLogin }: Props) {
  const [mode, setMode]         = useState<"login" | "register">("login");
  const [email, setEmail]       = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data =
        mode === "register"
          ? await authApi.register(email, username, password)
          : await authApi.login(email, password);
      onLogin(data.access_token);
    } catch (err: any) {
      setError(err.response?.data?.detail ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-sm">
        <h1 className="text-2xl font-bold text-center mb-6">
          {mode === "login" ? "Sign In" : "Create Account"}
        </h1>

        <form onSubmit={submit} className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />

          {mode === "register" && (
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          )}

          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-500 text-white py-2 rounded-lg hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? "..." : mode === "login" ? "Sign In" : "Register"}
          </button>
        </form>

        <p className="text-center text-sm mt-4 text-gray-500">
          {mode === "login" ? "No account? " : "Already have one? "}
          <button
            className="text-blue-500 hover:underline"
            onClick={() => setMode(mode === "login" ? "register" : "login")}
          >
            {mode === "login" ? "Register" : "Sign In"}
          </button>
        </p>
      </div>
    </div>
  );
}
```

---

#### 3.12 `frontend/src/pages/Todos.tsx`

The main todo list page. Loads todos on mount, adds new ones, toggles done state, deletes.

```tsx
import { useEffect, useState } from "react";
import { todosApi, Todo } from "../api";

interface Props {
  onLogout: () => void;
}

export default function Todos({ onLogout }: Props) {
  const [todos, setTodos]   = useState<Todo[]>([]);
  const [title, setTitle]   = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    todosApi.list().then((data) => {
      setTodos(data);
      setLoading(false);
    });
  }, []);

  const addTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const created = await todosApi.create(title.trim());
    setTodos((prev) => [created, ...prev]);
    setTitle("");
  };

  const toggle = async (id: number) => {
    const updated = await todosApi.toggle(id);
    setTodos((prev) => prev.map((t) => (t.id === id ? updated : t)));
  };

  const remove = async (id: number) => {
    await todosApi.remove(id);
    setTodos((prev) => prev.filter((t) => t.id !== id));
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-lg mx-auto">

        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">My Todos</h1>
          <button onClick={onLogout} className="text-sm text-gray-400 hover:text-red-500">
            Logout
          </button>
        </div>

        {/* Add todo form */}
        <form onSubmit={addTodo} className="flex gap-2 mb-6">
          <input
            type="text"
            placeholder="What needs to be done?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1 border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
          <button
            type="submit"
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
          >
            Add
          </button>
        </form>

        {/* Todo list */}
        {loading ? (
          <p className="text-gray-400 text-center">Loading...</p>
        ) : todos.length === 0 ? (
          <p className="text-gray-400 text-center">No todos yet. Add one above!</p>
        ) : (
          <ul className="space-y-2">
            {todos.map((todo) => (
              <li
                key={todo.id}
                className="flex items-center gap-3 bg-white rounded-lg px-4 py-3 shadow-sm"
              >
                <input
                  type="checkbox"
                  checked={todo.done}
                  onChange={() => toggle(todo.id)}
                  className="w-4 h-4 accent-blue-500 cursor-pointer"
                />
                <span
                  className={`flex-1 ${todo.done ? "line-through text-gray-400" : ""}`}
                >
                  {todo.title}
                </span>
                <button
                  onClick={() => remove(todo.id)}
                  className="text-gray-300 hover:text-red-500 text-lg leading-none"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
```

---

#### 3.13 `frontend/Dockerfile`

Two-stage build: Node builds the React app, then Nginx serves the static files.

```dockerfile
# Stage 1 — build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2 — serve
FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

---

#### 3.14 `frontend/nginx.conf`

Serves the SPA and proxies `/auth` and `/todos` to the backend container.

```nginx
server {
    listen 80;

    # Serve the React SPA — unknown paths go to index.html (React Router handles them)
    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
    }

    # Proxy auth endpoints to backend
    location /auth {
        proxy_pass         http://backend:8000;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
    }

    # Proxy todos endpoints to backend
    location /todos {
        proxy_pass         http://backend:8000;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
    }

    # Proxy health check
    location /health {
        proxy_pass http://backend:8000;
    }
}
```

---

### Step 4 — Docker Compose

**`todoapp/docker-compose.yml`**

Defines 3 services: Postgres, Backend, Frontend. Backend waits for Postgres to be healthy before starting. Frontend waits for Backend.

```yaml
version: "3.9"

services:

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: todo_user
      POSTGRES_PASSWORD: todo_pass
      POSTGRES_DB: tododb
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U todo_user -d tododb"]
      interval: 5s
      timeout: 5s
      retries: 10

  backend:
    build: ./Backend
    environment:
      DATABASE_URL: postgresql://todo_user:todo_pass@postgres:5432/tododb
      JWT_SECRET: super-secret-change-me
      ACCESS_TOKEN_EXPIRE_MINUTES: 60
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD-SHELL", "curl -sf http://localhost:8000/health || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 5

  frontend:
    build: ./frontend
    ports:
      - "3000:80"
    depends_on:
      backend:
        condition: service_healthy

volumes:
  postgres_data:
```

---

### Step 5 — Run the App

```bash
# Make sure you are in the todoapp/ root directory
cd todoapp

# Build all images and start all 3 services
docker compose up --build

# You will see logs from all services streaming together.
# Wait until you see something like:
# backend  | INFO:     Application startup complete.
# frontend | ... nginx started

# Then open your browser at:
# http://localhost:3000
```

On the first run, the backend container will:
1. Wait for Postgres to be healthy
2. Run `alembic upgrade head` — creates the `users` and `todo_items` tables
3. Start Uvicorn on port 8000

The frontend container will:
1. Serve the built React SPA via Nginx on port 80 (mapped to 3000)
2. Proxy `/auth/*` and `/todos/*` to the backend

---

### Step 6 — Test the App

#### Test with curl (no browser needed)

```bash
# 1. Register a new user
curl -s -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@test.com","username":"alice","password":"Password123"}' | python -m json.tool

# Expected:
# { "access_token": "eyJ...", "token_type": "bearer" }

# 2. Save the token
TOKEN="eyJ..."   # paste the token from step 1 here

# 3. Create a todo
curl -s -X POST http://localhost:3000/todos/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"title":"Buy groceries"}' | python -m json.tool

# 4. Create another todo
curl -s -X POST http://localhost:3000/todos/ \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"title":"Read a book"}' | python -m json.tool

# 5. List all todos
curl -s http://localhost:3000/todos/ \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool

# 6. Toggle the first todo done (replace 1 with the actual id)
curl -s -X PATCH http://localhost:3000/todos/1/toggle \
  -H "Authorization: Bearer $TOKEN" | python -m json.tool

# 7. Delete a todo
curl -s -X DELETE http://localhost:3000/todos/1 \
  -H "Authorization: Bearer $TOKEN"
# Expected: 204 No Content (empty body)

# 8. Verify IDOR protection: login as a different user and try to delete alice's todo
curl -s -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"bob@test.com","username":"bob","password":"Password123"}' | python -m json.tool

# Save bob's token and try to delete alice's todo (id=2):
BOB_TOKEN="eyJ..."
curl -s -X DELETE http://localhost:3000/todos/2 \
  -H "Authorization: Bearer $BOB_TOKEN"
# Expected: 404 Not Found — Bob cannot touch Alice's data
```

#### Test with the browser

1. Open `http://localhost:3000`
2. Register an account
3. You land on `/todos` — try adding, checking, and deleting items
4. Click Logout — you go back to `/auth`
5. Log back in — your todos are still there (persisted in PostgreSQL)

#### Inspect the database directly

```bash
# Connect to Postgres inside Docker
docker compose exec postgres psql -U todo_user -d tododb

# Inside psql:
\dt                          -- list tables (should show users, todo_items)
SELECT * FROM users;          -- see registered users (passwords are hashed)
SELECT * FROM todo_items;     -- see all todos
\q                           -- quit
```

---

### Step 7 — Common Commands

```bash
# Stop everything
docker compose down

# Stop and wipe the database (full reset)
docker compose down -v

# Rebuild only the backend after Python code changes
docker compose up --build backend

# Rebuild only the frontend after React code changes
docker compose up --build frontend

# View live logs from one service
docker compose logs -f backend
docker compose logs -f frontend

# Open a shell inside the backend container
docker compose exec backend bash

# Run a new Alembic migration after adding a model field
docker compose exec backend alembic revision --autogenerate -m "add_priority_column"
docker compose exec backend alembic upgrade head
```

---

### How this maps to HireIQ

| This Todo App | HireIQ equivalent |
|---|---|
| `models/user.py` (User + TodoItem) | `Backend/models/user.py` (User + CVSession + InterviewResult) |
| `services/auth_service.py` | `Backend/services/auth_service.py` (same pattern, adds refresh tokens + JTI blacklist) |
| `services/todo_service.py` | `Backend/services/cv_parser.py`, `job_service.py`, etc. |
| `routers/auth.py` + `routers/todos.py` | `Backend/routers/` (11 router files, same structure) |
| `migrations/versions/001_initial.py` | `Backend/migrations/versions/001_initial.py` through `017_*` |
| Single `docker-compose.yml` (3 services) | HireIQ `docker-compose.yml` (6 services + ChromaDB + Redis + Adminer) |
| Nginx proxies `/auth` and `/todos` | HireIQ nginx proxies 10+ route prefixes including SSE for `/analyze` |
| JWT stored in localStorage | Same in HireIQ (+ refresh token rotation + Redis blacklist) |
| IDOR guard: `filter(user_id == current_user.id)` | Same in every service in HireIQ — every query is ownership-scoped |
