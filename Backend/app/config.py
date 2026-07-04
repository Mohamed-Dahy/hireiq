import sys
from pydantic_settings import BaseSettings, SettingsConfigDict
from loguru import logger


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # --- Groq ---
    groq_api_key: str

    # --- Embeddings ---
    embedding_model: str = "all-MiniLM-L6-v2"

    # --- PostgreSQL ---
    database_url: str

    # --- Redis ---
    redis_url: str = "redis://localhost:6379"

    # --- JWT auth ---
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

    # --- File uploads ---
    upload_dir: str = "./uploads"

    # --- CORS ---
    allowed_origins: str = "http://localhost:5173"

    # --- Email (Resend) ---
    resend_api_key: str = ""
    from_email: str = "noreply@hireiq.app"
    app_base_url: str = "http://localhost:3000"

    # --- Paymob ---
    paymob_api_key: str = ""
    paymob_integration_id: str = ""
    paymob_hmac_secret: str = ""
    paymob_iframe_id: str = ""

    # --- Postgres credentials (used by docker-compose) ---
    postgres_user: str = "postgres"
    postgres_password: str = ""
    postgres_db: str = "hireiq"

    # --- OTP ---
    otp_hmac_secret: str = ""
    otp_expiry_minutes: int = 10
    otp_max_attempts: int = 5
    otp_rate_limit_per_30min: int = 3

    # --- AI Token / Quota ---
    free_tier_analysis_limit: int = 2
    free_tier_window_days: int = 10
    paid_tier_daily_token_limit: int = 10000
    llm_provider: str = "groq"
    llm_model: str = "llama-3.3-70b-versatile"
    groq_price_per_1k_tokens: float = 0.0006

    # --- ATS Score Checker ---
    # Non-secret scoring thresholds (env-overridable). Category weights below
    # are a plain default mapping consumed by services/ats_checker.py.
    ats_min_words: int = 300              # CVs shorter than this are flagged as too thin
    ats_max_pages: int = 2                # CVs longer than this are flagged as too long
    ats_min_action_verbs: int = 5         # minimum distinct action verbs expected
    ats_min_parse_chars_per_page: int = 250  # below this avg ⇒ likely image-only/scanned
    ats_keyword_timeout_seconds: int = 20     # hard cap on the JD keyword-coverage LLM call
    ats_strength_threshold: float = 0.9       # category sub-score at/above which it counts as a "strength"
    ats_next_steps_max: int = 3               # max prioritized actions in the "what to do next" summary
    # Spec 004 — ATS-grade upgrade (non-secret data-file locations)
    ats_vocab_dir: str = "./data/vocab"           # action_verbs.txt, skills.json, keyword_synonyms.json
    ats_calibration_dir: str = "./data/ats_calibration"  # labeled/ CVs + labels.json (evaluation only)
    ats_category_weights: dict[str, float] = {
        "parseability": 0.20,
        "sections": 0.18,
        "headings": 0.08,
        "contact": 0.12,
        "formatting": 0.12,
        "unfriendly_elements": 0.08,
        "content_quality": 0.14,
        "dates": 0.08,
    }

    # --- Admin ---
    admin_email: str = ""
    admin_password: str = ""
    admin_jwt_expire_minutes: int = 120

    # --- Logging ---
    log_format: str = "text"


settings = Settings()


def configure_logging() -> None:
    logger.remove()
    if settings.log_format == "json":
        logger.add(sys.stdout, serialize=True, level="INFO")
    else:
        logger.add(sys.stdout, colorize=True, level="INFO",
                   format="<green>{time:HH:mm:ss}</green> | <level>{level: <8}</level> | {message}")
