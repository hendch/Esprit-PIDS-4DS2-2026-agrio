from __future__ import annotations

import uuid
from typing import Any

from app.modules.farms.models import Field
from app.modules.farms.repository import FarmRepository


class FarmService:
    def __init__(self, repo: FarmRepository) -> None:
        self._repo = repo

    async def list_fields(self, farm_id: uuid.UUID) -> list[Field]:
        raise NotImplementedError  # TODO: delegate to repo

    async def get_field(self, field_id: uuid.UUID) -> Field | None:
        raise NotImplementedError  # TODO: delegate to repo

    async def create_field(
        self,
        farm_id: uuid.UUID,
        name: str,
        crop_type: str | None = None,
        area_ha: float | None = None,
        boundary: dict[str, Any] | None = None,
    ) -> Field:
        raise NotImplementedError  # TODO: validate + delegate

    async def update_field(
        self,
        field_id: uuid.UUID,
        **kwargs: Any,
    ) -> Field:
        raise NotImplementedError  # TODO: validate + delegate

    async def delete_field(self, field_id: uuid.UUID) -> None:
        raise NotImplementedError  # TODO: delegate to repo
