from __future__ import annotations

import uuid


def get_recommendation_tool(field_id: uuid.UUID) -> dict:
    # TODO: fetch irrigation recommendation for field
    return {}


def get_weather_tool(lat: float, lon: float) -> dict:
    # TODO: fetch weather forecast from external API
    return {}


def get_logs_tool(field_id: uuid.UUID) -> dict:
    # TODO: retrieve recent irrigation/sensor logs
    return {}
