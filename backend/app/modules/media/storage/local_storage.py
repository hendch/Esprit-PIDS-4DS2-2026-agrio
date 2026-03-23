from __future__ import annotations

from pathlib import Path

from app.modules.media.storage.interface import ObjectStorage


class LocalObjectStorage(ObjectStorage):
    def __init__(self, root_dir: str | Path = "./media_uploads") -> None:
        self._root = Path(root_dir)
        self._root.mkdir(parents=True, exist_ok=True)

    def _resolve(self, key: str) -> Path:
        return self._root / key

    async def put(self, key: str, data: bytes, content_type: str) -> str:
        path = self._resolve(key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return key

    async def get(self, key: str) -> bytes:
        path = self._resolve(key)
        return path.read_bytes()

    async def delete(self, key: str) -> bool:
        path = self._resolve(key)
        if path.exists():
            path.unlink()
            return True
        return False
