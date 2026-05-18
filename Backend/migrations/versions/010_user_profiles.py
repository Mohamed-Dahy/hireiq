"""Create user_profiles table — Phase 2 Profile feature

Revision ID: 010
Revises: 009
Create Date: 2026-05-14
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "010"
down_revision: Union[str, None] = "009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "user_profiles",
        sa.Column("id",                 sa.Integer(),    primary_key=True),
        sa.Column("user_id",            sa.Integer(),    sa.ForeignKey("users.id"), unique=True, nullable=False),
        sa.Column("stored_cv_path",     sa.String(),     nullable=True),
        sa.Column("stored_cv_filename", sa.String(),     nullable=True),
        sa.Column("linkedin_url",       sa.String(500),  nullable=True),
        sa.Column("github_url",         sa.String(500),  nullable=True),
        sa.Column("portfolio_url",      sa.String(500),  nullable=True),
        sa.Column("bio",                sa.Text(),       nullable=True),
        sa.Column("avatar_url",         sa.String(500),  nullable=True),
        sa.Column("updated_at",         sa.DateTime(),   nullable=False, server_default=sa.text("NOW()")),
    )


def downgrade() -> None:
    op.drop_table("user_profiles")
