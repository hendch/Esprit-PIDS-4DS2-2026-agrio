from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.farms.models import Field


class FarmRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_fields(self, farm_id: uuid.UUID) -> list[Field]:
        raise NotImplementedError  # TODO: select fields by farm_id

    async def get_field(self, field_id: uuid.UUID) -> Field | None:
        raise NotImplementedError  # TODO: select field by pk

    async def create_field(
        self,
        farm_id: uuid.UUID,
        name: str,
        crop_type: str | None = None,
        area_ha: float | None = None,
        boundary: dict[str, Any] | None = None,
    ) -> Field:
        raise NotImplementedError  # TODO: insert new field

    async def update_field(
        self,
        field_id: uuid.UUID,
        **kwargs: Any,
    ) -> Field:
        raise NotImplementedError  # TODO: update field columns

    async def delete_field(self, field_id: uuid.UUID) -> None:
        raise NotImplementedError  # TODO: delete field row
