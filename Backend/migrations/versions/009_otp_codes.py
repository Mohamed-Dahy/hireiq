"""Drop email/password token tables, add otp_codes, add is_admin + tier to users

Revision ID: 009
Revises: 008
Create Date: 2026-05-14
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "009"
down_revision: Union[str, None] = "008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop old token tables
    op.drop_table("password_reset_tokens")
    op.drop_table("email_verification_tokens")

    # Create otp_codes table
    op.create_table(
        "otp_codes",
        sa.Column("id",            sa.Integer(),            primary_key=True),
        sa.Column("email",         sa.String(),             nullable=False, index=True),
        sa.Column("user_id",       sa.Integer(),            sa.ForeignKey("users.id"), nullable=True, index=True),
        sa.Column("code_hmac",     sa.String(64),           nullable=False),
        sa.Column("purpose",       sa.String(20),           nullable=False),
        sa.Column("expires_at",    sa.DateTime(),           nullable=False),
        sa.Column("attempt_count", sa.Integer(),            nullable=False, server_default=sa.text("0")),
        sa.Column("used_at",       sa.DateTime(),           nullable=True),
        sa.Column("created_at",    sa.DateTime(),           nullable=False, server_default=sa.text("NOW()")),
    )

    # Add columns to users table
    op.add_column("users", sa.Column("is_admin", sa.Boolean(), nullable=False, server_default=sa.text("false")))
    op.add_column("users", sa.Column("tier", sa.String(10), nullable=False, server_default=sa.text("'free'")))


def downgrade() -> None:
    # Remove columns from users table
    op.drop_column("users", "tier")
    op.drop_column("users", "is_admin")

    # Drop otp_codes table
    op.drop_table("otp_codes")

    # Recreate old token tables
    op.create_table(
        "email_verification_tokens",
        sa.Column("id",         sa.Integer(),  primary_key=True),
        sa.Column("user_id",    sa.Integer(),  sa.ForeignKey("users.id"), nullable=False),
        sa.Column("token",      sa.String(),   unique=True, nullable=False, index=True),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("used_at",    sa.DateTime(), nullable=True),
    )

    op.create_table(
        "password_reset_tokens",
        sa.Column("id",         sa.Integer(),  primary_key=True),
        sa.Column("user_id",    sa.Integer(),  sa.ForeignKey("users.id"), nullable=False),
        sa.Column("token",      sa.String(),   unique=True, nullable=False, index=True),
        sa.Column("expires_at", sa.DateTime(), nullable=False),
        sa.Column("used_at",    sa.DateTime(), nullable=True),
    )
