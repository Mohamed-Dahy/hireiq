from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    # --- Groq (free LLM + Whisper) ---
    groq_api_key: str

    # --- Embeddings (runs locally, no API key needed) ---
    embedding_model: str = "all-MiniLM-L6-v2"

    # --- PostgreSQL ---
    database_url: str

    # --- Redis (score caching) ---
    redis_url: str = "redis://localhost:6379"

    # --- JWT auth ---
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 30

    # --- File uploads ---
    upload_dir: str = "./uploads"

    # --- CORS ---
    allowed_origins: str = "http://localhost:5173"

class Config:
        env_file = ".env"


# One shared instance imported everywhere
settings = Settings()
