from __future__ import annotations

from typing import Literal

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "Agrio"
    debug: bool = False

    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/agrio"

    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 1440

    weather_provider: Literal["open_meteo", "mock"] = "mock"
    satellite_provider: Literal["sentinel", "demo"] = "demo"
    storage_provider: Literal["local", "s3"] = "local"
    disease_model_provider: Literal["remote", "mock"] = "mock"
    mqtt_provider: Literal["real", "mock"] = "mock"

    open_meteo_base_url: str = "https://api.open-meteo.com"
    media_root: str = "./media"

    model_config = {"env_prefix": "AGRIO_", "env_file": ".env"}


settings = Settings()
