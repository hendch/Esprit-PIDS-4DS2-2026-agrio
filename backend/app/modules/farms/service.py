from __future__ import annotations

import uuid
from datetime import date
from typing import Any

from app.modules.farms.models import Farm, Field
from app.modules.farms.repository import FarmRepository
from app.modules.geospatial.geojson import compute_area_m2, polygon_centroid, validate_geojson


class FarmService:
    def __init__(self, repo: FarmRepository) -> None:
        self._repo = repo

    async def get_or_create_default_farm(self, owner_id: uuid.UUID) -> Farm:
        return await self._repo.get_or_create_default_farm(owner_id)

    async def list_fields(self, farm_id: uuid.UUID) -> list[Field]:
        return await self._repo.list_fields(farm_id)

    async def get_field(self, field_id: uuid.UUID) -> Field | None:
        return await self._repo.get_field(field_id)

    async def create_field(
        self,
        farm_id: uuid.UUID,
        name: str,
        crop_type: str | None = None,
        area_ha: float | None = None,
        boundary: dict[str, Any] | None = None,
        governorate: str | None = None,
        planting_date: date | None = None,
        irrigated: bool = False,
        irrigation_method: str | None = None,
        field_notes: str | None = None,
    ) -> Field:
        if not name.strip():
            raise ValueError("Field name is required")

        centroid_lat: float | None = None
        centroid_lon: float | None = None

        if boundary is not None:
            if not validate_geojson(boundary):
                raise ValueError("Boundary must be valid GeoJSON.")

            lon, lat = polygon_centroid(boundary)
            centroid_lon = lon
            centroid_lat = lat

            if area_ha is None:
                computed_area_m2 = compute_area_m2(boundary)
                if computed_area_m2 > 0:
                    area_ha = computed_area_m2 / 10_000.0

        return await self._repo.create_field(
            farm_id=farm_id,
            name=name.strip(),
            crop_type=crop_type.strip() if crop_type else None,
            area_ha=area_ha,
            boundary=boundary,
            centroid_lat=centroid_lat,
            centroid_lon=centroid_lon,
            governorate=governorate.strip() if governorate else None,
            planting_date=planting_date,
            irrigated=irrigated,
            irrigation_method=irrigation_method.strip() if irrigation_method else None,
            field_notes=field_notes.strip() if field_notes else None,
        )

    async def update_field(
        self,
        field_id: uuid.UUID,
        **kwargs: Any,
    ) -> Field:
        if "name" in kwargs and isinstance(kwargs["name"], str):
            kwargs["name"] = kwargs["name"].strip()

        if "crop_type" in kwargs and isinstance(kwargs["crop_type"], str):
            kwargs["crop_type"] = kwargs["crop_type"].strip() or None

        if "governorate" in kwargs and isinstance(kwargs["governorate"], str):
            kwargs["governorate"] = kwargs["governorate"].strip() or None

        if "irrigation_method" in kwargs and isinstance(kwargs["irrigation_method"], str):
            kwargs["irrigation_method"] = kwargs["irrigation_method"].strip() or None

        if "field_notes" in kwargs and isinstance(kwargs["field_notes"], str):
            kwargs["field_notes"] = kwargs["field_notes"].strip() or None

        if "boundary" in kwargs and kwargs["boundary"] is not None:
            boundary = kwargs["boundary"]

            if not validate_geojson(boundary):
                raise ValueError("Boundary must be valid GeoJSON.")

            lon, lat = polygon_centroid(boundary)
            kwargs["centroid_lon"] = lon
            kwargs["centroid_lat"] = lat

            if "area_ha" not in kwargs or kwargs["area_ha"] is None:
                computed_area_m2 = compute_area_m2(boundary)
                if computed_area_m2 > 0:
                    kwargs["area_ha"] = computed_area_m2 / 10_000.0

        return await self._repo.update_field(field_id, **kwargs)

    async def delete_field(self, field_id: uuid.UUID) -> None:
        await self._repo.delete_field(field_id)