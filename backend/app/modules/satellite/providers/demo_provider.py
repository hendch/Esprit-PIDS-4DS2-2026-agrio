from __future__ import annotations

import random

from app.modules.satellite.providers.interface import SatelliteProvider


class DemoProvider(SatelliteProvider):
    async def fetch_imagery(self, boundary: dict, date_range: tuple) -> dict:
        rows, cols = 10, 10
        ndvi_grid = [
            [round(random.uniform(0.2, 0.9), 4) for _ in range(cols)]
            for _ in range(rows)
        ]
        return {
            "type": "ndvi",
            "grid": ndvi_grid,
            "rows": rows,
            "cols": cols,
            "boundary": boundary,
            "date_range": date_range,
        }
