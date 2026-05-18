"""Create interview_questions and user_question_progress — Phase 2 Interview Bank

Revision ID: 012
Revises: 011
Create Date: 2026-05-14
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "012"
down_revision: Union[str, None] = "011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "interview_questions",
        sa.Column("id",            sa.Integer(),   primary_key=True),
        sa.Column("role",          sa.String(100), nullable=False, index=True),
        sa.Column("level",         sa.String(20),  nullable=False),
        sa.Column("category",      sa.String(30),  nullable=False),
        sa.Column("question_text", sa.Text(),      nullable=False),
        sa.Column("model_answer",  sa.Text(),      nullable=False),
        sa.Column("source",        sa.String(20),  nullable=False),
        sa.Column("content_hash",  sa.String(64),  unique=True, nullable=False),
        sa.Column("created_at",    sa.DateTime(),  nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index("ix_interview_role_level", "interview_questions", ["role", "level"])
    op.create_index("ix_interview_category", "interview_questions", ["category"])

    op.create_table(
        "user_question_progress",
        sa.Column("id",           sa.Integer(),  primary_key=True),
        sa.Column("user_id",      sa.Integer(),  sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("question_id",  sa.Integer(),  sa.ForeignKey("interview_questions.id"), nullable=False),
        sa.Column("practiced_at", sa.DateTime(), nullable=False, server_default=sa.text("NOW()")),
        sa.UniqueConstraint("user_id", "question_id", name="uq_user_question"),
    )


def downgrade() -> None:
    op.drop_table("user_question_progress")
    op.drop_index("ix_interview_category")
    op.drop_index("ix_interview_role_level")
    op.drop_table("interview_questions")
