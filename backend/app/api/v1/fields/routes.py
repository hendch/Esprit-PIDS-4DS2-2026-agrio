from __future__ import annotations

import json
import uuid
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.di import get_db
from app.middleware.auth import CurrentUser
from app.modules.farms.models import Field
from app.modules.farms.repository import FarmRepository
from app.modules.farms.service import FarmService
from app.modules.irrigation.models import FieldMoistureSensor, FieldTask
from app.modules.irrigation.repository import IrrigationRepository
from app.modules.ml_crop.predictor import yield_predictor
from app.modules.weather.open_meteo_client import OpenMeteoWeatherProvider
from app.modules.ml_crop.optimizer_predictor import optimizer_predictor
from app.modules.satellite.providers.sentinel_provider import SentinelProvider
from app.modules.ml_crop.normalization import normalize_crop, normalize_governorate
from datetime import datetime, timedelta, timezone



from .schemas import (
    FieldCreate,
    FieldPredictionRequest,
    FieldPredictionResponse,
    FieldResponse,
    FieldUpdate,
    FieldWeatherContextResponse,
    FieldOptimizeRequest,
    FieldOptimizeResponse,
    FieldMoistureSensorCreate,
    FieldMoistureSensorResponse,
    FieldTaskResponse,
    FieldTaskUpdate,

)

router = APIRouter()


def get_farm_service(db: AsyncSession = Depends(get_db)) -> FarmService:
    return FarmService(FarmRepository(db))


def _to_response(field: Field) -> FieldResponse:
    return FieldResponse(
        id=str(field.id),
        farm_id=str(field.farm_id),
        name=field.name,
        crop_type=normalize_crop(field.crop_type) if field.crop_type else None,
        area_ha=field.area_ha,
        boundary=field.boundary or {"type": "Polygon", "coordinates": []},
        created_at=field.created_at,
        centroid_lat=field.centroid_lat,
        centroid_lon=field.centroid_lon,
        governorate = normalize_governorate(field.governorate),
        planting_date=field.planting_date,
        irrigated=field.irrigated,
        irrigation_method=field.irrigation_method,
        field_notes=field.field_notes,
    )


def _sensor_to_response(sensor: FieldMoistureSensor) -> FieldMoistureSensorResponse:
    return FieldMoistureSensorResponse(
        id=str(sensor.id),
        field_id=str(sensor.field_id),
        name=sensor.name,
        latitude=sensor.latitude,
        longitude=sensor.longitude,
        depth_cm=sensor.depth_cm,
        simulated_moisture_pct=sensor.simulated_moisture_pct,
        notes=sensor.notes,
        created_at=sensor.created_at,
        updated_at=sensor.updated_at,
    )


def _task_to_response(task: FieldTask) -> FieldTaskResponse:
    return FieldTaskResponse(
        id=str(task.id),
        field_id=str(task.field_id),
        task_type=task.task_type,
        title=task.title,
        note=task.note,
        completed=task.completed,
        source=task.source,
        created_at=task.created_at,
        updated_at=task.updated_at,
    )


def _default_field_tasks(field: Field, autonomous: bool) -> list[dict[str, str]]:
    irrigation_title = (
        "Irrigate field (autonomous irrigation will run automatically)"
        if field.irrigated and autonomous
        else "Irrigate field"
    )
    irrigation_note = (
        "Autonomous irrigation is enabled, so this is tracked as an automatic action."
        if field.irrigated and autonomous
        else "Tick this after manually irrigating the field."
    )

    return [
        {
            "task_type": "fertilizer",
            "title": "Apply fertilizer",
            "note": "Use the field fertilizer recommendation before ticking this task.",
        },
        {
            "task_type": "irrigation",
            "title": irrigation_title,
            "note": irrigation_note,
        },
        {
            "task_type": "harvest",
            "title": "Harvest crop",
            "note": "Tick this when harvest for this field is complete.",
        },
    ]


async def _current_farm_id(current_user: dict, service: FarmService) -> uuid.UUID:
    user_id = uuid.UUID(current_user["user_id"])
    farm = await service.get_or_create_default_farm(user_id)
    return farm.id


async def _get_owned_field(
    field_id: str,
    current_user: dict,
    service: FarmService,
) -> Field:
    try:
        parsed_field_id = uuid.UUID(field_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Field not found") from exc

    farm_id = await _current_farm_id(current_user, service)
    field = await service.get_field(parsed_field_id)
    if field is None or field.farm_id != farm_id:
        raise HTTPException(status_code=404, detail="Field not found")
    return field


def _default_features_path() -> Path:
    return Path(__file__).resolve().parents[3] / "modules" / "ml_crop" / "default_features.json"


def _load_default_features() -> dict[str, Any]:
    path = _default_features_path()
    if not path.exists():
        raise RuntimeError(
            "default_features.json not found. Create it from your known-good sample payload first."
        )
    return json.loads(path.read_text(encoding="utf-8"))


def _build_prediction_payload(
    field: Field,
    body: FieldPredictionRequest,
) -> tuple[dict[str, Any], dict[str, Any]]:
    payload = _load_default_features()

    governorate = normalize_governorate(body.governorate or field.governorate)
    if not governorate:
        raise ValueError("Governorate is required for prediction.")

    crop_value = normalize_crop(field.crop_type) if field.crop_type else None
    if crop_value:
        payload["crop"] = crop_value

    payload["governorate"] = governorate
    payload["Year"] = body.year

    crop_value = payload.get("crop") or normalize_crop(field.crop_type) or "unknown"
    payload["region_crop"] = f"{governorate}_{crop_value}"

    if field.area_ha is not None:
        payload["irrigated_ha"] = field.area_ha if body.irrigated else 0.0

        crop_lower = str(crop_value).lower()

        cereals = {"wheat", "barley", "oats", "triticale", "sorghum", "cereals"}
        olives = {"olives"}
        fruit_like = {
            "apples",
            "apricots",
            "dates",
            "figs",
            "grapes",
            "lemons_and_limes",
            "oranges",
            "peaches_and_nectarines",
            "pears",
            "plums_and_sloes",
            "tangerines_mandarins_clementines",
            "watermelons",
            "almonds",
            "avocados",
        }

        if crop_lower in cereals:
            payload["cereal_area_ha"] = field.area_ha
        elif crop_lower in olives:
            payload["olive_area_ha"] = field.area_ha
            payload["fruit_tree_area_ha"] = field.area_ha
        elif crop_lower in fruit_like:
            payload["fruit_tree_area_ha"] = field.area_ha

    if body.overrides:
        overrides = dict(body.overrides)
        if "crop" in overrides:
            overrides["crop"] = normalize_crop(overrides.get("crop"))
        if "governorate" in overrides:
            overrides["governorate"] = normalize_governorate(overrides.get("governorate"))
        payload.update(overrides)

        # rebuild region_crop in case overrides changed crop/governorate
        payload["region_crop"] = f"{payload.get('governorate')}_{payload.get('crop')}"

    missing = [name for name in yield_predictor.feature_names if name not in payload]
    if missing:
        raise ValueError(f"Missing required model features after assembly: {missing}")

    trimmed_payload = {name: payload[name] for name in yield_predictor.feature_names}

    context: dict[str, Any] = {
        "governorate": governorate,
        "year": body.year,
        "irrigated": body.irrigated,
        "crop": trimmed_payload.get("crop"),
        "area_ha": field.area_ha,
        "planting_date": field.planting_date.isoformat() if field.planting_date else None,
        "irrigation_method": field.irrigation_method,
        "field_notes": field.field_notes,
        "centroid_lat": field.centroid_lat,
        "centroid_lon": field.centroid_lon,
    }

    return trimmed_payload, context


def _build_optimizer_base_payload(
    field: Field,
    body: FieldOptimizeRequest,
) -> tuple[dict[str, Any], dict[str, Any]]:
    payload = _load_default_features()

    governorate = normalize_governorate(body.governorate or field.governorate)
    if not governorate:
        raise ValueError("Governorate is required for optimization.")

    crop_value = normalize_crop(field.crop_type) if field.crop_type else None
    if crop_value:
        payload["crop"] = crop_value

    payload["governorate"] = governorate
    payload["Year"] = body.year

    crop_value = payload.get("crop") or normalize_crop(field.crop_type) or "unknown"
    payload["region_crop"] = f"{governorate}_{crop_value}"

    irrigated_flag = body.irrigated if body.irrigated is not None else bool(field.irrigated)

    if field.area_ha is not None:
        payload["irrigated_ha"] = field.area_ha if irrigated_flag else 0.0

        crop_lower = str(crop_value).lower()

        cereals = {"wheat", "barley", "oats", "triticale", "sorghum", "cereals"}
        olives = {"olives"}
        fruit_like = {
            "apples",
            "apricots",
            "dates",
            "figs",
            "grapes",
            "lemons_and_limes",
            "oranges",
            "peaches_and_nectarines",
            "pears",
            "plums_and_sloes",
            "tangerines_mandarins_clementines",
            "watermelons",
            "almonds",
            "avocados",
        }

        if crop_lower in cereals:
            payload["cereal_area_ha"] = field.area_ha
        elif crop_lower in olives:
            payload["olive_area_ha"] = field.area_ha
            payload["fruit_tree_area_ha"] = field.area_ha
        elif crop_lower in fruit_like:
            payload["fruit_tree_area_ha"] = field.area_ha

    if body.overrides:
        overrides = dict(body.overrides)
        if "crop" in overrides:
            overrides["crop"] = normalize_crop(overrides.get("crop"))
        if "governorate" in overrides:
            overrides["governorate"] = normalize_governorate(overrides.get("governorate"))
        payload.update(overrides)

        # rebuild region_crop in case overrides changed crop/governorate
        payload["region_crop"] = f"{payload.get('governorate')}_{payload.get('crop')}"

    context: dict[str, Any] = {
        "governorate": governorate,
        "year": body.year,
        "irrigated": irrigated_flag,
        "crop": payload.get("crop"),
        "area_ha": field.area_ha,
        "planting_date": field.planting_date.isoformat() if field.planting_date else None,
        "irrigation_method": field.irrigation_method,
        "field_notes": field.field_notes,
        "centroid_lat": field.centroid_lat,
        "centroid_lon": field.centroid_lon,
    }

    return payload, context



async def _enrich_payload_with_live_context(
    field: Field,
    payload: dict[str, Any],
) -> dict[str, Any]:
    # NDVI
    try:
        satellite_provider = SentinelProvider()
        end_dt = datetime.now(timezone.utc)
        start_dt = end_dt - timedelta(days=30)

        ndvi_stats = await satellite_provider.fetch_imagery(
            boundary=field.boundary,
            date_range=(start_dt, end_dt),
        )

        if ndvi_stats.get("mean_ndvi") is not None:
            payload["ndvi_mean"] = float(ndvi_stats["mean_ndvi"])
    except Exception as exc:
        print(f"[optimize] NDVI enrichment skipped: {exc}")

    # Weather
    try:
        if field.centroid_lat is not None and field.centroid_lon is not None:
            weather_provider = OpenMeteoWeatherProvider()
            forecast = await weather_provider.get_forecast(
                field.centroid_lat,
                field.centroid_lon,
                days=5,
            )

            if forecast:
                temp_midpoints = []
                t_max_values = []
                t_min_values = []
                rain_values = []

                for day in forecast:
                    t_max = day.get("t_max")
                    t_min = day.get("t_min")
                    rain = day.get("precipitation_mm")

                    if t_max is not None:
                        t_max_values.append(float(t_max))
                    if t_min is not None:
                        t_min_values.append(float(t_min))
                    if rain is not None:
                        rain_values.append(float(rain))
                    if t_max is not None and t_min is not None:
                        temp_midpoints.append((float(t_max) + float(t_min)) / 2.0)

                if temp_midpoints:
                    payload["temp_mean"] = sum(temp_midpoints) / len(temp_midpoints)
                if t_max_values:
                    payload["temp_max"] = max(t_max_values)
                if t_min_values:
                    payload["temp_min"] = min(t_min_values)
                if rain_values:
                    payload["rain_sum"] = sum(rain_values)

                # derive temp_stress exactly like in modeling
                if payload.get("temp_max") is not None and payload.get("temp_min") is not None:
                    payload["temp_stress"] = max(
                        (float(payload["temp_max"]) - 30.0)
                        + (25.0 - float(payload["temp_min"])),
                        0.0,
                    )
    except Exception as exc:
        print(f"[optimize] Weather enrichment skipped: {exc}")

    return payload

@router.get("/", response_model=list[FieldResponse])
async def list_fields(
    current_user: dict = CurrentUser,
    service: FarmService = Depends(get_farm_service),
) -> list[FieldResponse]:
    farm_id = await _current_farm_id(current_user, service)
    fields = await service.list_fields(farm_id)
    return [_to_response(field) for field in fields]


@router.post("/", response_model=FieldResponse, status_code=201)
async def create_field(
    body: FieldCreate,
    current_user: dict = CurrentUser,
    service: FarmService = Depends(get_farm_service),
) -> FieldResponse:
    farm_id = await _current_farm_id(current_user, service)
    try:
        field = await service.create_field(
            farm_id=farm_id,
            name=body.name,
            crop_type=normalize_crop(body.crop_type) if body.crop_type else None,
            area_ha=body.area_ha,
            boundary=body.boundary,
            governorate=normalize_governorate(body.governorate) if body.governorate else None,
            planting_date=body.planting_date,
            irrigated=body.irrigated,
            irrigation_method=body.irrigation_method,
            field_notes=body.field_notes,
        )

    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _to_response(field)


@router.get("/{field_id}", response_model=FieldResponse)
async def get_field(
    field_id: str,
    current_user: dict = CurrentUser,
    service: FarmService = Depends(get_farm_service),
) -> FieldResponse:
    field = await _get_owned_field(field_id, current_user, service)
    return _to_response(field)

@router.get("/{field_id}/weather-context", response_model=FieldWeatherContextResponse)
async def get_field_weather_context(
    field_id: str,
    current_user: dict = CurrentUser,
    service: FarmService = Depends(get_farm_service),
) -> FieldWeatherContextResponse:
    field = await _get_owned_field(field_id, current_user, service)

    if field.centroid_lat is None or field.centroid_lon is None:
        raise HTTPException(
            status_code=400,
            detail="Field centroid is not available. Re-save or update the field boundary first.",
        )

    provider = OpenMeteoWeatherProvider()

    try:
        current = await provider.get_current(field.centroid_lat, field.centroid_lon)
        forecast = await provider.get_forecast(field.centroid_lat, field.centroid_lon, days=5)
    except Exception as exc:
        raise HTTPException(
            status_code=503,
            detail=f"Weather service is temporarily unavailable: {exc}",
        ) from exc

    return FieldWeatherContextResponse(
        field_id=str(field.id),
        farm_id=str(field.farm_id),
        field_name=field.name,
        governorate=normalize_governorate(field.governorate),
        centroid_lat=field.centroid_lat,
        centroid_lon=field.centroid_lon,
        current=current,
        forecast=forecast,
    )


@router.patch("/{field_id}", response_model=FieldResponse)
async def update_field(
    field_id: str,
    body: FieldUpdate,
    current_user: dict = CurrentUser,
    service: FarmService = Depends(get_farm_service),
) -> FieldResponse:
    field = await _get_owned_field(field_id, current_user, service)
    changes = body.model_dump(exclude_unset=True)

    if "crop_type" in changes:
        changes["crop_type"] = normalize_crop(changes.get("crop_type"))

    if "governorate" in changes:
        changes["governorate"] = normalize_governorate(changes.get("governorate"))

    updated = await service.update_field(
        field.id,
        **changes,
    )
    return _to_response(updated)


@router.delete("/{field_id}", status_code=204)
async def delete_field(
    field_id: str,
    current_user: dict = CurrentUser,
    service: FarmService = Depends(get_farm_service),
    db: AsyncSession = Depends(get_db),
) -> None:
    field = await _get_owned_field(field_id, current_user, service)
    await db.execute(delete(FieldMoistureSensor).where(FieldMoistureSensor.field_id == field.id))
    await db.execute(delete(FieldTask).where(FieldTask.field_id == field.id))
    await db.commit()
    await service.delete_field(field.id)


@router.get("/{field_id}/moisture-sensors", response_model=list[FieldMoistureSensorResponse])
async def list_field_moisture_sensors(
    field_id: str,
    current_user: dict = CurrentUser,
    service: FarmService = Depends(get_farm_service),
    db: AsyncSession = Depends(get_db),
) -> list[FieldMoistureSensorResponse]:
    field = await _get_owned_field(field_id, current_user, service)
    result = await db.execute(
        select(FieldMoistureSensor)
        .where(FieldMoistureSensor.field_id == field.id)
        .order_by(FieldMoistureSensor.created_at.desc())
    )
    return [_sensor_to_response(sensor) for sensor in result.scalars().all()]


@router.post("/{field_id}/moisture-sensors", response_model=FieldMoistureSensorResponse, status_code=201)
async def create_field_moisture_sensor(
    field_id: str,
    body: FieldMoistureSensorCreate,
    current_user: dict = CurrentUser,
    service: FarmService = Depends(get_farm_service),
    db: AsyncSession = Depends(get_db),
) -> FieldMoistureSensorResponse:
    field = await _get_owned_field(field_id, current_user, service)
    sensor = FieldMoistureSensor(
        field_id=field.id,
        name=body.name.strip(),
        latitude=body.latitude,
        longitude=body.longitude,
        depth_cm=body.depth_cm,
        simulated_moisture_pct=body.simulated_moisture_pct,
        notes=body.notes.strip() if body.notes else None,
    )
    db.add(sensor)
    await db.commit()
    await db.refresh(sensor)
    return _sensor_to_response(sensor)


@router.delete("/{field_id}/moisture-sensors/{sensor_id}", status_code=204)
async def delete_field_moisture_sensor(
    field_id: str,
    sensor_id: str,
    current_user: dict = CurrentUser,
    service: FarmService = Depends(get_farm_service),
    db: AsyncSession = Depends(get_db),
) -> None:
    field = await _get_owned_field(field_id, current_user, service)
    try:
        parsed_sensor_id = uuid.UUID(sensor_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Sensor not found") from exc

    result = await db.execute(
        delete(FieldMoistureSensor)
        .where(FieldMoistureSensor.id == parsed_sensor_id)
        .where(FieldMoistureSensor.field_id == field.id)
        .returning(FieldMoistureSensor.id)
    )
    deleted_id = result.scalar_one_or_none()
    await db.commit()
    if deleted_id is None:
        raise HTTPException(status_code=404, detail="Sensor not found")


@router.get("/{field_id}/tasks", response_model=list[FieldTaskResponse])
async def list_field_tasks(
    field_id: str,
    current_user: dict = CurrentUser,
    service: FarmService = Depends(get_farm_service),
    db: AsyncSession = Depends(get_db),
) -> list[FieldTaskResponse]:
    field = await _get_owned_field(field_id, current_user, service)
    autonomous = await IrrigationRepository(db).get_autonomous_state()

    existing_result = await db.execute(select(FieldTask).where(FieldTask.field_id == field.id))
    existing = list(existing_result.scalars().all())
    existing_types = {task.task_type for task in existing}

    for task_data in _default_field_tasks(field, autonomous):
        if task_data["task_type"] not in existing_types:
            task = FieldTask(
                field_id=field.id,
                task_type=task_data["task_type"],
                title=task_data["title"],
                note=task_data["note"],
                completed=False,
                source="system",
            )
            db.add(task)
            existing.append(task)

    await db.commit()

    result = await db.execute(
        select(FieldTask)
        .where(FieldTask.field_id == field.id)
        .order_by(FieldTask.created_at.asc())
    )
    tasks = list(result.scalars().all())

    if field.irrigated and autonomous:
        for task in tasks:
            if task.task_type == "irrigation" and not task.completed:
                task.title = "Irrigate field (autonomous irrigation will run automatically)"
                task.note = "Autonomous irrigation is enabled, so this is tracked as an automatic action."

    return [_task_to_response(task) for task in tasks]


@router.patch("/{field_id}/tasks/{task_id}", response_model=FieldTaskResponse)
async def update_field_task(
    field_id: str,
    task_id: str,
    body: FieldTaskUpdate,
    current_user: dict = CurrentUser,
    service: FarmService = Depends(get_farm_service),
    db: AsyncSession = Depends(get_db),
) -> FieldTaskResponse:
    field = await _get_owned_field(field_id, current_user, service)
    try:
        parsed_task_id = uuid.UUID(task_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Task not found") from exc

    result = await db.execute(
        select(FieldTask)
        .where(FieldTask.id == parsed_task_id)
        .where(FieldTask.field_id == field.id)
    )
    task = result.scalar_one_or_none()
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")

    task.completed = body.completed
    await db.commit()
    await db.refresh(task)
    return _task_to_response(task)


@router.post("/{field_id}/predict-yield", response_model=FieldPredictionResponse)
async def predict_field_yield(
    field_id: str,
    body: FieldPredictionRequest,
    current_user: dict = CurrentUser,
    service: FarmService = Depends(get_farm_service),
) -> FieldPredictionResponse:
    field = await _get_owned_field(field_id, current_user, service)

    try:
        payload, context = _build_prediction_payload(field, body)
        prediction = yield_predictor.predict(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {exc}") from exc

    return FieldPredictionResponse(
        field_id=str(field.id),
        farm_id=str(field.farm_id),
        field_name=field.name,
        crop_type=normalize_crop(field.crop_type) if field.crop_type else None,
        predicted_yield_hg_per_ha=prediction,
        context=context,
    )

@router.post("/{field_id}/optimize", response_model=FieldOptimizeResponse)
async def optimize_field(
    field_id: str,
    body: FieldOptimizeRequest,
    current_user: dict = CurrentUser,
    service: FarmService = Depends(get_farm_service),
) -> FieldOptimizeResponse:
    field = await _get_owned_field(field_id, current_user, service)

    try:
        payload, context = _build_optimizer_base_payload(field, body)
        payload = await _enrich_payload_with_live_context(field, payload)

        optimizer_result = optimizer_predictor.predict(payload)

        context["ndvi_mean"] = payload.get("ndvi_mean")
        context["temp_mean"] = payload.get("temp_mean")
        context["temp_max"] = payload.get("temp_max")
        context["temp_min"] = payload.get("temp_min")
        context["rain_sum"] = payload.get("rain_sum")
        context["temp_stress"] = payload.get("temp_stress")

    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Optimization failed: {exc}") from exc

    return FieldOptimizeResponse(
        field_id=str(field.id),
        farm_id=str(field.farm_id),
        field_name=field.name,
        crop_type=normalize_crop(field.crop_type) if field.crop_type else None,
        yield_hg_per_ha=optimizer_result["yield_hg_per_ha"],
        yield_class=optimizer_result["yield_class"],
        stress_class=optimizer_result["stress_class"],
        vigor_class=optimizer_result["vigor_class"],
        optimization_priority=optimizer_result["optimization_priority"],
        context=context,
    )
