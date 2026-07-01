import os
from pathlib import Path
from dotenv import load_dotenv

# Load test env vars BEFORE any app module is imported so Settings() succeeds.
load_dotenv(Path(__file__).parent.parent / ".env.test", override=True)

import fakeredis
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session

import models.security       # noqa: F401 — registers SecurityAuditLog on shared Base
import models.jobs            # noqa: F401 — registers JobApplication, ApplicationActivity, ApplicationContact, RecruiterList, RecruiterCandidate
import models.referral        # noqa: F401 — registers ReferralCode, ReferralConversion
import models.roadmap         # noqa: F401 — registers CareerRoadmap
import models.content         # noqa: F401 — registers InterviewQuestion, UserQuestionProgress
import models.token_tracking  # noqa: F401 — registers TokenUsageLog
from models.user import Base, User
from services.auth_service import create_access_token, hash_password
from database import get_db

import socket

TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/hireiq_test",
)

# Auto-detect execution context: if 'postgres' host is unreachable from host,
# fall back to localhost so tests can run both inside Docker and on bare metal.
def _resolve_test_db_url(original_url: str) -> str:
    if "postgres" in original_url and "localhost" not in original_url:
        try:
            socket.getaddrinfo("postgres", 5432)
        except (socket.gaierror, OSError):
            original_url = original_url.replace("@postgres:", "@localhost:")
    return original_url

TEST_DATABASE_URL = _resolve_test_db_url(TEST_DATABASE_URL)

_test_engine = create_engine(TEST_DATABASE_URL)
_TestSession = sessionmaker(autocommit=False, autoflush=False, bind=_test_engine)


# ── Redis: replace real Redis with an in-memory fake for the whole test session ──

@pytest.fixture(scope="session", autouse=True)
def _fake_redis_session():
    """
    Swap every module-level redis_client reference to a FakeRedis instance.
    This runs once for the entire session so all imports see the same fake.
    Using a FakeServer means all FakeRedis instances share state (same as a
    real Redis server would), while remaining fully in-process with no deps.
    """
    import services.cache as cache_mod
    import services.auth_service as auth_mod
    import services.otp_service as otp_mod
    from limiter import limiter

    server = fakeredis.FakeServer()
    fake = fakeredis.FakeRedis(server=server, decode_responses=True)

    # Patch all three import sites
    cache_mod.redis_client = fake
    auth_mod.redis_client  = fake
    otp_mod.redis_client   = fake

    # Disable rate-limiting middleware so tests don't hit request limits
    limiter.enabled = False

    yield fake

    limiter.enabled = True


@pytest.fixture(autouse=True)
def _flush_redis(_fake_redis_session):
    """Wipe the fake Redis store before every test for a clean slate."""
    _fake_redis_session.flushall()
    yield


# ── Database schema: create once, keep for the whole session ─────────────────

@pytest.fixture(scope="session", autouse=True)
def _create_test_schema():
    Base.metadata.create_all(bind=_test_engine)
    yield
    Base.metadata.drop_all(bind=_test_engine)


# ── Per-test DB cleanup using TRUNCATE … RESTART IDENTITY CASCADE ────────────

@pytest.fixture()
def test_db(_create_test_schema):
    """
    Each test gets a fresh DB session. On teardown, all tables are truncated
    with RESTART IDENTITY CASCADE so:
      • FK-dependent rows are removed in one shot (no ordering issues)
      • Auto-increment sequences reset to 1 (predictable IDs across tests)
      • The next test always starts from a completely empty database
    """
    session = _TestSession()
    yield session
    session.rollback()
    table_names = ", ".join(t.name for t in Base.metadata.sorted_tables)
    session.execute(text(f"TRUNCATE {table_names} RESTART IDENTITY CASCADE"))
    session.commit()
    session.close()


@pytest.fixture()
def test_client(test_db: Session):
    """FastAPI TestClient wired to the test database session.

    Includes X-Requested-With: XMLHttpRequest so all POST/DELETE requests pass
    the CSRF middleware without needing to repeat the header in every test.
    """
    from app.main import app
    import routers.analysis as _analysis_mod

    def _override_get_db():
        yield test_db

    app.dependency_overrides[get_db] = _override_get_db
    _orig_session_local = _analysis_mod.SessionLocal
    _analysis_mod.SessionLocal = _TestSession
    with TestClient(
        app,
        raise_server_exceptions=True,
        headers={"X-Requested-With": "XMLHttpRequest"},
    ) as client:
        yield client
    app.dependency_overrides.clear()
    _analysis_mod.SessionLocal = _orig_session_local


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
