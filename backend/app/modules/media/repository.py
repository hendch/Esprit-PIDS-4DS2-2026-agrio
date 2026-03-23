from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.media.models import MediaObject


class MediaRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def save(self, media: MediaObject) -> MediaObject:
        self._session.add(media)
        await self._session.flush()
        return media

    async def get(self, media_id: uuid.UUID) -> MediaObject | None:
        stmt = select(MediaObject).where(MediaObject.id == media_id)
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()
