"""
database.py
-----------
SQLAlchemy engine + session factory.
Import get_db() as a FastAPI dependency in any router that needs DB access.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from app.config import settings

# Engine — one connection pool shared across the whole app
engine = create_engine(settings.database_url)

# SessionLocal — call this to get a new DB session
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    """
    FastAPI dependency — yields a DB session and closes it when the request ends.
    Usage in a router:  db: Session = Depends(get_db)
    """
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    """Create all tables in Postgres if they don't exist yet."""
    from models.user import Base
    Base.metadata.create_all(bind=engine)
