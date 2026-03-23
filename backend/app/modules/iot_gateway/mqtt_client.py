from __future__ import annotations

from typing import Any


class MqttSensorProvider:
    async def get_latest_reading(self, device_id: str) -> dict[str, Any]:
        raise NotImplementedError  # TODO: integrate paho-mqtt async listener


class MqttCommandPublisher:
    async def publish_command(self, device_id: str, command: dict[str, Any]) -> bool:
        raise NotImplementedError  # TODO: publish via paho-mqtt
