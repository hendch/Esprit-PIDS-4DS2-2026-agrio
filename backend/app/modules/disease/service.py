from __future__ import annotations

import uuid

from app.modules.disease.model_registry.interface import ModelRunner
from app.modules.disease.repository import DiseaseRepository


class DiseaseService:
    def __init__(
        self,
        repo: DiseaseRepository,
        model_runner: ModelRunner,
        media_service: object,
    ) -> None:
        self._repo = repo
        self._model_runner = model_runner
        self._media_service = media_service

    async def run_scan(
        self,
        image_bytes: bytes,
        field_id: uuid.UUID | None = None,
        notes: str | None = None,
    ) -> dict:
        raise NotImplementedError

    async def get_history(self, farm_id: uuid.UUID) -> list[dict]:
        raise NotImplementedError

    async def get_scan_detail(self, scan_id: uuid.UUID) -> dict:
        raise NotImplementedError
