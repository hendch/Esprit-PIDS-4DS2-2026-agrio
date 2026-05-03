from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from app.modules.farms.repository import FarmRepository
from app.modules.satellite.providers.interface import SatelliteProvider
from app.modules.satellite.repository import SatelliteRepository


class SatelliteService:
    def __init__(
        self,
        provider: SatelliteProvider,
        repo: SatelliteRepository,
        farm_repo: FarmRepository,
    ) -> None:
        self._provider = provider
        self._repo = repo
        self._farm_repo = farm_repo

    @staticmethod
    def _parse_dt(value: str) -> datetime:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))

    async def _get_field(self, field_id: uuid.UUID):
        field = await self._farm_repo.get_field(field_id)
        if field is None:
            raise ValueError("Field not found")
        if not field.boundary:
            raise ValueError("Field boundary is missing")
        return field

    async def fetch_snapshot(self, field_id: uuid.UUID) -> dict:
        field = await self._get_field(field_id)

        end_dt = datetime.now(timezone.utc)
        start_dt = end_dt - timedelta(days=30)

        ndvi = await self._provider.fetch_imagery(
            boundary=field.boundary,
            date_range=(start_dt, end_dt),
        )

        return {
            "id": f"live-{field_id}",
            "field_id": str(field_id),
            "captured_at": self._parse_dt(ndvi["captured_at"]),
            "provider": ndvi["provider"],
            "indices": {
                "ndvi": ndvi["mean_ndvi"],
            },
        }

    async def compute_ndvi(self, field_id: uuid.UUID) -> dict:
        field = await self._get_field(field_id)

        end_dt = datetime.now(timezone.utc)
        start_dt = end_dt - timedelta(days=30)

        ndvi = await self._provider.fetch_imagery(
            boundary=field.boundary,
            date_range=(start_dt, end_dt),
        )

        return {
            "field_id": str(field_id),
            "mean_ndvi": ndvi["mean_ndvi"],
            "min_ndvi": ndvi["min_ndvi"],
            "max_ndvi": ndvi["max_ndvi"],
            "captured_at": self._parse_dt(ndvi["captured_at"]),
        }

    async def generate_zones(self, field_id: uuid.UUID) -> dict:
        raise NotImplementedError(
            "Real zoning needs either a grid-producing provider or histogram-based zoning. "
            "For tonight, make NDVI real first."
        )
