"""Store AI-generated interview questions on the CV session

Revision ID: 016
Revises: 015
Create Date: 2026-05-21
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "016"
down_revision: Union[str, None] = "015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "cv_sessions",
        sa.Column("ai_interview_questions", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("cv_sessions", "ai_interview_questions")
