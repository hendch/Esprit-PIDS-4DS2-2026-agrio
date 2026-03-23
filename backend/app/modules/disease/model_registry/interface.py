from __future__ import annotations

from typing import Protocol


class ModelRunner(Protocol):
    async def predict(self, image_bytes: bytes) -> dict:
        """Return {"disease_name": str, "confidence": float, "severity": str}."""
        ...
