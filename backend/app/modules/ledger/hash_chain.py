from __future__ import annotations

import hashlib
import json

from app.modules.ledger.models import LedgerEntry


def compute_hash(prev_hash: str | None, event_type: str, payload: dict) -> str:
    raw = json.dumps(
        {"prev_hash": prev_hash, "event_type": event_type, "payload": payload},
        sort_keys=True,
    )
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def verify_chain(entries: list[LedgerEntry]) -> bool:
    for i, entry in enumerate(entries):
        expected_prev = entries[i - 1].hash if i > 0 else None
        if entry.prev_hash != expected_prev:
            return False
        expected_hash = compute_hash(entry.prev_hash, entry.event_type, entry.payload)
        if entry.hash != expected_hash:
            return False
    return True
