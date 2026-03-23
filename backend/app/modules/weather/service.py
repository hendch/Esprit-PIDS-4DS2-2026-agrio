from __future__ import annotations

from typing import Any

from app.modules.weather.cache import WeatherCache
from app.modules.weather.interface import WeatherProvider


class WeatherService:
    def __init__(self, provider: WeatherProvider, cache: WeatherCache) -> None:
        self._provider = provider
        self._cache = cache

    async def get_forecast(
        self, lat: float, lon: float, days: int = 5
    ) -> list[dict[str, Any]]:
        cache_key = f"forecast:{lat}:{lon}:{days}"
        cached = self._cache.get(cache_key)
        if cached is not None:
            return cached
        result = await self._provider.get_forecast(lat, lon, days)
        self._cache.set(cache_key, result, ttl_seconds=600)
        return result
