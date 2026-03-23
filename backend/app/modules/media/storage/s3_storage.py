from __future__ import annotations

from app.modules.media.storage.interface import ObjectStorage


class S3ObjectStorage(ObjectStorage):
    async def put(self, key: str, data: bytes, content_type: str) -> str:
        raise NotImplementedError

    async def get(self, key: str) -> bytes:
        raise NotImplementedError

    async def delete(self, key: str) -> bool:
        raise NotImplementedError
