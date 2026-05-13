"""Add career_roadmaps table — Phase 11 Career Roadmap

Revision ID: 008
Revises: 007
Create Date: 2026-05-13
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "008"
down_revision: Union[str, None] = "007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "career_roadmaps",
        sa.Column("id",            sa.Integer(),  primary_key=True),
        sa.Column("user_id",       sa.Integer(),  sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("cv_session_id", sa.Integer(),  sa.ForeignKey("cv_sessions.id"), nullable=True),
        sa.Column("target_role",   sa.String(),   nullable=False),
        sa.Column("roadmap_data",  sa.Text(),     nullable=False),
        sa.Column("created_at",    sa.DateTime(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("career_roadmaps")
