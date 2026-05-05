"""add field sensors and tasks

Revision ID: e8f3b6a2c901
Revises: 9c1a7e6b4d22
Create Date: 2026-05-04 15:45:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "e8f3b6a2c901"
down_revision = "9c1a7e6b4d22"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    indexes_by_table = {
        table: {index["name"] for index in inspector.get_indexes(table)}
        for table in tables
    }

    if "field_moisture_sensors" not in tables:
        op.create_table(
            "field_moisture_sensors",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("field_id", sa.Uuid(), nullable=False),
            sa.Column("name", sa.String(), nullable=False),
            sa.Column("latitude", sa.Float(), nullable=False),
            sa.Column("longitude", sa.Float(), nullable=False),
            sa.Column("depth_cm", sa.Float(), nullable=True),
            sa.Column("simulated_moisture_pct", sa.Float(), nullable=False),
            sa.Column("notes", sa.Text(), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["field_id"], ["fields.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )

    if "ix_field_moisture_sensors_field_id" not in indexes_by_table.get("field_moisture_sensors", set()):
        op.create_index(
            "ix_field_moisture_sensors_field_id",
            "field_moisture_sensors",
            ["field_id"],
        )

    if "field_tasks" not in tables:
        op.create_table(
            "field_tasks",
            sa.Column("id", sa.Uuid(), nullable=False),
            sa.Column("field_id", sa.Uuid(), nullable=False),
            sa.Column("task_type", sa.String(), nullable=False),
            sa.Column("title", sa.String(), nullable=False),
            sa.Column("note", sa.Text(), nullable=True),
            sa.Column("completed", sa.Boolean(), nullable=False),
            sa.Column("source", sa.String(), nullable=False),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            sa.ForeignKeyConstraint(["field_id"], ["fields.id"], ondelete="CASCADE"),
            sa.PrimaryKeyConstraint("id"),
        )

    if "ix_field_tasks_field_id" not in indexes_by_table.get("field_tasks", set()):
        op.create_index("ix_field_tasks_field_id", "field_tasks", ["field_id"])


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    tables = set(inspector.get_table_names())
    indexes_by_table = {
        table: {index["name"] for index in inspector.get_indexes(table)}
        for table in tables
    }

    if "field_tasks" in tables:
        if "ix_field_tasks_field_id" in indexes_by_table.get("field_tasks", set()):
            op.drop_index("ix_field_tasks_field_id", table_name="field_tasks")
        op.drop_table("field_tasks")

    if "field_moisture_sensors" in tables:
        if "ix_field_moisture_sensors_field_id" in indexes_by_table.get("field_moisture_sensors", set()):
            op.drop_index("ix_field_moisture_sensors_field_id", table_name="field_moisture_sensors")
        op.drop_table("field_moisture_sensors")
