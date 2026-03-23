from __future__ import annotations

import uuid


class NotificationService:
    def __init__(self, channels: list) -> None:
        self._channels = channels

    async def send(
        self,
        user_id: uuid.UUID,
        title: str,
        body: str,
        severity: str = "info",
    ) -> None:
        for channel in self._channels:
            await channel.send(user_id, title, body, severity)
