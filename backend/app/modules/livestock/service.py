from __future__ import annotations

from app.modules.livestock.repository import LivestockRepository


class LivestockService:
    def __init__(self, repo: LivestockRepository) -> None:
        self._repo = repo
