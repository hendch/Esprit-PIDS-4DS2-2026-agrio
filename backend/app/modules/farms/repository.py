from __future__ import annotations

import uuid
from datetime import date
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.farms.models import Farm, Field


class FarmRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_or_create_default_farm(self, owner_id: uuid.UUID) -> Farm:
        stmt = select(Farm).where(Farm.owner_id == owner_id).order_by(Farm.created_at.asc())
        farm = (await self._session.execute(stmt)).scalars().first()
        if farm is not None:
            return farm

        farm = Farm(owner_id=owner_id, name="My Farm")
        self._session.add(farm)
        await self._session.commit()
        await self._session.refresh(farm)
        return farm

    async def list_fields(self, farm_id: uuid.UUID) -> list[Field]:
        result = await self._session.scalars(
            select(Field)
            .where(Field.farm_id == farm_id)
            .order_by(Field.created_at.desc())
        )
        return list(result.all())

    async def get_field(self, field_id: uuid.UUID) -> Field | None:
        return await self._session.get(Field, field_id)

    async def create_field(
        self,
        farm_id: uuid.UUID,
        name: str,
        crop_type: str | None = None,
        area_ha: float | None = None,
        boundary: dict[str, Any] | None = None,
        centroid_lat: float | None = None,
        centroid_lon: float | None = None,
        governorate: str | None = None,
        planting_date: date | None = None,
        irrigated: bool = False,
        irrigation_method: str | None = None,
        field_notes: str | None = None,
    ) -> Field:
        farm = await self._session.get(Farm, farm_id)
        if farm is None:
            raise ValueError("Farm not found")

        field = Field(
            farm_id=farm_id,
            name=name,
            crop_type=crop_type,
            area_ha=area_ha,
            boundary=boundary,
            centroid_lat=centroid_lat,
            centroid_lon=centroid_lon,
            governorate=governorate,
            planting_date=planting_date,
            irrigated=irrigated,
            irrigation_method=irrigation_method,
            field_notes=field_notes,
        )
        self._session.add(field)
        await self._session.commit()
        await self._session.refresh(field)
        return field

    async def update_field(
        self,
        field_id: uuid.UUID,
        **kwargs: Any,
    ) -> Field:
        field = await self.get_field(field_id)
        if field is None:
            raise ValueError("Field not found")

        allowed = {
            "name",
            "crop_type",
            "area_ha",
            "boundary",
            "centroid_lat",
            "centroid_lon",
            "governorate",
            "planting_date",
            "irrigated",
            "irrigation_method",
            "field_notes",
        }

        for key, value in kwargs.items():
            if key in allowed:
                setattr(field, key, value)

        await self._session.commit()
        await self._session.refresh(field)
        return field

    async def delete_field(self, field_id: uuid.UUID) -> None:
        field = await self.get_field(field_id)
        if field is None:
            raise ValueError("Field not found")

        await self._session.delete(field)
        await self._session.commit()
