from __future__ import annotations

from app.modules.notification.channels.console import ConsoleChannel
from app.modules.notification.channels.push import PushChannel


class NotificationService:
    def __init__(self) -> None:
        self.console = ConsoleChannel()
        self.push = PushChannel()

    async def send_price_alert(
        self,
        db,
        user_id: str,
        series_name: str,
        condition: str,
        threshold: float,
        current_price: float,
        unit: str,
    ) -> None:
        from app.modules.notification.repository import get_device_tokens_for_user

        direction = "exceeded" if condition == "above" else "dropped below"
        title = f"Price Alert — {series_name}"
        body = (
            f"{series_name} has {direction} your threshold of "
            f"{threshold:.0f} {unit}. Current price: {current_price:.0f} {unit}."
        )

        await self.console.send(user_id, title, body, severity="info")

        tokens = await get_device_tokens_for_user(db, str(user_id))
        if tokens:
            await self.push.send(
                tokens=[t.token for t in tokens],
                title=title,
                body=body,
                data={
                    "series_name": series_name,
                    "current_price": current_price,
                    "threshold": threshold,
                    "condition": condition,
                },
            )

    async def send_to_user(
        self,
        db,
        user_id: str,
        title: str,
        body: str,
        data: dict | None = None,
    ) -> None:
        from app.modules.notification.repository import get_device_tokens_for_user

        await self.console.send(user_id, title, body, severity="info")

        tokens = await get_device_tokens_for_user(db, str(user_id))
        if tokens:
            await self.push.send([t.token for t in tokens], title, body, data or {})
