from __future__ import annotations

from typing import Literal

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Agrio"
    debug: bool = False

    database_url: str = Field(
        default="postgresql+asyncpg://postgres:postgres@localhost:5432/agrio",
        validation_alias=AliasChoices("DATABASE_URL", "AGRIO_DATABASE_URL"),
    )

    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 1440
    jwt_refresh_expire_days: int = 30

    weather_provider: Literal["open_meteo", "mock"] = "mock"
    satellite_provider: Literal["sentinel", "demo"] = "demo"
    storage_provider: Literal["local", "s3"] = "local"
    disease_model_provider: Literal["remote", "mock"] = "mock"
    mqtt_provider: Literal["real", "mock"] = "mock"

    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"

    mqtt_broker_host: str = "test.mosquitto.org"
    mqtt_broker_port: int = 1883
    mqtt_sensor_topic: str = "farm/soil_moisture"
    mqtt_command_topic: str = "farm/irrigation_command"

    open_meteo_base_url: str = "https://api.open-meteo.com"
    media_root: str = "./media"

    # Comma-separated; cannot use * when allow_credentials=True. Include Expo web dev server.
    cors_origins: str = Field(
        default=(
            "http://localhost:8081,http://127.0.0.1:8081,"
            "http://localhost:19006,http://127.0.0.1:19006"
        ),
    )

    model_config = SettingsConfigDict(env_prefix="AGRIO_", env_file=("backend.env", ".env"))


settings = Settings()
