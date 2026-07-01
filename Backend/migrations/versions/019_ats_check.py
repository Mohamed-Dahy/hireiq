"""ATS Score Checker: optional JD + ATS result columns on cv_sessions

Revision ID: 019
Revises: 018
Create Date: 2026-07-01

- jd_text becomes nullable (ATS Check runs with no job description)
- analysis_mode distinguishes 'job_match' vs 'ats_check' in history
- ats_score / ats_result store the deterministic ATS outcome
- from_stored_cv marks sessions derived from the user's stored CV
  (enables the stored-CV deletion cascade)
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "019"
down_revision: Union[str, None] = "018"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Existing rows are all job-match sessions with a non-null jd_text.
    op.add_column(
        "cv_sessions",
        sa.Column("analysis_mode", sa.String(20), nullable=False, server_default="job_match"),
    )
    op.add_column("cv_sessions", sa.Column("ats_score", sa.Float(), nullable=True))
    op.add_column("cv_sessions", sa.Column("ats_result", sa.Text(), nullable=True))
    op.add_column(
        "cv_sessions",
        sa.Column("from_stored_cv", sa.Boolean(), nullable=False, server_default=sa.false()),
    )

    # Make the job description optional now that ATS Check can run without one.
    op.alter_column("cv_sessions", "jd_text", existing_type=sa.Text(), nullable=True)


def downgrade() -> None:
    # Restore NOT NULL only succeeds if no null jd_text rows exist; backfill if needed.
    op.execute("UPDATE cv_sessions SET jd_text = '' WHERE jd_text IS NULL")
    op.alter_column("cv_sessions", "jd_text", existing_type=sa.Text(), nullable=False)
    op.drop_column("cv_sessions", "from_stored_cv")
    op.drop_column("cv_sessions", "ats_result")
    op.drop_column("cv_sessions", "ats_score")
    op.drop_column("cv_sessions", "analysis_mode")
