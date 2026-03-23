from __future__ import annotations

import uuid


class SmsChannel:
    async def send(
        self,
        user_id: uuid.UUID,
        title: str,
        body: str,
        severity: str,
    ) -> None:
        raise NotImplementedError
