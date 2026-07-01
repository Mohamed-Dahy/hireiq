"""Make recruiter candidates standalone (no CV session required)

Revision ID: 015
Revises: 014
Create Date: 2026-05-21
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "015"
down_revision: Union[str, None] = "014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Make session_id nullable (candidates can now exist without a CV session)
    op.alter_column(
        "recruiter_candidates",
        "session_id",
        existing_type=sa.Integer(),
        nullable=True,
    )

    # Candidate identity fields
    op.add_column(
        "recruiter_candidates",
        sa.Column("candidate_name", sa.String(200), nullable=True),
    )
    op.add_column(
        "recruiter_candidates",
        sa.Column("candidate_email", sa.String(200), nullable=True),
    )
    op.add_column(
        "recruiter_candidates",
        sa.Column("candidate_phone", sa.String(50), nullable=True),
    )
    op.add_column(
        "recruiter_candidates",
        sa.Column("applied_position", sa.String(200), nullable=True),
    )
    op.add_column(
        "recruiter_candidates",
        sa.Column("cv_file_path", sa.String(500), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("recruiter_candidates", "cv_file_path")
    op.drop_column("recruiter_candidates", "applied_position")
    op.drop_column("recruiter_candidates", "candidate_phone")
    op.drop_column("recruiter_candidates", "candidate_email")
    op.drop_column("recruiter_candidates", "candidate_name")
    op.alter_column(
        "recruiter_candidates",
        "session_id",
        existing_type=sa.Integer(),
        nullable=False,
    )
