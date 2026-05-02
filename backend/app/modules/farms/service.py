from __future__ import annotations

import uuid
from typing import Any

from app.modules.farms.models import Farm, Field
from app.modules.farms.repository import FarmRepository


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
    ) -> Field:
        if not name.strip():
            raise ValueError("Field name is required")
        return await self._repo.create_field(
            farm_id=farm_id,
            name=name.strip(),
            crop_type=crop_type.strip() if crop_type else None,
            area_ha=area_ha,
            boundary=boundary,
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
        return await self._repo.update_field(field_id, **kwargs)

    async def delete_field(self, field_id: uuid.UUID) -> None:
        await self._repo.delete_field(field_id)
