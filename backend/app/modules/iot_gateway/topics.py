from __future__ import annotations

SENSOR_DATA = "agrio/{farm_id}/{device_id}/data"
COMMANDS = "agrio/{farm_id}/{device_id}/cmd"


def build_topic(pattern: str, **kwargs: str) -> str:
    return pattern.format(**kwargs)
