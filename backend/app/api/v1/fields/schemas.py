from __future__ import annotations

from datetime import date, datetime
from typing import Any

from pydantic import BaseModel, Field as PydanticField, field_validator

from app.modules.geospatial.geojson import validate_geojson


class FieldCreate(BaseModel):
    name: str
    boundary: dict
    crop_type: str | None = None
    area_ha: float | None = None

    # New enriched field profile inputs
    governorate: str | None = None
    planting_date: date | None = None
    irrigated: bool = False
    irrigation_method: str | None = None
    field_notes: str | None = None

    @field_validator("boundary")
    @classmethod
    def validate_boundary_geojson(cls, value: dict) -> dict:
        if not validate_geojson(value):
            raise ValueError("Boundary must be valid GeoJSON.")
        return value


class FieldUpdate(BaseModel):
    name: str | None = None
    crop_type: str | None = None
    area_ha: float | None = None
    boundary: dict | None = None

    # New enriched field profile inputs
    governorate: str | None = None
    planting_date: date | None = None
    irrigated: bool | None = None
    irrigation_method: str | None = None
    field_notes: str | None = None

    @field_validator("boundary")
    @classmethod
    def validate_boundary_geojson(cls, value: dict | None) -> dict | None:
        if value is not None and not validate_geojson(value):
            raise ValueError("Boundary must be valid GeoJSON.")
        return value


class FieldResponse(BaseModel):
    id: str
    farm_id: str
    name: str
    crop_type: str | None
    area_ha: float | None
    boundary: dict
    created_at: datetime

    # New enriched field profile outputs
    centroid_lat: float | None = None
    centroid_lon: float | None = None
    governorate: str | None = None
    planting_date: date | None = None
    irrigated: bool = False
    irrigation_method: str | None = None
    field_notes: str | None = None


class FieldPredictionRequest(BaseModel):
    governorate: str = PydanticField(..., min_length=1, max_length=255)
    year: int = PydanticField(..., ge=2000, le=2100)
    irrigated: bool = False
    overrides: dict[str, Any] | None = None


class FieldPredictionResponse(BaseModel):
    field_id: str
    farm_id: str
    field_name: str
    crop_type: str | None
    predicted_yield_hg_per_ha: float
    context: dict[str, Any]

class FieldWeatherContextResponse(BaseModel):
    field_id: str
    farm_id: str
    field_name: str
    governorate: str | None = None
    centroid_lat: float
    centroid_lon: float
    current: dict[str, Any]
    forecast: list[dict[str, Any]]

class FieldOptimizeRequest(BaseModel):
    governorate: str | None = None
    year: int = PydanticField(..., ge=2000, le=2100)
    irrigated: bool | None = None
    overrides: dict[str, Any] | None = None


class FieldOptimizeResponse(BaseModel):
    field_id: str
    farm_id: str
    field_name: str
    crop_type: str | None

    yield_hg_per_ha: float
    yield_class: str
    stress_class: str
    vigor_class: str
    optimization_priority: str

    context: dict[str, Any]