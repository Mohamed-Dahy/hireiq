"""
Seed the platform admin account.
Run via: docker compose exec backend python scripts/seed_admin.py
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal
from models.user import User, UserProfile
from services.auth_service import hash_password
from app.config import settings


def seed():
    admin_email    = settings.admin_email
    admin_password = settings.admin_password

    if not admin_email or not admin_password:
        print("[seed_admin] ERROR: ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env")
        sys.exit(1)

    admin_username = admin_email.split("@")[0]

    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == admin_email).first()
        if existing:
            existing.is_admin = True
            existing.hashed_password = hash_password(admin_password)
            existing.email_verified = True
            db.commit()
            print(f"[seed_admin] Updated existing user {admin_email} → is_admin=True")
            return

        admin = User(
            email=admin_email,
            username=admin_username,
            hashed_password=hash_password(admin_password),
            is_admin=True,
            tier="enterprise",
            email_verified=True,
        )
        db.add(admin)
        db.flush()

        profile = UserProfile(user_id=admin.id)
        db.add(profile)
        db.commit()
        print(f"[seed_admin] Created admin account: {admin_email}")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
