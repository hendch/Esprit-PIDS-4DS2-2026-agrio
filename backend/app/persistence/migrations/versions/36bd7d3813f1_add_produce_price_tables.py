"""add produce price tables

Revision ID: 36bd7d3813f1
Revises: 75def6815279
Create Date: 2026-04-19 23:35:09.403128

"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = '36bd7d3813f1'
down_revision: Union[str, None] = '75def6815279'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'produce_price_history',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('product', sa.String(length=64), nullable=False),
        sa.Column('category', sa.String(length=16), nullable=False),
        sa.Column('price_date', sa.Date(), nullable=False),
        sa.Column('retail_mid', sa.Float(), nullable=False),
        sa.Column('wholesale_mid', sa.Float(), nullable=False),
        sa.Column('qte', sa.Float(), nullable=True),
        sa.Column('unit', sa.String(length=32), nullable=False, server_default='millimes/kg'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('product', 'price_date', name='uq_produce_product_date'),
    )
    op.create_index('ix_produce_price_history_product', 'produce_price_history', ['product'])
    op.create_index('ix_produce_price_history_category', 'produce_price_history', ['category'])
    op.create_index('ix_produce_price_history_price_date', 'produce_price_history', ['price_date'])

    op.create_table(
        'produce_price_forecasts',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('product', sa.String(length=64), nullable=False),
        sa.Column('category', sa.String(length=16), nullable=False),
        sa.Column('model_used', sa.String(length=32), nullable=False),
        sa.Column('generated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('horizon_weeks', sa.Integer(), nullable=False),
        sa.Column('forecast_json', sa.JSON(), nullable=True),
        sa.Column('scenarios_json', sa.JSON(), nullable=True),
        sa.Column('backtest_metrics', sa.JSON(), nullable=True),
        sa.Column('best_mape', sa.Float(), nullable=True),
        sa.Column('best_mase', sa.Float(), nullable=True),
        sa.Column('warnings', sa.JSON(), nullable=True),
        sa.Column('is_latest', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_produce_price_forecasts_product', 'produce_price_forecasts', ['product'])
    op.create_index('ix_produce_price_forecasts_category', 'produce_price_forecasts', ['category'])
    op.create_index('ix_produce_price_forecasts_generated_at', 'produce_price_forecasts', ['generated_at'])
    op.create_index('ix_produce_price_forecasts_is_latest', 'produce_price_forecasts', ['is_latest'])


def downgrade() -> None:
    op.drop_index('ix_produce_price_forecasts_is_latest', table_name='produce_price_forecasts')
    op.drop_index('ix_produce_price_forecasts_generated_at', table_name='produce_price_forecasts')
    op.drop_index('ix_produce_price_forecasts_category', table_name='produce_price_forecasts')
    op.drop_index('ix_produce_price_forecasts_product', table_name='produce_price_forecasts')
    op.drop_table('produce_price_forecasts')

    op.drop_index('ix_produce_price_history_price_date', table_name='produce_price_history')
    op.drop_index('ix_produce_price_history_category', table_name='produce_price_history')
    op.drop_index('ix_produce_price_history_product', table_name='produce_price_history')
    op.drop_table('produce_price_history')
