from __future__ import annotations

from typing import Any

from app.modules.iot_gateway.device_registry import DeviceRegistry
from app.modules.iot_gateway.interface import CommandPublisher, SensorProvider


class IoTGatewayService:
    def __init__(
        self,
        sensor_provider: SensorProvider,
        command_publisher: CommandPublisher,
        device_registry: DeviceRegistry,
    ) -> None:
        self._sensors = sensor_provider
        self._commands = command_publisher
        self._registry = device_registry

    async def read_sensor(self, device_id: str) -> dict[str, Any]:
        return await self._sensors.get_latest_reading(device_id)

    async def send_command(self, device_id: str, command: dict[str, Any]) -> bool:
        return await self._commands.publish_command(device_id, command)

    def list_devices(self, farm_id: str) -> list[dict[str, Any]]:
        return self._registry.list_by_farm(farm_id)
