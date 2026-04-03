from __future__ import annotations

import uuid
from datetime import datetime, timezone

from app.modules.disease.models import DiseaseScan
from app.modules.disease.repository import DiseaseRepository


class DiseaseService:
    def __init__(self, repo: DiseaseRepository) -> None:
        self._repo = repo

    async def save_scan(
        self,
        user_id: uuid.UUID,
        disease_name: str,
        confidence: float,
        severity: str,
        plant_name: str,
        is_healthy: bool,
        guidance: str | None = None,
        field_id: uuid.UUID | None = None,
    ) -> DiseaseScan:
        scan = DiseaseScan(
            user_id=user_id,
            field_id=field_id,
            disease_name=disease_name,
            confidence=confidence,
            severity=severity,
            plant_name=plant_name,
            is_healthy=is_healthy,
            guidance=guidance,
            scanned_at=datetime.now(tz=timezone.utc),
        )
        return await self._repo.save_scan(scan)

    async def get_history(self, user_id: uuid.UUID) -> list[DiseaseScan]:
        return await self._repo.list_by_user(user_id)

    async def get_scan_detail(self, scan_id: uuid.UUID) -> DiseaseScan | None:
        return await self._repo.get_scan(scan_id)
