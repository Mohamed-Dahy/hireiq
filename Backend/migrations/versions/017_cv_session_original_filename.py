"""Store the original uploaded CV filename on the CV session

Revision ID: 017
Revises: 016
Create Date: 2026-05-22
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "017"
down_revision: Union[str, None] = "016"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "cv_sessions",
        sa.Column("original_cv_filename", sa.String(500), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("cv_sessions", "original_cv_filename")
