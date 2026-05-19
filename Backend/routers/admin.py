from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from database import get_db
from models.user import User
from services.admin_service import require_admin
from services.analytics_service import get_platform_metrics, get_all_users

router = APIRouter()


@router.get("/metrics")
def admin_metrics(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    return get_platform_metrics(db)


@router.get("/users")
def list_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    return {"users": get_all_users(db, skip=skip, limit=limit)}


@router.patch("/users/{user_id}/tier")
def set_user_tier(
    user_id: int,
    tier: str = Query(..., pattern="^(free|pro|enterprise)$"),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.tier = tier
    db.commit()
    return {"id": user_id, "tier": tier}


@router.patch("/users/{user_id}/admin")
def toggle_admin(
    user_id: int,
    is_admin: bool = Query(...),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot change your own admin status")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_admin = is_admin
    db.commit()
    return {"id": user_id, "is_admin": is_admin}


@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    db.delete(user)
    db.commit()
    return {"deleted": user_id}


@router.patch("/users/{user_id}/unlock")
def unlock_user(
    user_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.locked_until = None
    user.failed_login_count = 0
    db.commit()
    return {"id": user_id, "unlocked": True}
