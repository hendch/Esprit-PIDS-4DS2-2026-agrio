from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class ScanCreate(BaseModel):
    disease_name: str
    confidence: float
    severity: str
    plant_name: str
    is_healthy: bool
    guidance: str | None = None
    field_id: str | None = None


class ScanResult(BaseModel):
    id: str
    user_id: str
    field_id: str | None
    disease_name: str | None
    confidence: float | None
    severity: str | None
    plant_name: str | None
    is_healthy: bool
    guidance: str | None
    scanned_at: datetime


class ScanHistoryResponse(BaseModel):
    scans: list[ScanResult]


# ── Segmentation ──────────────────────────────────────────────


class SegmentationRegion(BaseModel):
    class_name: str
    confidence: float
    bbox: list[float]


class SegmentationResponse(BaseModel):
    annotated_image: str  # base64 JPEG
    regions: list[SegmentationRegion]
    total_regions: int
