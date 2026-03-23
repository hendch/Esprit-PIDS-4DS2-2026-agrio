from __future__ import annotations

from typing import Any


class DeviceRegistry:
    def __init__(self) -> None:
        self._devices: dict[str, dict[str, Any]] = {}

    def register(self, device_id: str, farm_id: str, metadata: dict[str, Any] | None = None) -> None:
        self._devices[device_id] = {
            "device_id": device_id,
            "farm_id": farm_id,
            "metadata": metadata or {},
        }

    def get(self, device_id: str) -> dict[str, Any] | None:
        return self._devices.get(device_id)

    def list_by_farm(self, farm_id: str) -> list[dict[str, Any]]:
        return [d for d in self._devices.values() if d["farm_id"] == farm_id]
