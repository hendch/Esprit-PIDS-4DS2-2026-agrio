from __future__ import annotations

import uuid

from app.modules.media.models import MediaObject
from app.modules.media.repository import MediaRepository
from app.modules.media.storage.interface import ObjectStorage


class MediaService:
    def __init__(self, storage: ObjectStorage, repo: MediaRepository) -> None:
        self._storage = storage
        self._repo = repo

    async def upload(
        self,
        farm_id: uuid.UUID,
        filename: str,
        content_type: str,
        data: bytes,
    ) -> MediaObject:
        raise NotImplementedError

    async def get_url(self, media_id: uuid.UUID) -> str:
        raise NotImplementedError
