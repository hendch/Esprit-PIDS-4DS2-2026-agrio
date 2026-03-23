from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession


class LedgerRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session
