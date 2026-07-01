"""Drop salary_benchmarks table (feature removed)

Revision ID: 018
Revises: 017
Create Date: 2026-05-23
"""
from alembic import op
import sqlalchemy as sa

revision = "018"
down_revision = "017"
branch_labels = None
depends_on = None


def upgrade():
    # IF EXISTS: table may not exist on fresh deployments since migration 011 was removed
    op.execute("DROP TABLE IF EXISTS salary_benchmarks")


def downgrade():
    op.create_table(
        "salary_benchmarks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("role", sa.String(100), nullable=False),
        sa.Column("level", sa.String(20), nullable=False),
        sa.Column("country", sa.String(100), nullable=False),
        sa.Column("currency", sa.String(10), nullable=False),
        sa.Column("min_salary", sa.Integer(), nullable=False),
        sa.Column("median_salary", sa.Integer(), nullable=False),
        sa.Column("max_salary", sa.Integer(), nullable=False),
        sa.Column("usd_min", sa.Integer(), nullable=False),
        sa.Column("usd_max", sa.Integer(), nullable=False),
        sa.Column("confidence", sa.String(10), nullable=False),
        sa.Column("source", sa.String(100), nullable=False),
        sa.Column("last_updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("role", "level", "country", name="uq_salary_role_level_country"),
    )
