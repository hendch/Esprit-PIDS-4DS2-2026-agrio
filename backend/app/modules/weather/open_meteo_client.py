from __future__ import annotations

from typing import Any

import httpx
import requests

from app.settings import settings


class OpenMeteoWeatherProvider:
    def __init__(self) -> None:
        self._base_url = settings.open_meteo_base_url

    def _daily_params(self, lat: float, lon: float, days: int) -> dict:
        return {
            "latitude": lat,
            "longitude": lon,
            "daily": (
                "temperature_2m_max,temperature_2m_min,precipitation_sum,"
                "windspeed_10m_max,relative_humidity_2m_mean,"
                "et0_fao_evapotranspiration"
            ),
            "timezone": "auto",
            "forecast_days": days,
        }

    def get_today_sync(self, lat: float, lon: float) -> dict[str, Any]:
        """Synchronous single-day fetch used by LangChain tools."""
        url = f"{self._base_url}/v1/forecast"
        resp = requests.get(url, params=self._daily_params(lat, lon, 7), timeout=30)
        resp.raise_for_status()
        daily = resp.json().get("daily", {})
        return {
            "temp_max": daily["temperature_2m_max"][0],
            "temp_min": daily["temperature_2m_min"][0],
            "humidity": daily["relative_humidity_2m_mean"][0],
            "wind_speed": daily["windspeed_10m_max"][0],
            "precipitation": daily["precipitation_sum"][0],
            "et0": daily["et0_fao_evapotranspiration"][0],
        }

    async def get_forecast(
        self, lat: float, lon: float, days: int = 7
    ) -> list[dict[str, Any]]:
        url = f"{self._base_url}/v1/forecast"
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                url, params=self._daily_params(lat, lon, days), timeout=30.0
            )
            resp.raise_for_status()
            daily = resp.json().get("daily", {})

        dates = daily.get("time", [])
        return [
            {
                "date": dates[i],
                "t_max": daily["temperature_2m_max"][i],
                "t_min": daily["temperature_2m_min"][i],
                "precipitation_mm": daily["precipitation_sum"][i],
                "wind_speed": daily["windspeed_10m_max"][i],
                "humidity": daily["relative_humidity_2m_mean"][i],
                "et0": daily["et0_fao_evapotranspiration"][i],
            }
            for i in range(len(dates))
        ]

    async def get_current(self, lat: float, lon: float) -> dict[str, Any]:
        url = f"{self._base_url}/v1/forecast"
        params = {
            "latitude": lat,
            "longitude": lon,
            "current_weather": True,
        }
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, params=params, timeout=30.0)
            resp.raise_for_status()
            cw = resp.json().get("current_weather", {})

        return {
            "temperature": cw.get("temperature"),
            "wind_speed": cw.get("windspeed"),
            "weather_code": cw.get("weathercode"),
            "time": cw.get("time"),
        }
