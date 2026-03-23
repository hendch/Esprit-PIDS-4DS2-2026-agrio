from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter

from .schemas import LedgerEntryResponse, ProofExportRequest, ProofExportResponse

router = APIRouter()

_STUB_ENTRY = LedgerEntryResponse(
    id="ledger-001",
    farm_id="farm-001",
    event_type="irrigation_applied",
    payload={"field_id": "field-001", "volume_liters": 1200},
    hash="abc123def456",
    prev_hash=None,
    created_at=datetime.now(tz=timezone.utc),
)


@router.get("/entries", response_model=list[LedgerEntryResponse])
async def list_entries() -> list[LedgerEntryResponse]:
    # TODO: inject service
    return [_STUB_ENTRY]


@router.get("/entries/{entry_id}", response_model=LedgerEntryResponse)
async def get_entry(entry_id: str) -> LedgerEntryResponse:
    # TODO: inject service
    return _STUB_ENTRY


@router.post("/export-proof", response_model=ProofExportResponse)
async def export_proof(body: ProofExportRequest) -> ProofExportResponse:
    # TODO: inject service
    return ProofExportResponse(
        entries=[_STUB_ENTRY.model_dump()],
        merkle_root="e3b0c44298fc1c149afbf4c8996fb924",
    )
