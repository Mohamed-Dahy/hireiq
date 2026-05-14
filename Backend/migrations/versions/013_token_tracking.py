"""Create token_usage_log table — Phase 2 AI Token Management

Revision ID: 013
Revises: 012
Create Date: 2026-05-14
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "013"
down_revision: Union[str, None] = "012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "token_usage_log",
        sa.Column("id",             sa.Integer(),   primary_key=True),
        sa.Column("user_id",        sa.Integer(),   sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("date",           sa.Date(),      nullable=False),
        sa.Column("tokens_used",    sa.Integer(),   nullable=False),
        sa.Column("operation_type", sa.String(30),  nullable=False),
        sa.Column("tier",           sa.String(10),  nullable=False),
        sa.Column("created_at",     sa.DateTime(),  nullable=False, server_default=sa.text("NOW()")),
    )
    op.create_index("ix_token_usage_user_date", "token_usage_log", ["user_id", "date"])


def downgrade() -> None:
    op.drop_index("ix_token_usage_user_date")
    op.drop_table("token_usage_log")
