from __future__ import annotations

import os
from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

from alembic import context

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Import all models so autogenerate can detect them
from app.persistence.base_model import Base
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

target_metadata = Base.metadata


def _get_url() -> str:
    # Read from env, fallback to alembic.ini sqlalchemy.url
    url = os.environ.get("AGRIO_DATABASE_URL") or config.get_main_option("sqlalchemy.url", "")
    # Alembic uses a sync driver; swap asyncpg for psycopg2
    return url.replace("postgresql+asyncpg://", "postgresql+psycopg2://")


def run_migrations_offline() -> None:
    context.configure(
        url=_get_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    cfg = config.get_section(config.config_ini_section, {})
    cfg["sqlalchemy.url"] = _get_url()
    connectable = engine_from_config(cfg, prefix="sqlalchemy.", poolclass=pool.NullPool)
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
