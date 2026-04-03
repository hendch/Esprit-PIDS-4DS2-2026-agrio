from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.middleware.auth import get_current_user
from app.modules.disease.repository import DiseaseRepository
from app.modules.disease.service import DiseaseService
from app.persistence.db import get_async_session

from .schemas import ScanCreate, ScanHistoryResponse, ScanResult

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
