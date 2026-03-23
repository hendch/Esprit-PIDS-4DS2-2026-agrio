from __future__ import annotations

import uuid
from datetime import date

from app.modules.ledger.repository import LedgerRepository


class LedgerService:
    def __init__(self, repo: LedgerRepository) -> None:
        self._repo = repo

    async def append_entry(
        self,
        farm_id: uuid.UUID,
        event_type: str,
        payload: dict,
    ) -> dict:
        raise NotImplementedError

    async def get_entries(self, farm_id: uuid.UUID) -> list[dict]:
        raise NotImplementedError

    async def verify_integrity(self, farm_id: uuid.UUID) -> bool:
        raise NotImplementedError

    async def export_proof(
        self,
        farm_id: uuid.UUID,
        from_date: date,
        to_date: date,
    ) -> dict:
        raise NotImplementedError
