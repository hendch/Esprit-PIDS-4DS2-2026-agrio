from __future__ import annotations

from datetime import date

from pydantic import BaseModel


class DashboardSummary(BaseModel):
    water_saved_liters: float
    temperature_c: float
    crop_health_pct: float
    livestock_count: int
    date: date


class WaterFootprint(BaseModel):
    field_id: str
    period: str
    total_liters: float
    efficiency_pct: float


class KPIRecord(BaseModel):
    metric: str
    value: float
    unit: str
    date: date
