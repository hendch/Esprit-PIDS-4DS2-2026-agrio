from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class SatelliteSnapshot(BaseModel):
    id: str
    field_id: str
    captured_at: datetime
    provider: str
    indices: dict


class ZoneMapResponse(BaseModel):
    field_id: str
    zones: list
    generated_at: datetime


class NDVIResponse(BaseModel):
    field_id: str
    mean_ndvi: float
    min_ndvi: float
    max_ndvi: float
    captured_at: datetime
