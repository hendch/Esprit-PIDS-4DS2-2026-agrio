from __future__ import annotations

from typing import Any

import httpx

from app.settings import settings


class OpenMeteoWeatherProvider:
    def __init__(self) -> None:
        self._base_url = settings.open_meteo_base_url

    async def get_forecast(
        self, lat: float, lon: float, days: int
    ) -> list[dict[str, Any]]:
        url = (
            f"{self._base_url}/v1/forecast"
            f"?latitude={lat}&longitude={lon}"
            f"&daily=temperature_2m_max,temperature_2m_min,"
            f"precipitation_sum,windspeed_10m_max"
            f"&forecast_days={days}"
        )
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, timeout=10.0)
            resp.raise_for_status()
            data = resp.json()

        daily = data.get("daily", {})
        dates = daily.get("time", [])
        t_maxes = daily.get("temperature_2m_max", [])
        t_mins = daily.get("temperature_2m_min", [])
        precip = daily.get("precipitation_sum", [])
        winds = daily.get("windspeed_10m_max", [])

        return [
            {
                "date": dates[i],
                "t_max": t_maxes[i],
                "t_min": t_mins[i],
                "precipitation_mm": precip[i],
                "wind_speed": winds[i],
            }
            for i in range(len(dates))
        ]

    async def get_current(self, lat: float, lon: float) -> dict[str, Any]:
        url = (
            f"{self._base_url}/v1/forecast"
            f"?latitude={lat}&longitude={lon}&current_weather=true"
        )
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, timeout=10.0)
            resp.raise_for_status()
            data = resp.json()

        cw = data.get("current_weather", {})
        return {
            "temperature": cw.get("temperature"),
            "wind_speed": cw.get("windspeed"),
            "weather_code": cw.get("weathercode"),
            "time": cw.get("time"),
        }
