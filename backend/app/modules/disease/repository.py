from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.disease.models import DiseaseScan


class DiseaseRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def save_scan(self, scan: DiseaseScan) -> DiseaseScan:
        self._session.add(scan)
        await self._session.flush()
        return scan

    async def get_scan(self, scan_id: uuid.UUID) -> DiseaseScan | None:
        stmt = select(DiseaseScan).where(DiseaseScan.id == scan_id)
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def list_scans(
        self, farm_id: uuid.UUID, limit: int = 50
    ) -> list[DiseaseScan]:
        stmt = (
            select(DiseaseScan)
            .where(DiseaseScan.field_id == farm_id)
            .order_by(DiseaseScan.scanned_at.desc())
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())
