"""
Unit tests for auth_service.py
-------------------------------
These tests run against the real test PostgreSQL database.
Redis is used but failure is tolerated (fail-open policy).
"""

from datetime import datetime, timedelta

import pytest
from fastapi import HTTPException

from models.user import User
from services.auth_service import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
    blacklist_jti,
    is_jti_blacklisted,
    check_account_locked,
    record_failed_login,
    reset_failed_login,
    MAX_FAILED_LOGINS,
    LOCKOUT_MINUTES,
)


# ---------------------------------------------------------------------------
# Password hashing
# ---------------------------------------------------------------------------

def test_hash_and_verify_password():
    hashed = hash_password("MySecret123!")
    assert verify_password("MySecret123!", hashed)
    assert not verify_password("wrongpassword", hashed)


def test_bcrypt_hash_is_unique():
    h1 = hash_password("same")
    h2 = hash_password("same")
    assert h1 != h2  # different salts


# ---------------------------------------------------------------------------
# JWT creation and decoding
# ---------------------------------------------------------------------------

def test_create_access_token_has_required_claims():
    token = create_access_token(42)
    payload = decode_token(token)
    assert payload["sub"] == "42"
    assert payload["type"] == "access"
    assert "jti" in payload
    assert "iat" in payload
    assert "exp" in payload


def test_create_refresh_token_has_required_claims():
    token = create_refresh_token(99)
    payload = decode_token(token)
    assert payload["sub"] == "99"
    assert payload["type"] == "refresh"
    assert "jti" in payload


def test_two_tokens_have_different_jtis():
    t1 = create_access_token(1)
    t2 = create_access_token(1)
    p1 = decode_token(t1)
    p2 = decode_token(t2)
    assert p1["jti"] != p2["jti"]


def test_decode_invalid_token_raises_401():
    with pytest.raises(HTTPException) as exc_info:
        decode_token("not.a.real.token")
    assert exc_info.value.status_code == 401


# ---------------------------------------------------------------------------
# JTI blacklist
# ---------------------------------------------------------------------------

def test_jti_not_blacklisted_initially():
    token = create_access_token(1)
    payload = decode_token(token)
    assert not is_jti_blacklisted(payload["jti"])


def test_blacklist_jti_marks_as_revoked():
    token = create_access_token(1)
    payload = decode_token(token)
    jti = payload["jti"]

    blacklist_jti(jti, ttl_seconds=60)
    assert is_jti_blacklisted(jti)


# ---------------------------------------------------------------------------
# Account lockout
# ---------------------------------------------------------------------------

def test_check_account_locked_passes_when_not_locked(test_db):
    user = User(
        email="locktest@example.com",
        username="locktest",
        hashed_password=hash_password("x"),
        email_verified=True,
    )
    test_db.add(user)
    test_db.commit()

    check_account_locked(user)  # should not raise


def test_check_account_locked_raises_when_locked(test_db):
    user = User(
        email="locked@example.com",
        username="lockeduser",
        hashed_password=hash_password("x"),
        email_verified=True,
        locked_until=datetime.utcnow() + timedelta(minutes=10),
    )
    test_db.add(user)
    test_db.commit()

    with pytest.raises(HTTPException) as exc_info:
        check_account_locked(user)
    assert exc_info.value.status_code == 423


def test_record_failed_login_increments_count(test_db):
    user = User(
        email="failcount@example.com",
        username="failcount",
        hashed_password=hash_password("x"),
        email_verified=True,
    )
    test_db.add(user)
    test_db.commit()

    record_failed_login(test_db, user)
    test_db.refresh(user)
    assert user.failed_login_count == 1


def test_account_locks_after_max_failures(test_db):
    user = User(
        email="willlock@example.com",
        username="willlock",
        hashed_password=hash_password("x"),
        email_verified=True,
    )
    test_db.add(user)
    test_db.commit()

    for _ in range(MAX_FAILED_LOGINS):
        record_failed_login(test_db, user)
    test_db.refresh(user)

    assert user.locked_until is not None
    assert user.locked_until > datetime.utcnow()


def test_reset_failed_login_clears_state(test_db):
    user = User(
        email="resetfail@example.com",
        username="resetfail",
        hashed_password=hash_password("x"),
        email_verified=True,
        failed_login_count=3,
        locked_until=datetime.utcnow() + timedelta(minutes=5),
    )
    test_db.add(user)
    test_db.commit()

    reset_failed_login(test_db, user)
    test_db.refresh(user)

    assert user.failed_login_count == 0
    assert user.locked_until is None


