from __future__ import annotations

import asyncio
import logging
import uuid

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.middleware.auth import get_current_user
from app.modules.disease.advisor import (
    ChatTurn as AdvisorTurn,
    DiagnosisContext,
    chat_reply,
    generate_advice,
)
from app.modules.disease.repository import DiseaseRepository
from app.modules.disease.segmentation_service import run_segmentation
from app.modules.disease.service import DiseaseService
from app.persistence.db import get_async_session

from .schemas import (
    AdviceRequest,
    AdviceResponse,
    ChatRequest,
    ChatResponse,
    ScanCreate,
    ScanHistoryResponse,
    ScanResult,
    SegmentationResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()


def _scan_to_result(scan) -> ScanResult:
    return ScanResult(
        id=str(scan.id),
        user_id=str(scan.user_id),
        field_id=str(scan.field_id) if scan.field_id else None,
        disease_name=scan.disease_name,
        confidence=scan.confidence,
        severity=scan.severity,
        plant_name=scan.plant_name,
        is_healthy=scan.is_healthy,
        guidance=scan.guidance,
        scanned_at=scan.scanned_at,
    )


@router.post("/scan", response_model=ScanResult, status_code=201)
async def create_scan(
    body: ScanCreate,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
) -> ScanResult:
    repo = DiseaseRepository(session)
    service = DiseaseService(repo)

    field_id = uuid.UUID(body.field_id) if body.field_id else None

    scan = await service.save_scan(
        user_id=uuid.UUID(user["user_id"]),
        disease_name=body.disease_name,
        confidence=body.confidence,
        severity=body.severity,
        plant_name=body.plant_name,
        is_healthy=body.is_healthy,
        guidance=body.guidance,
        field_id=field_id,
    )
    await session.commit()
    return _scan_to_result(scan)


@router.get("/history", response_model=ScanHistoryResponse)
async def scan_history(
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
) -> ScanHistoryResponse:
    repo = DiseaseRepository(session)
    service = DiseaseService(repo)

    scans = await service.get_history(uuid.UUID(user["user_id"]))
    return ScanHistoryResponse(scans=[_scan_to_result(s) for s in scans])


@router.get("/scan/{scan_id}", response_model=ScanResult)
async def get_scan(
    scan_id: str,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
) -> ScanResult:
    repo = DiseaseRepository(session)
    service = DiseaseService(repo)

    scan = await service.get_scan_detail(uuid.UUID(scan_id))
    if scan is None or str(scan.user_id) != user["user_id"]:
        raise HTTPException(status_code=404, detail="Scan not found")
    return _scan_to_result(scan)


# ── Segmentation (online, YOLOv8) ────────────────────────────

MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10 MB


@router.post("/segment", response_model=SegmentationResponse)
async def segment_image(
    image: UploadFile = File(...),
    user: dict = Depends(get_current_user),
) -> SegmentationResponse:
    """Upload a leaf image and receive segmentation masks from the YOLOv8 model."""
    if image.content_type and not image.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    image_bytes = await image.read()
    if len(image_bytes) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=400, detail="Image exceeds 10 MB limit")

    try:
        # Run inference in a thread to avoid blocking the async event loop
        result = await asyncio.to_thread(run_segmentation, image_bytes)
    except (RuntimeError, FileNotFoundError) as exc:
        logger.error("Segmentation failed: %s", exc)
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    return SegmentationResponse(**result)


# ── LLM advice + chat ────────────────────────────────────────


@router.post("/advice", response_model=AdviceResponse)
async def get_advice(
    body: AdviceRequest,
    user: dict = Depends(get_current_user),
) -> AdviceResponse:
    """Generate dynamic advice for a diagnosis. Falls back signal returned to client."""
    ctx = DiagnosisContext(
        disease_name=body.disease_name,
        plant_name=body.plant_name,
        confidence=body.confidence,
        severity=body.severity,
        is_healthy=body.is_healthy,
        locale=body.locale,
    )
    advice = await generate_advice(ctx)
    if advice is None:
        # Client already has the static dict — tell it to use the local fallback.
        return AdviceResponse(advice="", source="fallback")
    return AdviceResponse(advice=advice, source="llm")


@router.post("/scan/{scan_id}/chat", response_model=ChatResponse)
async def chat_about_scan(
    scan_id: str,
    body: ChatRequest,
    user: dict = Depends(get_current_user),
    session: AsyncSession = Depends(get_async_session),
) -> ChatResponse:
    """Follow-up Q&A about a specific scan. The scan is loaded from DB to anchor context."""
    repo = DiseaseRepository(session)
    service = DiseaseService(repo)
    scan = await service.get_scan_detail(uuid.UUID(scan_id))
    if scan is None or str(scan.user_id) != user["user_id"]:
        raise HTTPException(status_code=404, detail="Scan not found")

    ctx = DiagnosisContext(
        disease_name=scan.disease_name or "Unknown",
        plant_name=scan.plant_name or "plant",
        confidence=float(scan.confidence or 0),
        severity=scan.severity or "Low",
        is_healthy=bool(scan.is_healthy),
        locale=body.locale,
    )
    history = [AdvisorTurn(role=t.role, content=t.content) for t in body.history]
    reply = await chat_reply(
        ctx=ctx,
        history=history,
        user_message=body.message,
        original_advice=body.original_advice or scan.guidance,
    )
    if reply is None:
        raise HTTPException(
            status_code=503,
            detail="AI advisor unavailable. Try again in a moment.",
        )
    return ChatResponse(reply=reply)
