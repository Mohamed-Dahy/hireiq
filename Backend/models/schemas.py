"""
schemas.py
----------
Pydantic models that define what the API accepts (requests)
and what it returns (responses). No raw dicts ever leave the API.
"""

from pydantic import BaseModel, ConfigDict, EmailStr, field_validator
from typing import Any, Optional
from datetime import date, datetime


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


class RegisterResponse(BaseModel):
    message: str
    email: str


class MessageResponse(BaseModel):
    message: str


class EmailRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_length(cls, v: str) -> str:
        if len(v.encode("utf-8")) > 72:
            raise ValueError("Password must be 72 characters or fewer")
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v


# ---------------------------------------------------------------------------
# CV upload
# ---------------------------------------------------------------------------

class CVUploadResponse(BaseModel):
    session_id: int
    cv_filename: str
    match_score: float
    skills_found: list[str]
    is_linkedin: bool = False
    message: str = "CV processed successfully"


# ---------------------------------------------------------------------------
# Phase 5: Structured analysis response schemas
# ---------------------------------------------------------------------------

class SkillItem(BaseModel):
    skill: str
    category: str
    level: str


class GapItem(BaseModel):
    skill: str
    importance: str
    reason: str
    resource: str


class RoadmapItem(BaseModel):
    topic: str
    priority: str
    estimated_hours: int
    resources: list[str]


class QuestionItem(BaseModel):
    question: str
    model_answer: str


class EnhancedAnalysisResponse(BaseModel):
    skill_inventory: list[SkillItem]
    gap_report: list[GapItem]
    study_roadmap: list[RoadmapItem]


class AnalysisPendingResponse(BaseModel):
    status: str = "pending"
    message: str = "Analysis not yet computed. Stream it first via /analyze."


# ---------------------------------------------------------------------------
# CV session (used when returning history)
# ---------------------------------------------------------------------------

class CVSessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    cv_filename: str
    match_score: Optional[float]
    created_at: datetime


# ---------------------------------------------------------------------------
# Interview
# ---------------------------------------------------------------------------

class InterviewAnswerRequest(BaseModel):
    session_id: int
    question: str
    # audio is sent as a file upload, not JSON — handled in the router


class InterviewResultResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    question: str
    transcript: Optional[str]
    clarity_score: Optional[float]
    relevance_score: Optional[float]
    depth_score: Optional[float]
    eye_contact_ratio: Optional[float]
    created_at: datetime


# ---------------------------------------------------------------------------
# CV session detail (session + all its interview results)
# ---------------------------------------------------------------------------

class CVSessionDetailResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    cv_filename: str
    match_score: Optional[float]
    created_at: datetime
    interview_results: list[InterviewResultResponse]


# ---------------------------------------------------------------------------
# Analysis (skill gap)
# ---------------------------------------------------------------------------

class AnalysisRequest(BaseModel):
    session_id: int


# The response for analysis is streamed via SSE, not a single JSON blob,
# so no response schema is needed here — the stream sends plain text chunks.


# ---------------------------------------------------------------------------
# User profile + stats
# ---------------------------------------------------------------------------

class UserProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    username: str
    created_at: datetime
    total_sessions: int
    avg_match_score: Optional[float]
    total_interviews: int
    best_score: Optional[float]


# ---------------------------------------------------------------------------
# Phase 6: ATS Job Tracker
# ---------------------------------------------------------------------------

class JobCreateRequest(BaseModel):
    company:          str
    title:            str
    location:         Optional[str] = None
    remote_type:      Optional[str] = None
    job_url:          Optional[str] = None
    jd_text:          Optional[str] = None
    source:           Optional[str] = None
    priority:         Optional[str] = None
    cv_session_id:    Optional[int] = None
    applied_date:     Optional[date] = None
    deadline_date:    Optional[date] = None
    followup_date:    Optional[date] = None
    salary_min:       Optional[int] = None
    salary_max:       Optional[int] = None
    notes:            Optional[str] = None
    cover_letter:     Optional[str] = None
    rejection_reason: Optional[str] = None


class JobUpdateRequest(BaseModel):
    company:          Optional[str] = None
    title:            Optional[str] = None
    location:         Optional[str] = None
    remote_type:      Optional[str] = None
    job_url:          Optional[str] = None
    jd_text:          Optional[str] = None
    source:           Optional[str] = None
    priority:         Optional[str] = None
    cv_session_id:    Optional[int] = None
    applied_date:     Optional[date] = None
    deadline_date:    Optional[date] = None
    followup_date:    Optional[date] = None
    salary_min:       Optional[int] = None
    salary_max:       Optional[int] = None
    notes:            Optional[str] = None
    cover_letter:     Optional[str] = None
    rejection_reason: Optional[str] = None


class JobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:               int
    company:          str
    title:            str
    location:         Optional[str]
    remote_type:      Optional[str]
    job_url:          Optional[str]
    status:           str
    source:           Optional[str]
    priority:         Optional[str]
    cv_session_id:    Optional[int]
    applied_date:     Optional[date]
    deadline_date:    Optional[date]
    followup_date:    Optional[date]
    salary_min:       Optional[int]
    salary_max:       Optional[int]
    notes:            Optional[str]
    cover_letter:     Optional[str]
    rejection_reason: Optional[str]
    match_score:      Optional[float]
    ai_gap_summary:   Optional[str]
    is_archived:      bool
    created_at:       datetime
    updated_at:       datetime


class StatusTransitionRequest(BaseModel):
    new_status: str
    note:       Optional[str] = None


class ActivityCreateRequest(BaseModel):
    event_type:  str
    event_date:  Optional[date] = None
    notes:       Optional[str] = None


class ActivityResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:                 int
    job_application_id: int
    event_type:         str
    event_date:         date
    notes:              Optional[str]
    created_at:         datetime


class ContactCreateRequest(BaseModel):
    name:         str
    role:         Optional[str] = None
    email:        Optional[str] = None
    phone:        Optional[str] = None
    linkedin_url: Optional[str] = None
    notes:        Optional[str] = None


class ContactResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:                 int
    job_application_id: int
    name:               str
    role:               Optional[str]
    email:              Optional[str]
    phone:              Optional[str]
    linkedin_url:       Optional[str]
    notes:              Optional[str]
    created_at:         datetime


class JobAnalyzeRequest(BaseModel):
    jd_text: Optional[str] = None


class JobAnalyzeResponse(BaseModel):
    match_score:    Optional[float]
    ai_gap_summary: Optional[str]


class PrepQuestionsResponse(BaseModel):
    questions: list[dict]


class JobStatsResponse(BaseModel):
    total_active:   int
    by_status:      dict[str, int]
    by_source:      dict[str, int]
    response_rate:  float
    interview_rate: float
    offer_rate:     float
    stale_count:    int
    upcoming_count: int
    weekly_trend:   list[Any]
