from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.satellite.models import SatelliteSnapshot, ZoneMap


class SatelliteRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def save_snapshot(self, snapshot: SatelliteSnapshot) -> SatelliteSnapshot:
        self._session.add(snapshot)
        await self._session.flush()
        return snapshot

    async def get_latest_snapshot(self, field_id: uuid.UUID) -> SatelliteSnapshot | None:
        stmt = (
            select(SatelliteSnapshot)
            .where(SatelliteSnapshot.field_id == field_id)
            .order_by(SatelliteSnapshot.captured_at.desc())
            .limit(1)
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def save_zone_map(self, zone_map: ZoneMap) -> ZoneMap:
        self._session.add(zone_map)
        await self._session.flush()
        return zone_map

    async def get_zone_map(self, field_id: uuid.UUID) -> ZoneMap | None:
        stmt = (
            select(ZoneMap)
            .where(ZoneMap.field_id == field_id)
            .order_by(ZoneMap.generated_at.desc())
            .limit(1)
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()
