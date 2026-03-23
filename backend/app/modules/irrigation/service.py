from __future__ import annotations

import uuid
from typing import Any

from app.modules.irrigation.repository import IrrigationRepository


class IrrigationService:
    def __init__(self, repo: IrrigationRepository) -> None:
        self._repo = repo

    async def get_recommendation(self, field_id: uuid.UUID) -> dict[str, Any]:
        raise NotImplementedError  # TODO: orchestrate engine + weather + sensors

    async def record_override(
        self,
        field_id: uuid.UUID,
        action: str,
        volume: float,
    ) -> dict[str, Any]:
        raise NotImplementedError  # TODO: store manual override event

    async def get_usage(
        self,
        field_id: uuid.UUID,
        period: tuple[str, str],
    ) -> dict[str, Any]:
        raise NotImplementedError  # TODO: aggregate usage stats for period
