from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.di import get_db
from app.middleware.auth import CurrentUser
from app.modules.farms.models import Field
from app.modules.farms.repository import FarmRepository
from app.modules.farms.service import FarmService

from .schemas import FieldCreate, FieldResponse, FieldUpdate

router = APIRouter()


def get_farm_service(db: AsyncSession = Depends(get_db)) -> FarmService:
    return FarmService(FarmRepository(db))


def _to_response(field: Field) -> FieldResponse:
    boundary = field.boundary or {"type": "Polygon", "coordinates": []}
    properties = boundary.get("properties") if isinstance(boundary, dict) else {}
    if not isinstance(properties, dict):
        properties = {}

    return FieldResponse(
        id=str(field.id),
        farm_id=str(field.farm_id),
        name=field.name,
        crop_type=field.crop_type,
        planting_date=properties.get("planting_date"),
        field_type=properties.get("field_type"),
        crop_categories=properties.get("crop_categories") or [],
        varieties=properties.get("varieties") or [],
        area_ha=field.area_ha,
        boundary=boundary,
        created_at=field.created_at,
    )


def _boundary_with_properties(
    boundary: dict,
    *,
    planting_date: str | None = None,
    field_type: str | None = None,
    crop_categories: list[str] | None = None,
    varieties: list[str] | None = None,
) -> dict:
    next_boundary = dict(boundary)
    existing_properties = next_boundary.get("properties")
    properties = dict(existing_properties) if isinstance(existing_properties, dict) else {}

    if planting_date is not None:
        properties["planting_date"] = planting_date
    if field_type is not None:
        properties["field_type"] = field_type
    if crop_categories is not None:
        properties["crop_categories"] = crop_categories
    if varieties is not None:
        properties["varieties"] = varieties

    next_boundary["properties"] = properties
    return next_boundary


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
    boundary = _boundary_with_properties(
        body.boundary,
        planting_date=body.planting_date,
        field_type=body.field_type,
        crop_categories=body.crop_categories,
        varieties=body.varieties,
    )
    try:
        field = await service.create_field(
            farm_id=farm_id,
            name=body.name,
            crop_type=body.crop_type,
            area_ha=body.area_ha,
            boundary=boundary,
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


@router.patch("/{field_id}", response_model=FieldResponse)
async def update_field(
    field_id: str,
    body: FieldUpdate,
    current_user: dict = CurrentUser,
    service: FarmService = Depends(get_farm_service),
) -> FieldResponse:
    field = await _get_owned_field(field_id, current_user, service)
    update_data = body.model_dump(exclude_unset=True)
    property_keys = {"planting_date", "field_type", "crop_categories", "varieties"}
    if property_keys.intersection(update_data):
        boundary = update_data.get("boundary") or field.boundary or {"type": "Polygon", "coordinates": []}
        update_data["boundary"] = _boundary_with_properties(
            boundary,
            planting_date=update_data.pop("planting_date", None),
            field_type=update_data.pop("field_type", None),
            crop_categories=update_data.pop("crop_categories", None),
            varieties=update_data.pop("varieties", None),
        )
    updated = await service.update_field(
        field.id,
        **update_data,
    )
    return _to_response(updated)


@router.delete("/{field_id}", status_code=204)
async def delete_field(
    field_id: str,
    current_user: dict = CurrentUser,
    service: FarmService = Depends(get_farm_service),
) -> None:
    field = await _get_owned_field(field_id, current_user, service)
    await service.delete_field(field.id)
