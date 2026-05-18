"""Create salary_benchmarks table — Phase 2 Salary Benchmark feature

Revision ID: 011
Revises: 010
Create Date: 2026-05-14
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "011"
down_revision: Union[str, None] = "010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "salary_benchmarks",
        sa.Column("id",              sa.Integer(),     primary_key=True),
        sa.Column("role",            sa.String(100),   nullable=False),
        sa.Column("level",           sa.String(20),    nullable=False),
        sa.Column("country",         sa.String(100),   nullable=False),
        sa.Column("currency",        sa.String(10),    nullable=False),
        sa.Column("min_salary",      sa.Integer(),     nullable=False),
        sa.Column("median_salary",   sa.Integer(),     nullable=False),
        sa.Column("max_salary",      sa.Integer(),     nullable=False),
        sa.Column("usd_min",         sa.Integer(),     nullable=False),
        sa.Column("usd_max",         sa.Integer(),     nullable=False),
        sa.Column("confidence",      sa.String(10),    nullable=False),
        sa.Column("source",          sa.String(100),   nullable=False),
        sa.Column("last_updated_at", sa.DateTime(),    nullable=False),
        sa.UniqueConstraint("role", "level", "country", name="uq_role_level_country"),
    )
    op.create_index("ix_salary_role_level", "salary_benchmarks", ["role", "level"])
    op.create_index("ix_salary_country", "salary_benchmarks", ["country"])


def downgrade() -> None:
    op.drop_index("ix_salary_country")
    op.drop_index("ix_salary_role_level")
    op.drop_table("salary_benchmarks")
