from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import cv

app = FastAPI(
    title="HireIQ API",
    version="1.0.0",
    description="AI-powered CV screener and interview coach",
)

# Allow the React frontend (port 5173) to talk to this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Health check (confirms the server is running) ---
@app.get("/health")
def health_check():
    return {"status": "ok", "service": "HireIQ API"}


app.include_router(cv.router, prefix="/cv", tags=["cv"])

# Uncommented as we build each feature:
# app.include_router(auth.router,      prefix="/auth",      tags=["auth"])
# app.include_router(analysis.router,  prefix="/analyze",   tags=["analysis"])
# app.include_router(interview.router, prefix="/interview", tags=["interview"])
