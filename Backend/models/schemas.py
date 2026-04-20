"""
schemas.py
----------
Pydantic models that define what the API accepts (requests)
and what it returns (responses). No raw dicts ever leave the API.
"""

from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from datetime import datetime


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------

class RegisterRequest(BaseModel):
    email: EmailStr
    username: str
    password: str

    @field_validator("password")
    @classmethod
    def password_length(cls, v: str) -> str:
        if len(v.encode("utf-8")) > 72:
            raise ValueError("Password must be 72 characters or fewer")
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


# ---------------------------------------------------------------------------
# CV upload
# ---------------------------------------------------------------------------

class CVUploadResponse(BaseModel):
    session_id: int
    cv_filename: str
    match_score: float          # 0.0 – 100.0
    skills_found: list[str]     # skills extracted from the CV
    message: str = "CV processed successfully"


# ---------------------------------------------------------------------------
# CV session (used when returning history)
# ---------------------------------------------------------------------------

class CVSessionResponse(BaseModel):
    id: int
    cv_filename: str
    match_score: Optional[float]
    created_at: datetime

    class Config:
        from_attributes = True  # allows building from a SQLAlchemy row


# ---------------------------------------------------------------------------
# Interview
# ---------------------------------------------------------------------------

class InterviewAnswerRequest(BaseModel):
    session_id: int
    question: str
    # audio is sent as a file upload, not JSON — handled in the router


class InterviewResultResponse(BaseModel):
    id: int
    question: str
    transcript: Optional[str]
    clarity_score: Optional[float]
    relevance_score: Optional[float]
    depth_score: Optional[float]
    eye_contact_ratio: Optional[float]
    created_at: datetime

    class Config:
        from_attributes = True


# ---------------------------------------------------------------------------
# Analysis (skill gap)
# ---------------------------------------------------------------------------

class AnalysisRequest(BaseModel):
    session_id: int


# The response for analysis is streamed via SSE, not a single JSON blob,
# so no response schema is needed here — the stream sends plain text chunks.
