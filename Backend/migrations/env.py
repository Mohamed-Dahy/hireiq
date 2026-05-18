import os
from pathlib import Path
from dotenv import load_dotenv
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool
from alembic import context

# Load .env so DATABASE_URL is available when running alembic outside Docker
load_dotenv(Path(__file__).parent.parent / ".env")

from models.user import Base
import models.security       # noqa: F401 — registers SecurityAuditLog on the shared Base
import models.jobs           # noqa: F401
import models.referral       # noqa: F401
import models.roadmap        # noqa: F401
import models.content        # noqa: F401 — registers SalaryBenchmark, InterviewQuestion, UserQuestionProgress
import models.token_tracking # noqa: F401 — registers TokenUsageLog

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Override sqlalchemy.url from environment — never rely on alembic.ini for secrets
database_url = os.environ.get("DATABASE_URL")
if database_url:
    config.set_main_option("sqlalchemy.url", database_url)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
