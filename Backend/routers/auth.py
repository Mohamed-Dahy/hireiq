"""
routers/auth.py
---------------
POST /auth/register  — create a new account
POST /auth/login     — get access + refresh tokens
POST /auth/refresh   — exchange refresh token for a new access token
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models.user import User, CVSession, InterviewResult
from models.schemas import RegisterRequest, LoginRequest, TokenResponse, UserProfileResponse
from services.auth_service import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
)

router = APIRouter()


@router.post("/register", response_model=TokenResponse, status_code=201)
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    """Create a new user account and return tokens immediately."""

    # Block duplicate emails or usernames
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    if db.query(User).filter(User.username == payload.username).first():
        raise HTTPException(status_code=400, detail="Username already taken")

    user = User(
        email=payload.email,
        username=payload.username,
        hashed_password=hash_password(payload.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token_data = {"sub": str(user.id)}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
    )


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """Verify credentials and return tokens."""

    user = db.query(User).filter(User.email == payload.email).first()

    # Same error for wrong email or wrong password — don't reveal which
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token_data = {"sub": str(user.id)}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
    )


@router.get("/me", response_model=UserProfileResponse)
def get_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the logged-in user's profile + aggregate stats."""
    sessions = db.query(CVSession).filter(CVSession.user_id == current_user.id).all()
    scores = [s.match_score for s in sessions if s.match_score is not None]
    session_ids = [s.id for s in sessions]

    total_interviews = 0
    if session_ids:
        total_interviews = (
            db.query(func.count(InterviewResult.id))
            .filter(InterviewResult.session_id.in_(session_ids))
            .scalar() or 0
        )

    return UserProfileResponse(
        id=current_user.id,
        email=current_user.email,
        username=current_user.username,
        created_at=current_user.created_at,
        total_sessions=len(sessions),
        avg_match_score=round(sum(scores) / len(scores), 1) if scores else None,
        total_interviews=total_interviews,
        best_score=max(scores) if scores else None,
    )


@router.post("/refresh", response_model=TokenResponse)
def refresh(refresh_token: str, db: Session = Depends(get_db)):
    """Exchange a valid refresh token for a new access token."""

    payload = decode_token(refresh_token)

    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid token type")

    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == int(user_id)).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    token_data = {"sub": str(user.id)}
    return TokenResponse(
        access_token=create_access_token(token_data),
        refresh_token=create_refresh_token(token_data),
    )
