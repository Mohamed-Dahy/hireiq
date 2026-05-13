"""Add recruiter_lists and recruiter_candidates tables — Phase 7 Recruiter Dashboard

Revision ID: 006
Revises: 005b
Create Date: 2026-05-13
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "006"
down_revision: Union[str, None] = "005b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "recruiter_lists",
        sa.Column("id",         sa.Integer(),    primary_key=True),
        sa.Column("user_id",    sa.Integer(),    sa.ForeignKey("users.id"), nullable=False),
        sa.Column("name",       sa.String(100),  nullable=False),
        sa.Column("job_title",  sa.String(200),  nullable=True),
        sa.Column("created_at", sa.DateTime(),   nullable=False),
    )
    op.create_index("ix_recruiter_lists_user_id", "recruiter_lists", ["user_id"])

    op.create_table(
        "recruiter_candidates",
        sa.Column("id",                sa.Integer(), primary_key=True),
        sa.Column("recruiter_list_id", sa.Integer(), sa.ForeignKey("recruiter_lists.id"), nullable=False),
        sa.Column("session_id",        sa.Integer(), sa.ForeignKey("cv_sessions.id"), nullable=False),
        sa.Column("rank",              sa.Integer(), nullable=True),
        sa.Column("created_at",        sa.DateTime(), nullable=False),
    )
    op.create_index("ix_recruiter_candidates_list_id", "recruiter_candidates", ["recruiter_list_id"])


def downgrade() -> None:
    op.drop_table("recruiter_candidates")
    op.drop_table("recruiter_lists")
