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
