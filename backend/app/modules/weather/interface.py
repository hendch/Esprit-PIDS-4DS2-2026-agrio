from __future__ import annotations

from typing import Any, Protocol, runtime_checkable


@runtime_checkable
class WeatherProvider(Protocol):
    async def get_forecast(
        self, lat: float, lon: float, days: int
    ) -> list[dict[str, Any]]: ...

    async def get_current(self, lat: float, lon: float) -> dict[str, Any]: ...
