"""
cache.py
--------
Redis helpers for caching match scores.
Prevents re-running the embedding + scoring pipeline for the same CV+JD pair.

Key pattern: "score:{cv_id}:{jd_id}"
TTL: 1 hour (3600 seconds)
"""

import redis
from app.config import settings

# One Redis connection shared across the app
redis_client = redis.from_url(settings.redis_url, decode_responses=True)


def _score_key(session_id: int) -> str:
    return f"score:{session_id}"


def get_cached_score(session_id: int) -> float | None:
    """Return cached score for this session, or None if not cached / Redis is down."""
    try:
        value = redis_client.get(_score_key(session_id))
        return float(value) if value is not None else None
    except Exception:
        return None  # Redis unavailable — fall through to Postgres


def set_cached_score(session_id: int, score: float, ttl: int = 3600) -> None:
    """Cache the score for this session for 1 hour. Silent no-op if Redis is down."""
    try:
        redis_client.setex(_score_key(session_id), ttl, str(score))
    except Exception:
        pass  # Redis unavailable — app still works, just no caching


def clear_cached_score(session_id: int) -> None:
    """Remove a cached score (useful in tests)."""
    try:
        redis_client.delete(_score_key(session_id))
    except Exception:
        pass
