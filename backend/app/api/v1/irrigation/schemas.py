from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel


class IrrigationRecommendation(BaseModel):
    field_id: str
    date: date
    eto_mm: float
    kc: float
    etc_mm: float
    decision: str
    explanation: dict | None = None


class IrrigationLog(BaseModel):
    id: str
    field_id: str
    timestamp: datetime
    volume_liters: float
    source: str
    method: str


class IrrigationOverride(BaseModel):
    field_id: str
    action: str
    volume_liters: float | None = None
