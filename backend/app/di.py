from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.persistence.db import get_async_session
from app.settings import Settings, settings


async def get_db() -> AsyncIterator[AsyncSession]:
    async for session in get_async_session():
        yield session


def get_settings() -> Settings:
    return settings


def get_weather_provider() -> Any:
    if settings.weather_provider == "open_meteo":
        from app.modules.weather.open_meteo_client import OpenMeteoWeatherProvider

        return OpenMeteoWeatherProvider()

    from app.modules.weather.mock_weather_client import MockWeatherProvider

    return MockWeatherProvider()


def get_satellite_provider() -> Any:
    if settings.satellite_provider == "sentinel":
        from app.modules.satellite.providers.sentinel_provider import SentinelProvider

        return SentinelProvider()

    from app.modules.satellite.providers.demo_provider import DemoProvider

    return DemoProvider()


def get_storage_provider() -> Any:
    if settings.storage_provider == "s3":
        from app.modules.media.storage.s3_storage import S3ObjectStorage

        return S3ObjectStorage()

    from app.modules.media.storage.local_storage import LocalObjectStorage

    return LocalObjectStorage(root=settings.media_root)


def get_disease_model_runner() -> Any:
    if settings.disease_model_provider == "remote":
        from app.modules.disease.model_registry.remote_runner import RemoteModelRunner

        return RemoteModelRunner()

    from app.modules.disease.model_registry.mock_runner import MockModelRunner

    return MockModelRunner()
