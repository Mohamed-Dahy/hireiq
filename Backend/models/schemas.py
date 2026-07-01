"""
schemas.py
----------
Pydantic models that define what the API accepts (requests)
and what it returns (responses). No raw dicts ever leave the API.
"""

import json
from pydantic import BaseModel, ConfigDict, EmailStr, field_validator, model_validator
from typing import Any, Optional
from datetime import date, datetime

_PG_INT_MAX = 2_147_483_647


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
    match_score: Optional[float] = None        # null for ATS Check with no JD
    skills_found: list[str]
    is_linkedin: bool = False
    analysis_mode: str = "job_match"           # "job_match" | "ats_check"
    ats_score: Optional[float] = None          # overall 0-100 ATS score (ats_check only)
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
# Spec 003: ATS Score Checker response schemas
# ---------------------------------------------------------------------------

class AtsCategory(BaseModel):
    key: str
    label: str
    score: float            # 0-1 sub-score
    weight: float
    ai_dependent: bool = False
    confidence: str = "high"  # high | medium | best_effort


class AtsIssue(BaseModel):
    category: str
    severity: str           # high | medium | low
    message: str
    recommendation: str


class AtsKeywordCoverage(BaseModel):
    matched: list[str] = []
    missing: list[str] = []
    available: bool = True


class AtsResultResponse(BaseModel):
    session_id: int
    overall_score: float
    ai_sections_available: bool = True
    categories: list[AtsCategory] = []
    issues: list[AtsIssue] = []
    keyword_coverage: Optional[AtsKeywordCoverage] = None


# ---------------------------------------------------------------------------
# CV session (used when returning history)
# ---------------------------------------------------------------------------

class CVSessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    cv_filename: str
    original_cv_filename: Optional[str] = None
    match_score: Optional[float]
    created_at: datetime
    has_gap_report: bool
    jd_snippet: Optional[str]
    has_interview_questions: bool = False
    analysis_mode: str = "job_match"
    ats_score: Optional[float] = None
    has_ats_result: bool = False


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
    original_cv_filename: Optional[str] = None
    match_score: Optional[float]
    created_at: datetime
    interview_results: list[InterviewResultResponse]
    ai_interview_questions: list[str] = []

    @field_validator("ai_interview_questions", mode="before")
    @classmethod
    def parse_questions_json(cls, v: Any) -> list[str]:
        if isinstance(v, str):
            try:
                parsed = json.loads(v)
                if isinstance(parsed, list):
                    return [str(q) for q in parsed]
            except (json.JSONDecodeError, TypeError):
                pass
            return []
        if isinstance(v, list):
            return v
        return []


# ---------------------------------------------------------------------------
# Analysis (skill gap)
# ---------------------------------------------------------------------------

class AnalysisRequest(BaseModel):
    session_id: int


class SaveQuestionsRequest(BaseModel):
    questions: list[str]


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

    # Phase 2 extensions
    is_admin: bool = False
    tier: str = "free"
    roadmaps_generated: int = 0
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    portfolio_url: Optional[str] = None
    bio: Optional[str] = None
    stored_cv_filename: Optional[str] = None
    has_stored_cv: bool = False
    analyses_in_window: int = 0
    window_resets_at: Optional[datetime] = None

    # Phase 6: Dashboard stats
    sessions_this_month: int = 0
    recent_sessions: list[CVSessionResponse] = []


# ---------------------------------------------------------------------------
# Phase 2: OTP & Profile
# ---------------------------------------------------------------------------

class OtpSendRequest(BaseModel):
    email: EmailStr
    purpose: str

    @field_validator("purpose")
    @classmethod
    def valid_purpose(cls, v: str) -> str:
        allowed = {"registration", "password_reset"}
        if v not in allowed:
            raise ValueError(f"purpose must be one of {allowed}")
        return v


class OtpVerifyRequest(BaseModel):
    email: EmailStr
    code: str
    purpose: str

    @field_validator("code")
    @classmethod
    def five_digits(cls, v: str) -> str:
        if not v.isdigit() or len(v) != 5:
            raise ValueError("code must be exactly 5 digits")
        return v

    @field_validator("purpose")
    @classmethod
    def valid_purpose(cls, v: str) -> str:
        allowed = {"registration", "password_change", "password_reset"}
        if v not in allowed:
            raise ValueError(f"purpose must be one of {allowed}")
        return v


class PasswordResetWithTokenRequest(BaseModel):
    reset_token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_length(cls, v: str) -> str:
        if len(v.encode("utf-8")) > 72:
            raise ValueError("Password must be 72 characters or fewer")
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v


class ProfileUpdateRequest(BaseModel):
    username: Optional[str] = None
    bio: Optional[str] = None
    linkedin_url: Optional[str] = None
    github_url: Optional[str] = None
    portfolio_url: Optional[str] = None


class ChangePasswordRequest(BaseModel):
    otp_code: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_length(cls, v: str) -> str:
        if len(v.encode("utf-8")) > 72:
            raise ValueError("Password must be 72 characters or fewer")
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v



class InterviewQuestionResponse(BaseModel):
    id: int
    question_text: str
    model_answer: str
    practiced: bool = False


class QuestionsByCategoryResponse(BaseModel):
    role: str
    level: str
    total_questions: int
    categories: dict[str, list[InterviewQuestionResponse]]


class QuotaExceededResponse(BaseModel):
    detail: str
    quota_type: str
    used: int
    limit: int
    resets_at: datetime


# ---------------------------------------------------------------------------
# Phase 6: ATS Job Tracker
# ---------------------------------------------------------------------------

def _validate_salary(v: Optional[int], field_name: str) -> Optional[int]:
    if v is not None and (v < 0 or v > _PG_INT_MAX):
        raise ValueError(f"{field_name} must be between 0 and {_PG_INT_MAX:,}")
    return v


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

    @field_validator("salary_min")
    @classmethod
    def check_salary_min(cls, v: Optional[int]) -> Optional[int]:
        return _validate_salary(v, "salary_min")

    @field_validator("salary_max")
    @classmethod
    def check_salary_max(cls, v: Optional[int]) -> Optional[int]:
        return _validate_salary(v, "salary_max")


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

    @field_validator("salary_min")
    @classmethod
    def check_salary_min(cls, v: Optional[int]) -> Optional[int]:
        return _validate_salary(v, "salary_min")

    @field_validator("salary_max")
    @classmethod
    def check_salary_max(cls, v: Optional[int]) -> Optional[int]:
        return _validate_salary(v, "salary_max")


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
    match_score:        Optional[float]
    ai_gap_summary:     Optional[str]
    ai_prep_questions:  Optional[str]
    stage_entered_at:   datetime
    is_archived:        bool
    is_stale:           bool = False
    created_at:         datetime
    updated_at:         datetime


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


# ---------------------------------------------------------------------------
# Phase 7: Recruiter Dashboard
# ---------------------------------------------------------------------------

class RecruiterListCreate(BaseModel):
    name:      str
    job_title: Optional[str] = None


class RecruiterListResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:              int
    name:            str
    job_title:       Optional[str]
    candidate_count: int = 0
    created_at:      datetime


class RecruiterCandidateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id:               int
    session_id:       Optional[int]
    rank:             Optional[int]
    status:           str
    notes:            Optional[str]
    starred:          bool

    # Standalone candidate identity
    candidate_name:   Optional[str]
    candidate_email:  Optional[str]
    candidate_phone:  Optional[str]
    applied_position: Optional[str]
    cv_file_path:     Optional[str]
    display_name:     str

    # From linked CV session (None for standalone)
    cv_filename:      Optional[str]
    jd_snippet:       Optional[str]
    match_score:      Optional[float]
    skill_inventory:  Optional[Any]
    created_at:       datetime


class RecruiterCandidateUpdate(BaseModel):
    rank:             Optional[int] = None
    status:           Optional[str] = None
    notes:            Optional[str] = None
    starred:          Optional[bool] = None
    candidate_name:   Optional[str] = None
    candidate_email:  Optional[str] = None
    candidate_phone:  Optional[str] = None
    applied_position: Optional[str] = None


class RecruiterCandidateListResponse(BaseModel):
    list_id:    int
    list_name:  str
    candidates: list[RecruiterCandidateResponse]


# ---------------------------------------------------------------------------
# Phase 9: Referrals
# ---------------------------------------------------------------------------

class ReferralCodeResponse(BaseModel):
    code: str
    referral_url: str


class ReferralStatsResponse(BaseModel):
    total_referred: int
    total_converted: int
    days_earned: int


class LeaderboardEntry(BaseModel):
    username: str
    referral_count: int


# ---------------------------------------------------------------------------
# Phase 11: Career Roadmap
# ---------------------------------------------------------------------------

class RoadmapResource(BaseModel):
    name: str
    url: str
    type: str
    is_free: bool
    estimated_hours: int


class RoadmapPhase(BaseModel):
    name: str
    estimated_weeks: int
    skills_covered: list[str]
    resources: list[RoadmapResource]
    project_to_build: str
    milestone: str


class CareerInsight(BaseModel):
    salary_range_local: str
    salary_range_remote: str
    top_companies: list[str]
    hot_skills: list[str]
    market_demand: str


class QuickWin(BaseModel):
    action: str
    why: str
    time_required: str


class RoadmapGenerateRequest(BaseModel):
    cv_session_id: Optional[int] = None
    target_role: str
    role_description: Optional[str] = None


class RoadmapListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    target_role: str
    total_estimated_weeks: int
    created_at: datetime


class RoadmapResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    target_role: str
    total_estimated_weeks: int
    phases: list[RoadmapPhase]
    career_insight: CareerInsight
    quick_wins: list[QuickWin]
    created_at: datetime


# ---------------------------------------------------------------------------
# Phase 10: Admin BI Dashboard
# ---------------------------------------------------------------------------

class AdminLoginRequest(BaseModel):
    email: str
    password: str


class AdminTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class AdminUserItem(BaseModel):
    id: int
    email: str
    username: str
    tier: str
    is_admin: bool
    email_verified: bool
    created_at: Optional[str]
    session_count: int
    locked_until: Optional[str]


class AdminUsersResponse(BaseModel):
    users: list[AdminUserItem]


class TierDistributionItem(BaseModel):
    tier: str
    count: int


class TrendPoint(BaseModel):
    date: str
    count: int


class AdminMetricsResponse(BaseModel):
    users: dict
    cv_sessions: dict
    interviews: dict
    jobs: dict
    roadmaps: dict
    referrals: dict
    interview_bank: dict
