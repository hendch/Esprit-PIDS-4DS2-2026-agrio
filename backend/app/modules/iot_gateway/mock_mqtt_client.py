from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

logger = logging.getLogger(__name__)


class MockSensorProvider:
    async def get_latest_reading(self, device_id: str) -> dict[str, Any]:
        return {
            "soil_moisture_pct": 45.0,
            "temperature_c": 24.5,
            "humidity_pct": 62.0,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }


class MockCommandPublisher:
    async def publish_command(self, device_id: str, command: dict[str, Any]) -> bool:
        logger.info("MockCommandPublisher: device=%s command=%s", device_id, command)
        return True
