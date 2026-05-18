import uuid
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.security import HTTPBearer
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from routers import cv, auth, analysis, interview, jobs, recruiter, referrals, roadmap, profile, interview_bank, admin
from limiter import limiter
from app.config import settings, configure_logging
from middleware.security_headers import SecurityHeadersMiddleware
from middleware.csrf import CSRFMiddleware

configure_logging()

security = HTTPBearer()

app = FastAPI(
    title="HireIQ API",
    version="1.0.0",
    description="AI-powered CV screener and interview coach",
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Security headers MUST be registered before CORS
app.add_middleware(SecurityHeadersMiddleware)
# CSRF defense-in-depth: require X-Requested-With on state-changing requests
app.add_middleware(CSRFMiddleware)

origins = [o.strip() for o in settings.allowed_origins.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    ref = str(uuid.uuid4())
    from loguru import logger
    logger.exception(f"Unhandled error ref={ref}: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error", "ref": ref},
    )


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "HireIQ API"}


app.include_router(auth.router,      prefix="/auth",      tags=["auth"])
app.include_router(cv.router,        prefix="/cv",        tags=["cv"])
app.include_router(analysis.router,  prefix="/analyze",   tags=["analysis"])
app.include_router(interview.router, prefix="/interview",  tags=["interview"])
app.include_router(jobs.router)
app.include_router(recruiter.router)
app.include_router(referrals.router, prefix="/referrals", tags=["referrals"])
app.include_router(roadmap.router, prefix="/roadmap", tags=["roadmap"])
app.include_router(profile.router, prefix="/profile", tags=["profile"])
app.include_router(interview_bank.router, prefix="/interview-bank", tags=["interview-bank"])
app.include_router(admin.router, prefix="/admin", tags=["admin"])
