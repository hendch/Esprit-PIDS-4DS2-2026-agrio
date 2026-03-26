from __future__ import annotations

from datetime import datetime, timedelta

from langchain.tools import tool

from app.modules.irrigation.engine.kc_tables import KC_TABLE
from app.modules.irrigation.repository import IrrigationRepository
from app.modules.iot_gateway.mqtt_client import MqttCommandPublisher, MqttSensorProvider
from app.modules.weather.open_meteo_client import OpenMeteoWeatherProvider
from app.settings import settings

_weather = OpenMeteoWeatherProvider()
_sensor = MqttSensorProvider()
_pump = MqttCommandPublisher()
_repo = IrrigationRepository()


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
    _repo.log_event(moisture, amount, duration, next_irrigation, crop, weather)
    return {"logged": True, "next_irrigation": next_irrigation}
