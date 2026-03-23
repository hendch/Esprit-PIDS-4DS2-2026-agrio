from __future__ import annotations

from app.modules.satellite.providers.interface import SatelliteProvider


class SentinelProvider(SatelliteProvider):
    async def fetch_imagery(self, boundary: dict, date_range: tuple) -> dict:
        raise NotImplementedError
