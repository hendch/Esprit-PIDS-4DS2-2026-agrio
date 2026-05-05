from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


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


# ── LLM-powered advice + chat ─────────────────────────────────


class AdviceRequest(BaseModel):
    disease_name: str
    plant_name: str
    confidence: float
    severity: str
    is_healthy: bool
    locale: Literal["en", "ar"] = "en"


class AdviceResponse(BaseModel):
    advice: str
    source: Literal["llm", "fallback"]


class ChatTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    history: list[ChatTurn] = Field(default_factory=list, max_length=20)
    locale: Literal["en", "ar"] = "en"
    original_advice: str | None = None


class ChatResponse(BaseModel):
    reply: str
