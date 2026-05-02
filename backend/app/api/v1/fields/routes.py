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
    return FieldResponse(
        id=str(field.id),
        farm_id=str(field.farm_id),
        name=field.name,
        crop_type=field.crop_type,
        area_ha=field.area_ha,
        boundary=field.boundary or {"type": "Polygon", "coordinates": []},
        created_at=field.created_at,
    )


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
    try:
        field = await service.create_field(
            farm_id=farm_id,
            name=body.name,
            crop_type=body.crop_type,
            area_ha=body.area_ha,
            boundary=body.boundary,
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
    updated = await service.update_field(
        field.id,
        **body.model_dump(exclude_unset=True),
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
