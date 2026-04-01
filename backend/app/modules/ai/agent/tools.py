from __future__ import annotations

import asyncio
import concurrent.futures
from collections.abc import Callable, Coroutine
from datetime import datetime, timedelta
from typing import Any

from langchain.tools import tool
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.modules.irrigation.engine.kc_tables import KC_TABLE
from app.modules.irrigation.repository import IrrigationRepository
from app.modules.iot_gateway.mqtt_client import MqttCommandPublisher, MqttSensorProvider
from app.modules.weather.open_meteo_client import OpenMeteoWeatherProvider
from app.settings import settings


def _run_async_in_worker_thread(coro_factory: Callable[[], Coroutine[Any, Any, None]]) -> None:
    """LangChain tools are sync. Worker thread runs its own asyncio loop with its own DB engine (not the app's global async_engine)."""

    def _runner() -> None:
        asyncio.run(coro_factory())

    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
        pool.submit(_runner).result()

_weather = OpenMeteoWeatherProvider()
_sensor = MqttSensorProvider()
_pump = MqttCommandPublisher()


@tool
def fetch_weather_data(lat: float, lon: float) -> dict:
    """Fetches current weather data and ET0 from Open-Meteo API for the given coordinates."""
    return _weather.get_today_sync(lat, lon)


@tool
def calculate_crop_water_need(et0: float, crop: str, growth_stage: str) -> dict:
    """Calculates crop water requirement using FAO-56 Kc coefficient."""
    kc_stages = KC_TABLE.get(crop.lower(), {})
    kc = kc_stages.get(growth_stage, 1.0)
    etc = et0 * kc
    return {
        "et0": et0,
        "kc": kc,
        "etc_mm_per_day": etc,
        "recommended_irrigation_mm": etc * 3,
    }


@tool
def read_soil_moisture() -> dict:
    """Reads the latest soil moisture percentage from the MQTT sensor."""
    return _sensor.get_latest_reading_sync()


@tool
def control_irrigation_pump(action: str, duration_seconds: int) -> dict:
    """Controls the irrigation pump via MQTT (action: ON or OFF)."""
    message = {"action": action, "duration": duration_seconds}
    _pump.publish_command_sync(settings.mqtt_command_topic, message)
    return {"status": "success", "action": action, "duration": duration_seconds}


@tool
def log_irrigation_event(
    moisture: float, amount: float, duration: int, crop: str, weather: str
) -> dict:
    """Logs an irrigation event to the database with next-irrigation estimate."""
    next_irrigation = (datetime.now() + timedelta(days=3)).isoformat()

    async def _do_log() -> None:
        engine = create_async_engine(
            settings.database_url,
            echo=False,
            pool_pre_ping=True,
        )
        try:
            session_factory = async_sessionmaker(
                bind=engine,
                class_=AsyncSession,
                expire_on_commit=False,
            )
            async with session_factory() as session:
                await IrrigationRepository(session).log_event(
                    moisture, amount, duration, next_irrigation, crop, weather
                )
        finally:
            await engine.dispose()

    _run_async_in_worker_thread(lambda: _do_log())
    return {"logged": True, "next_irrigation": next_irrigation}
