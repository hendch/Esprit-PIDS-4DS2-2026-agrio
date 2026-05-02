from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class FieldCreate(BaseModel):
    name: str
    boundary: dict
    crop_type: str | None = None
    planting_date: str | None = None
    field_type: str | None = None
    crop_categories: list[str] | None = None
    varieties: list[str] | None = None
    area_ha: float | None = None


class FieldUpdate(BaseModel):
    name: str | None = None
    crop_type: str | None = None
    planting_date: str | None = None
    field_type: str | None = None
    crop_categories: list[str] | None = None
    varieties: list[str] | None = None
    area_ha: float | None = None
    boundary: dict | None = None


class FieldResponse(BaseModel):
    id: str
    farm_id: str
    name: str
    crop_type: str | None
    planting_date: str | None
    field_type: str | None
    crop_categories: list[str]
    varieties: list[str]
    area_ha: float | None
    boundary: dict
    created_at: datetime
