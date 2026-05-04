"""add user_id to irrigation_schedules

Revision ID: 1f70abada7a2
Revises: e8f3b6a2c901
Create Date: 2026-05-04 23:00:00.000000
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "1f70abada7a2"
down_revision = "e8f3b6a2c901"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    columns = [c["name"] for c in inspector.get_columns("irrigation_schedules")]

    if "user_id" not in columns:
        op.add_column(
            "irrigation_schedules",
            sa.Column("user_id", sa.String(), nullable=False, server_default=""),
        )
        op.create_index(
            "ix_irrigation_schedules_user_id",
            "irrigation_schedules",
            ["user_id"],
        )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    indexes = {i["name"] for i in inspector.get_indexes("irrigation_schedules")}

    if "ix_irrigation_schedules_user_id" in indexes:
        op.drop_index("ix_irrigation_schedules_user_id", table_name="irrigation_schedules")

    columns = [c["name"] for c in inspector.get_columns("irrigation_schedules")]
    if "user_id" in columns:
        op.drop_column("irrigation_schedules", "user_id")
