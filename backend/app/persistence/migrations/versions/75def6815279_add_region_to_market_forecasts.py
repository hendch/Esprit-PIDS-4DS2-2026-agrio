"""add region to market_forecasts

Revision ID: 75def6815279
Revises:
Create Date: 2026-04-10 00:23:00.862651

"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = '75def6815279'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add region column with default so existing rows get 'national'
    op.add_column(
        'market_forecasts',
        sa.Column('region', sa.String(length=32), nullable=False, server_default='national'),
    )
    op.create_index('ix_market_forecasts_region', 'market_forecasts', ['region'])

    # Replace old unique constraint (series_name, generated_date)
    # with (series_name, region, generated_date)
    op.drop_constraint('uq_series_generated_date', 'market_forecasts', type_='unique')
    op.create_unique_constraint(
        'uq_series_region_generated_date',
        'market_forecasts',
        ['series_name', 'region', 'generated_date'],
    )


def downgrade() -> None:
    op.drop_constraint('uq_series_region_generated_date', 'market_forecasts', type_='unique')
    op.create_unique_constraint(
        'uq_series_generated_date',
        'market_forecasts',
        ['series_name', 'generated_date'],
    )
    op.drop_index('ix_market_forecasts_region', table_name='market_forecasts')
    op.drop_column('market_forecasts', 'region')
