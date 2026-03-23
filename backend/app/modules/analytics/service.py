from __future__ import annotations

import uuid

from app.modules.analytics.repository import AnalyticsRepository


class AnalyticsService:
    def __init__(self, repo: AnalyticsRepository) -> None:
        self._repo = repo

    async def get_dashboard_summary(self, farm_id: uuid.UUID) -> dict:
        raise NotImplementedError

    async def get_water_footprint(self, field_id: uuid.UUID, period: str) -> dict:
        raise NotImplementedError

    async def get_kpis(self, farm_id: uuid.UUID) -> dict:
        raise NotImplementedError
