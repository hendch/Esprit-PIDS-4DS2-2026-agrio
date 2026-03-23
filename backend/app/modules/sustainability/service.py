from __future__ import annotations

import uuid


class SustainabilityService:
    async def get_metrics(self, farm_id: uuid.UUID) -> dict:
        raise NotImplementedError

    async def generate_report(self, farm_id: uuid.UUID, period: str) -> dict:
        raise NotImplementedError
