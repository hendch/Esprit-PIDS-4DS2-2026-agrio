from __future__ import annotations

from typing import Protocol


class SatelliteProvider(Protocol):
    async def fetch_imagery(self, boundary: dict, date_range: tuple) -> dict: ...
