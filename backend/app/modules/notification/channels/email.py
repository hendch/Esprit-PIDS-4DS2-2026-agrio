from __future__ import annotations

import uuid


class EmailChannel:
    async def send(
        self,
        user_id: uuid.UUID,
        title: str,
        body: str,
        severity: str,
    ) -> None:
        raise NotImplementedError
