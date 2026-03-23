from __future__ import annotations

import logging
import uuid

logger = logging.getLogger(__name__)


class ConsoleChannel:
    async def send(
        self,
        user_id: uuid.UUID,
        title: str,
        body: str,
        severity: str,
    ) -> None:
        logger.info(
            "[%s] Notification for user %s: %s — %s",
            severity.upper(),
            user_id,
            title,
            body,
        )
