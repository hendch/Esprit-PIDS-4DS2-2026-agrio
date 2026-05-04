"""add field profile columns

Revision ID: 9c1a7e6b4d22
Revises: b074cafe5a1b
Create Date: 2026-05-03 10:20:00.000000

"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = "9c1a7e6b4d22"
down_revision: Union[str, None] = "b074cafe5a1b"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("fields", sa.Column("centroid_lat", sa.Float(), nullable=True))
    op.add_column("fields", sa.Column("centroid_lon", sa.Float(), nullable=True))
    op.add_column("fields", sa.Column("governorate", sa.String(), nullable=True))
    op.add_column("fields", sa.Column("planting_date", sa.Date(), nullable=True))
    op.add_column(
        "fields",
        sa.Column("irrigated", sa.Boolean(), nullable=False, server_default=sa.text("false")),
    )
    op.add_column("fields", sa.Column("irrigation_method", sa.String(), nullable=True))
    op.add_column("fields", sa.Column("field_notes", sa.Text(), nullable=True))
    op.alter_column("fields", "irrigated", server_default=None)


def downgrade() -> None:
    op.drop_column("fields", "field_notes")
    op.drop_column("fields", "irrigation_method")
    op.drop_column("fields", "irrigated")
    op.drop_column("fields", "planting_date")
    op.drop_column("fields", "governorate")
    op.drop_column("fields", "centroid_lon")
    op.drop_column("fields", "centroid_lat")
