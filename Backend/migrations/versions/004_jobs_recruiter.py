"""job_applications, activities, contacts — Phase 6 ATS

Revision ID: 004
Revises: 003
Create Date: 2026-05-12
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "004"
down_revision: Union[str, None] = "003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "job_applications",
        sa.Column("id",               sa.Integer(),    primary_key=True),
        sa.Column("user_id",          sa.Integer(),    sa.ForeignKey("users.id"), nullable=False),
        sa.Column("cv_session_id",    sa.Integer(),    sa.ForeignKey("cv_sessions.id"), nullable=True),
        sa.Column("company",          sa.String(200),  nullable=False),
        sa.Column("title",            sa.String(200),  nullable=False),
        sa.Column("location",         sa.String(200),  nullable=True),
        sa.Column("remote_type",      sa.String(20),   nullable=True),
        sa.Column("job_url",          sa.Text(),       nullable=True),
        sa.Column("jd_text",          sa.Text(),       nullable=True),
        sa.Column("status",           sa.String(30),   nullable=False, server_default="saved"),
        sa.Column("stage_entered_at", sa.DateTime(),   nullable=False),
        sa.Column("source",           sa.String(50),   nullable=True),
        sa.Column("priority",         sa.String(10),   nullable=True),
        sa.Column("applied_date",     sa.Date(),       nullable=True),
        sa.Column("deadline_date",    sa.Date(),       nullable=True),
        sa.Column("followup_date",    sa.Date(),       nullable=True),
        sa.Column("salary_min",       sa.Integer(),    nullable=True),
        sa.Column("salary_max",       sa.Integer(),    nullable=True),
        sa.Column("notes",            sa.Text(),       nullable=True),
        sa.Column("cover_letter",     sa.Text(),       nullable=True),
        sa.Column("rejection_reason", sa.String(300),  nullable=True),
        sa.Column("match_score",      sa.Float(),      nullable=True),
        sa.Column("ai_gap_summary",   sa.Text(),       nullable=True),
        sa.Column("ai_prep_questions",sa.Text(),       nullable=True),
        sa.Column("is_archived",      sa.Boolean(),    nullable=False, server_default="false"),
        sa.Column("created_at",       sa.DateTime(),   nullable=False),
        sa.Column("updated_at",       sa.DateTime(),   nullable=False),
    )
    op.create_index("ix_job_applications_user_id", "job_applications", ["user_id"])
    op.create_index("ix_job_applications_status",  "job_applications", ["status"])

    op.create_table(
        "application_activities",
        sa.Column("id",                 sa.Integer(),  primary_key=True),
        sa.Column("job_application_id", sa.Integer(),  sa.ForeignKey("job_applications.id"), nullable=False),
        sa.Column("user_id",            sa.Integer(),  sa.ForeignKey("users.id"), nullable=False),
        sa.Column("event_type",         sa.String(50), nullable=False),
        sa.Column("event_date",         sa.Date(),     nullable=False),
        sa.Column("notes",              sa.Text(),     nullable=True),
        sa.Column("created_at",         sa.DateTime(), nullable=False),
    )
    op.create_index("ix_application_activities_job_id", "application_activities", ["job_application_id"])

    op.create_table(
        "application_contacts",
        sa.Column("id",                 sa.Integer(),    primary_key=True),
        sa.Column("job_application_id", sa.Integer(),    sa.ForeignKey("job_applications.id"), nullable=False),
        sa.Column("name",               sa.String(200),  nullable=False),
        sa.Column("role",               sa.String(100),  nullable=True),
        sa.Column("email",              sa.String(200),  nullable=True),
        sa.Column("phone",              sa.String(50),   nullable=True),
        sa.Column("linkedin_url",       sa.Text(),       nullable=True),
        sa.Column("notes",              sa.Text(),       nullable=True),
        sa.Column("created_at",         sa.DateTime(),   nullable=False),
    )
    op.create_index("ix_application_contacts_job_id", "application_contacts", ["job_application_id"])


def downgrade() -> None:
    op.drop_table("application_contacts")
    op.drop_table("application_activities")
    op.drop_table("job_applications")
