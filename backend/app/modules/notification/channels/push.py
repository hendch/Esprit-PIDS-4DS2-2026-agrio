from __future__ import annotations

import logging

import httpx

logger = logging.getLogger(__name__)


class PushChannel:
    EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"

    async def send(
        self,
        tokens: list[str],
        title: str,
        body: str,
        data: dict | None = None,
    ) -> dict:
        if not tokens:
            return {"status": "no_tokens"}

        messages = [
            {
                "to": token,
                "title": title,
                "body": body,
                "data": data or {},
                "sound": "default",
                "priority": "high",
            }
            for token in tokens
        ]

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.EXPO_PUSH_URL,
                    json=messages,
                    headers={
                        "Accept": "application/json",
                        "Accept-Encoding": "gzip, deflate",
                        "Content-Type": "application/json",
                    },
                    timeout=10.0,
                )
                response.raise_for_status()
                result = response.json()
                for ticket in result.get("data", []):
                    if ticket.get("status") == "error":
                        logger.warning("Push ticket error: %s", ticket.get("message"))
                return result
        except Exception as exc:
            logger.warning("Push delivery failed (non-fatal): %s", exc)
            return {"status": "push_error", "detail": str(exc)}
