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

ADMIN_EMAIL    = "admin@hireiq.com"
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "admin_hireiq"


def seed():
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == ADMIN_EMAIL).first()
        if existing:
            existing.is_admin = True
            existing.hashed_password = hash_password(ADMIN_PASSWORD)
            existing.email_verified = True
            db.commit()
            print(f"[seed_admin] Updated existing user {ADMIN_EMAIL} → is_admin=True")
            return

        admin = User(
            email=ADMIN_EMAIL,
            username=ADMIN_USERNAME,
            hashed_password=hash_password(ADMIN_PASSWORD),
            is_admin=True,
            tier="enterprise",
            email_verified=True,
        )
        db.add(admin)
        db.flush()

        profile = UserProfile(user_id=admin.id)
        db.add(profile)
        db.commit()
        print(f"[seed_admin] Created admin account: {ADMIN_EMAIL}")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
