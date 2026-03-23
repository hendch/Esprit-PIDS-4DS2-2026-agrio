from __future__ import annotations

from typing import Any, Protocol, runtime_checkable


@runtime_checkable
class SensorProvider(Protocol):
    async def get_latest_reading(self, device_id: str) -> dict[str, Any]: ...


@runtime_checkable
class CommandPublisher(Protocol):
    async def publish_command(self, device_id: str, command: dict[str, Any]) -> bool: ...
