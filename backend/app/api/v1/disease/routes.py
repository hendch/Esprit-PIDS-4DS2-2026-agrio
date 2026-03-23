from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, File, Form, UploadFile

from .schemas import ScanHistoryResponse, ScanResult

router = APIRouter()

_STUB_SCAN = ScanResult(
    id="scan-001",
    field_id="field-001",
    disease_name="Leaf Blight",
    confidence=0.87,
    severity="moderate",
    guidance="Apply fungicide within 48 hours.",
    scanned_at=datetime.now(tz=timezone.utc),
)


@router.post("/scan", response_model=ScanResult, status_code=201)
async def create_scan(
    image: UploadFile = File(...),
    field_id: str | None = Form(None),
    notes: str | None = Form(None),
) -> ScanResult:
    # TODO: inject service
    return _STUB_SCAN


@router.get("/history", response_model=ScanHistoryResponse)
async def scan_history() -> ScanHistoryResponse:
    # TODO: inject service
    return ScanHistoryResponse(scans=[_STUB_SCAN])


@router.get("/scan/{scan_id}", response_model=ScanResult)
async def get_scan(scan_id: str) -> ScanResult:
    # TODO: inject service
    return _STUB_SCAN
