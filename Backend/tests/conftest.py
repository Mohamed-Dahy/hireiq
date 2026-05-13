import os
from pathlib import Path
from dotenv import load_dotenv

# Load test env vars BEFORE any app module is imported so Settings() succeeds.
load_dotenv(Path(__file__).parent.parent / ".env.test", override=True)

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

import models.security  # noqa: F401 — registers SecurityAuditLog on shared Base
import models.jobs     # noqa: F401 — registers JobApplication, ApplicationActivity, ApplicationContact, RecruiterList, RecruiterCandidate
from models.user import Base, User
from services.auth_service import create_access_token, hash_password
from database import get_db

TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/hireiq_test",
)

_test_engine = create_engine(TEST_DATABASE_URL)
_TestSession = sessionmaker(autocommit=False, autoflush=False, bind=_test_engine)


@pytest.fixture(scope="session", autouse=True)
def _disable_rate_limits():
    """Disable slowapi and flush custom Redis rate-limit keys so tests are idempotent across runs."""
    from limiter import limiter
    from services.cache import redis_client
    limiter.enabled = False
    # Clear any per-email forgot-password rate keys left by a previous test run
    try:
        for key in redis_client.scan_iter("fp:rate:*"):
            redis_client.delete(key)
    except Exception:
        pass
    yield
    limiter.enabled = True


@pytest.fixture(scope="session", autouse=True)
def _create_test_schema():
    Base.metadata.create_all(bind=_test_engine)
    yield
    Base.metadata.drop_all(bind=_test_engine)


@pytest.fixture()
def test_db(_create_test_schema):
    """Each test gets a fresh session; all rows are deleted on teardown."""
    session = _TestSession()
    yield session
    session.rollback()
    for table in reversed(Base.metadata.sorted_tables):
        session.execute(table.delete())
    session.commit()
    session.close()


@pytest.fixture()
def test_client(test_db: Session):
    """FastAPI TestClient wired to the test database session.

    Includes X-Requested-With: XMLHttpRequest so all POST/DELETE requests pass
    the CSRF middleware without needing to repeat the header in every test.
    """
    from app.main import app

    def _override_get_db():
        yield test_db

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(
        app,
        raise_server_exceptions=True,
        headers={"X-Requested-With": "XMLHttpRequest"},
    ) as client:
        yield client
    app.dependency_overrides.clear()


@pytest.fixture()
def no_csrf_client(test_db: Session):
    """TestClient WITHOUT the X-Requested-With header.
    Use only in CSRF-specific tests that verify the middleware blocks unauthenticated requests.
    """
    from app.main import app

    def _override_get_db():
        yield test_db

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app, raise_server_exceptions=True) as client:
        yield client
    app.dependency_overrides.clear()


@pytest.fixture()
def test_user(test_db: Session) -> User:
    """A verified registered user — email_verified=True so login tests work."""
    user = User(
        email="testuser@example.com",
        username="testuser",
        hashed_password=hash_password("TestPass123!"),
        email_verified=True,
    )
    test_db.add(user)
    test_db.commit()
    test_db.refresh(user)
    return user


@pytest.fixture()
def unverified_user(test_db: Session) -> User:
    """A registered but unverified user — for testing the verification flow."""
    user = User(
        email="unverified@example.com",
        username="unverified",
        hashed_password=hash_password("TestPass123!"),
        email_verified=False,
    )
    test_db.add(user)
    test_db.commit()
    test_db.refresh(user)
    return user


@pytest.fixture()
def auth_headers(test_user: User) -> dict:
    """Bearer token headers for the verified test user."""
    token = create_access_token(test_user.id)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture()
def subscribed_headers(test_db: Session) -> dict:
    # Placeholder — upgraded to a real Professional-tier fixture in Phase 5 (T055)
    user = User(
        email="pro@example.com",
        username="prouser",
        hashed_password=hash_password("TestPass123!"),
        email_verified=True,
    )
    test_db.add(user)
    test_db.commit()
    test_db.refresh(user)
    token = create_access_token(user.id)
    return {"Authorization": f"Bearer {token}"}
