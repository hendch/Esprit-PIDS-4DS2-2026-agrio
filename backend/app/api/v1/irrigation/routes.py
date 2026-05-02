from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from app.middleware.auth import get_current_user

from app.modules.irrigation.repository import IrrigationRepository
from app.modules.iot_gateway.mqtt_client import MqttSensorProvider
from app.modules.weather.open_meteo_client import OpenMeteoWeatherProvider
from app.persistence.db import get_async_session

router = APIRouter()

_weather = OpenMeteoWeatherProvider()
_sensor = MqttSensorProvider()
_agent = None


class ScheduleRequest(BaseModel):
    field_id: str
    target_date: str
    start_time: str
    duration_minutes: int
    water_volume: float


class AutonomousStateRequest(BaseModel):
    autonomous: bool


def _get_agent():
    global _agent
    if _agent is None:
        from app.modules.ai.agent.orchestrator import IrrigationAgent

        _agent = IrrigationAgent()
    return _agent


def _get_repo(session: AsyncSession) -> IrrigationRepository:
    return IrrigationRepository(session)


@router.post("/check")
async def check_irrigation(data: dict):
    """Ask the irrigation agent whether to irrigate."""
    crop = data.get("crop", "wheat")
    growth_stage = data.get("growth_stage", "mid")
    lat = data.get("lat", 36.8)
    lon = data.get("lon", 10.18)
    query = f"Should I irrigate {crop} at {lat},{lon}?"
    result = _get_agent().run(
        query=query,
        crop=crop,
        growth_stage=growth_stage,
        lat=float(lat),
        lon=float(lon),
    )
    return {"decision": result}


@router.get("/history")
async def get_history(session: AsyncSession = Depends(get_async_session)):
    """Return recent irrigation events."""
    rows = await _get_repo(session).get_history()
    return {"history": rows}


@router.get("/recommendation/{field_id}")
async def get_recommendation(field_id: str):
    """Get irrigation recommendation for a field (placeholder)."""
    # TODO: look up field coords from farms module
    result = _get_agent().run(
        query=f"Should I irrigate the field {field_id}?",
        crop="wheat",
        growth_stage="mid",
        lat=36.8,
        lon=10.18,
    )
    return {"field_id": field_id, "recommendation": result}


@router.get("/dashboard")
async def get_dashboard_data(session: AsyncSession = Depends(get_async_session)):
    """Unified endpoint to grab remote data without crashing if one fails."""
    import logging

    log = logging.getLogger(__name__)

    weather_data = None
    try:
        weather_data = await _weather.get_forecast(lat=36.8, lon=10.18, days=5)
    except Exception as e:
        log.warning("Weather provider failed: %s", e)

    moisture_data = None
    try:
        # Wait briefly for a real MQTT reading so dashboard shows live:true when Wokwi/sim is publishing.
        moisture_data = _sensor.get_latest_reading_sync()
    except Exception as e:
        log.warning("MQTT Sensor failed: %s", e)

    usage_today = 0.0
    try:
        usage_today = await _get_repo(session).get_today_water_usage()
    except Exception as e:
        log.warning("DB usage fetch failed: %s", e)

    usage_history = None
    try:
        usage_history = await _get_repo(session).get_water_usage_history(limit=7)
    except Exception as e:
        log.warning("DB history fetch failed: %s", e)

    return {
        "weather": weather_data,
        "moisture": moisture_data,
        "usage_today": usage_today,
        "usage_history": usage_history,
    }


@router.post("/schedule")
async def create_schedule(
    data: ScheduleRequest,
    session: AsyncSession = Depends(get_async_session),
    current_user: dict = Depends(get_current_user),
):
    """Save an irrigation schedule."""
    try:
        schedule_id = await _get_repo(session).add_schedule(
            field_id=data.field_id,
            target_date=data.target_date,
            start_time=data.start_time,
            duration_minutes=data.duration_minutes,
            water_volume=data.water_volume,
            user_id=current_user["user_id"],
        )
        return {"status": "success", "schedule_id": schedule_id}
    except Exception as e:
        import traceback
        print("=== SCHEDULE CREATION ERROR ===")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/autonomous")
async def get_autonomous(session: AsyncSession = Depends(get_async_session)):
    """Get the current autonomous background job status."""
    return {"autonomous": await _get_repo(session).get_autonomous_state()}


@router.post("/autonomous")
async def set_autonomous(
    data: AutonomousStateRequest,
    session: AsyncSession = Depends(get_async_session),
):
    """Enable or disable the autonomous background job."""
    await _get_repo(session).set_autonomous_state(data.autonomous)
    return {"status": "success", "autonomous": data.autonomous}


@router.get("/schedules")
async def get_schedules(session: AsyncSession = Depends(get_async_session)):
    """Get the recent irrigation schedules."""
    return {"schedules": await _get_repo(session).get_schedules()}
