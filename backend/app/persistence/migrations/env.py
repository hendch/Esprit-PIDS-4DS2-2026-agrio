from __future__ import annotations

import asyncio

from alembic import context
from sqlalchemy.ext.asyncio import create_async_engine

from app.persistence.base_model import Base
from app.settings import settings

# Import all model modules so SQLAlchemy metadata is fully populated for autogenerate.
import app.modules.analytics.models  # noqa: F401
import app.modules.auth.models  # noqa: F401
import app.modules.disease.models  # noqa: F401
import app.modules.farms.models  # noqa: F401
import app.modules.irrigation.models  # noqa: F401
import app.modules.ledger.models  # noqa: F401
import app.modules.livestock.models  # noqa: F401
import app.modules.market_prices.db_models  # noqa: F401
import app.modules.media.models  # noqa: F401
import app.modules.notification.models  # noqa: F401
import app.modules.produce_prices.db_models  # noqa: F401
import app.modules.satellite.models  # noqa: F401
import app.modules.community.models  # noqa: F401

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=settings.database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection) -> None:  # noqa: ANN001
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    connectable = create_async_engine(settings.database_url, pool_pre_ping=True)
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
