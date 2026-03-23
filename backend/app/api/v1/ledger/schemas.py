from __future__ import annotations

from datetime import date, datetime

from pydantic import BaseModel


class LedgerEntryResponse(BaseModel):
    id: str
    farm_id: str
    event_type: str
    payload: dict
    hash: str
    prev_hash: str | None
    created_at: datetime


class ProofExportRequest(BaseModel):
    from_date: date
    to_date: date


class ProofExportResponse(BaseModel):
    entries: list
    merkle_root: str | None = None
