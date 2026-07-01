"""Add status, notes, starred to recruiter_candidates

Revision ID: 014
Revises: 013
Create Date: 2026-05-21
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "014"
down_revision: Union[str, None] = "013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "recruiter_candidates",
        sa.Column("status", sa.String(20), nullable=False, server_default="new"),
    )
    op.add_column(
        "recruiter_candidates",
        sa.Column("notes", sa.Text(), nullable=True),
    )
    op.add_column(
        "recruiter_candidates",
        sa.Column("starred", sa.Boolean(), nullable=False, server_default="false"),
    )


def downgrade() -> None:
    op.drop_column("recruiter_candidates", "starred")
    op.drop_column("recruiter_candidates", "notes")
    op.drop_column("recruiter_candidates", "status")
