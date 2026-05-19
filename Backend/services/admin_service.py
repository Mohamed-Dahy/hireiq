from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from database import get_db
from models.user import User
from services.auth_service import get_current_user


def require_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    if not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return current_user
