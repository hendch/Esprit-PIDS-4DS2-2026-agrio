from __future__ import annotations

from datetime import date, timedelta
from typing import Any


class MockWeatherProvider:
    async def get_forecast(
        self, lat: float, lon: float, days: int
    ) -> list[dict[str, Any]]:
        today = date.today()
        samples = [
            {"t_max": 30.2, "t_min": 19.4, "precipitation_mm": 0.0, "wind_speed": 8.5},
            {"t_max": 28.7, "t_min": 18.1, "precipitation_mm": 2.3, "wind_speed": 12.0},
            {"t_max": 31.5, "t_min": 20.6, "precipitation_mm": 0.0, "wind_speed": 6.2},
            {"t_max": 26.0, "t_min": 17.8, "precipitation_mm": 8.1, "wind_speed": 15.3},
            {"t_max": 29.1, "t_min": 19.0, "precipitation_mm": 0.5, "wind_speed": 9.8},
        ]
        result: list[dict[str, Any]] = []
        for i in range(days):
            sample = samples[i % len(samples)]
            result.append(
                {"date": (today + timedelta(days=i)).isoformat(), **sample}
            )
        return result

    async def get_current(self, lat: float, lon: float) -> dict[str, Any]:
        return {
            "temperature": 27.3,
            "wind_speed": 10.4,
            "weather_code": 1,
            "time": date.today().isoformat(),
        }
