"""Add sessions_revoked_at to users — invalidates all tokens on password reset (FR-004)

Revision ID: 005
Revises: 004
Create Date: 2026-05-13
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "005"
down_revision: Union[str, None] = "004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("sessions_revoked_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "sessions_revoked_at")
