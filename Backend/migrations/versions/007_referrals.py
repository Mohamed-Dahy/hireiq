"""Add referral_codes and referral_conversions tables — Phase 9 Referral Engine

Revision ID: 007
Revises: 006
Create Date: 2026-05-13
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "007"
down_revision: Union[str, None] = "006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "referral_codes",
        sa.Column("id",         sa.Integer(),            primary_key=True),
        sa.Column("user_id",    sa.Integer(),            sa.ForeignKey("users.id"), unique=True, nullable=False),
        sa.Column("code",       sa.String(16),           unique=True, nullable=False, index=True),
        sa.Column("created_at", sa.DateTime(),           nullable=False),
    )

    op.create_table(
        "referral_conversions",
        sa.Column("id",               sa.Integer(),  primary_key=True),
        sa.Column("referrer_id",      sa.Integer(),  sa.ForeignKey("users.id"), nullable=False),
        sa.Column("referred_user_id", sa.Integer(),  sa.ForeignKey("users.id"), unique=True, nullable=False),
        sa.Column("converted_at",     sa.DateTime(), nullable=True),
        sa.Column("reward_applied",   sa.Boolean(),  nullable=False, server_default=sa.text("false")),
        sa.Column("days_credited",    sa.Integer(),  nullable=False, server_default=sa.text("10")),
        sa.Column("created_at",       sa.DateTime(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("referral_conversions")
    op.drop_table("referral_codes")
