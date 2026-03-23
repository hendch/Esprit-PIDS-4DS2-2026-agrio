from __future__ import annotations

import uuid

from app.modules.satellite.providers.interface import SatelliteProvider
from app.modules.satellite.repository import SatelliteRepository


class SatelliteService:
    def __init__(self, provider: SatelliteProvider, repo: SatelliteRepository) -> None:
        self._provider = provider
        self._repo = repo

    async def fetch_snapshot(self, field_id: uuid.UUID) -> dict:
        raise NotImplementedError

    async def compute_ndvi(self, field_id: uuid.UUID) -> dict:
        raise NotImplementedError

    async def generate_zones(self, field_id: uuid.UUID) -> dict:
        raise NotImplementedError
