from __future__ import annotations

import uuid
from datetime import date
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.irrigation.models import IrrigationEvent, IrrigationPlan


class IrrigationRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def get_latest_event(self, field_id: uuid.UUID) -> IrrigationEvent | None:
        raise NotImplementedError  # TODO: order by event_date desc, limit 1

    async def list_events(
        self,
        field_id: uuid.UUID,
        date_range: tuple[date, date] | None = None,
    ) -> list[IrrigationEvent]:
        raise NotImplementedError  # TODO: filter by field + date range

    async def save_event(self, **kwargs: Any) -> IrrigationEvent:
        raise NotImplementedError  # TODO: insert irrigation event

    async def get_active_plan(self, field_id: uuid.UUID) -> IrrigationPlan | None:
        raise NotImplementedError  # TODO: plan where now between start/end
