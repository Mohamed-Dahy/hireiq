"""cv_sessions extended: structured analysis columns + LinkedIn flag

Revision ID: 003
Revises: 002
Create Date: 2026-05-12
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = "003"
down_revision: Union[str, None] = "002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("cv_sessions", sa.Column("skill_inventory", sa.Text(), nullable=True))
    op.add_column("cv_sessions", sa.Column("gap_report", sa.Text(), nullable=True))
    op.add_column("cv_sessions", sa.Column("study_roadmap", sa.Text(), nullable=True))
    op.add_column(
        "cv_sessions",
        sa.Column("is_linkedin", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade() -> None:
    op.drop_column("cv_sessions", "is_linkedin")
    op.drop_column("cv_sessions", "study_roadmap")
    op.drop_column("cv_sessions", "gap_report")
    op.drop_column("cv_sessions", "skill_inventory")
