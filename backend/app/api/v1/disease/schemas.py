from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class ScanCreate(BaseModel):
    field_id: str | None = None
    notes: str | None = None


class ScanResult(BaseModel):
    id: str
    field_id: str | None
    disease_name: str | None
    confidence: float | None
    severity: str | None
    guidance: str | None
    scanned_at: datetime


class ScanHistoryResponse(BaseModel):
    scans: list[ScanResult]
