from __future__ import annotations

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.persistence.base_model import Base
from app.settings import settings

async_engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    pool_pre_ping=True,
)

AsyncSessionLocal = async_sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_async_session() -> AsyncIterator[AsyncSession]:
    async with AsyncSessionLocal() as session:
        yield session


async def init_models() -> None:
    # Import models so SQLAlchemy metadata includes all mapped tables.
    from app.modules.analytics import models as _analytics_models  # noqa: F401
    from app.modules.auth import models as _auth_models  # noqa: F401
    from app.modules.disease import models as _disease_models  # noqa: F401
    from app.modules.farms import models as _farm_models  # noqa: F401
    from app.modules.irrigation import models as _irrigation_models  # noqa: F401
    from app.modules.ledger import models as _ledger_models  # noqa: F401
    from app.modules.livestock import models as _livestock_models  # noqa: F401
    from app.modules.media import models as _media_models  # noqa: F401
    from app.modules.satellite import models as _satellite_models  # noqa: F401

    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
