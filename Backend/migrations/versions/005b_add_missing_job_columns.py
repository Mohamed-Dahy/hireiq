"""Add columns missing from job_applications after migration 004 was applied

Columns cv_session_id, applied_date, cover_letter, and rejection_reason were
added to the 004 migration file after the migration had already been applied to
the live database, so they were never created by Alembic.

Revision ID: 005b
Revises: 005
Create Date: 2026-05-13
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "005b"
down_revision: Union[str, None] = "005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "job_applications",
        sa.Column("cv_session_id", sa.Integer(), sa.ForeignKey("cv_sessions.id"), nullable=True),
    )
    op.add_column(
        "job_applications",
        sa.Column("applied_date", sa.Date(), nullable=True),
    )
    op.add_column(
        "job_applications",
        sa.Column("cover_letter", sa.Text(), nullable=True),
    )
    op.add_column(
        "job_applications",
        sa.Column("rejection_reason", sa.String(300), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("job_applications", "rejection_reason")
    op.drop_column("job_applications", "cover_letter")
    op.drop_column("job_applications", "applied_date")
    op.drop_column("job_applications", "cv_session_id")
