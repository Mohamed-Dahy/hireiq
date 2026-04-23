from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from routers import cv, auth, analysis, interview
from database import create_tables
from limiter import limiter

security = HTTPBearer()

app = FastAPI(
    title="HireIQ API",
    version="1.0.0",
    description="AI-powered CV screener and interview coach",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Allow the React frontend (port 5173) to talk to this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Create DB tables on startup if they don't exist
@app.on_event("startup")
def startup():
    create_tables()


# --- Health check (confirms the server is running) ---
@app.get("/health")
def health_check():
    return {"status": "ok", "service": "HireIQ API"}


app.include_router(auth.router,     prefix="/auth",    tags=["auth"])
app.include_router(cv.router,       prefix="/cv",      tags=["cv"])
app.include_router(analysis.router,   prefix="/analyze",   tags=["analysis"])
app.include_router(interview.router,  prefix="/interview", tags=["interview"])
