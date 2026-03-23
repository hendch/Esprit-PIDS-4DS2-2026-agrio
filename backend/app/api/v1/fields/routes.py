from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter

from .schemas import FieldCreate, FieldResponse, FieldUpdate

router = APIRouter()

_STUB_FIELD = FieldResponse(
    id="field-001",
    farm_id="farm-001",
    name="North Paddock",
    crop_type="wheat",
    area_ha=12.5,
    boundary={"type": "Polygon", "coordinates": []},
    created_at=datetime.now(tz=timezone.utc),
)


@router.get("/", response_model=list[FieldResponse])
async def list_fields() -> list[FieldResponse]:
    # TODO: inject service
    return [_STUB_FIELD]


@router.post("/", response_model=FieldResponse, status_code=201)
async def create_field(body: FieldCreate) -> FieldResponse:
    # TODO: inject service
    return _STUB_FIELD


@router.get("/{field_id}", response_model=FieldResponse)
async def get_field(field_id: str) -> FieldResponse:
    # TODO: inject service
    return _STUB_FIELD


@router.patch("/{field_id}", response_model=FieldResponse)
async def update_field(field_id: str, body: FieldUpdate) -> FieldResponse:
    # TODO: inject service
    return _STUB_FIELD


@router.delete("/{field_id}", status_code=204)
async def delete_field(field_id: str) -> None:
    # TODO: inject service
    return None
