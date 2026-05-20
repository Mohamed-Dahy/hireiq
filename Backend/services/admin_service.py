"""
admin_service.py
----------------
Admin authentication: role-claim JWT (no DB user lookup).
Admin credentials are validated via constant-time comparison against env config.
"""

import hmac
import uuid
from datetime import datetime, timedelta

from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt

from app.config import settings

_bearer = HTTPBearer()


def verify_admin_credentials(email: str, password: str) -> bool:
    email_ok = hmac.compare_digest(email.encode(), settings.admin_email.encode())
    pass_ok = hmac.compare_digest(password.encode(), settings.admin_password.encode())
    return email_ok and pass_ok


def create_admin_token() -> str:
    now = datetime.utcnow()
    payload = {
        "sub": "admin",
        "role": "admin",
        "iat": now,
        "exp": now + timedelta(minutes=settings.admin_jwt_expire_minutes),
        "jti": str(uuid.uuid4()),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def require_admin(credentials: HTTPAuthorizationCredentials = Depends(_bearer)) -> None:
    try:
        payload = jwt.decode(
            credentials.credentials,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
        if payload.get("role") != "admin":
            raise HTTPException(status_code=403, detail="Admin access required")
    except JWTError:
        raise HTTPException(status_code=403, detail="Invalid or expired admin token")
