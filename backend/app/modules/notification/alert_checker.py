from __future__ import annotations

from datetime import datetime

from app.modules.notification.repository import (
    get_active_alerts_for_series,
    get_distinct_alert_series,
    get_latest_price_for_series,
    mark_alert_triggered,
)
from app.modules.notification.service import NotificationService

# Unit strings mirror _SERIES_METADATA in market_prices routes
_SERIES_UNITS: dict[str, str] = {
    "brebis_suitees": "TND/head",
    "genisses_pleines": "TND/head",
    "vaches_suitees": "TND/head",
    "viandes_rouges": "TND/kg",
    "bovins_suivis": "TND/head",
    "vaches_gestantes": "TND/head",
    "tbn": "TND/bale",
    "qrt": "TND/bale",
}


class PriceAlertChecker:
    def __init__(self) -> None:
        self.notification_service = NotificationService()

    async def check_all(self, db) -> dict:
        results = {"checked": 0, "triggered": 0, "errors": 0}

        series_list = await get_distinct_alert_series(db)

        for series_name in series_list:
            try:
                latest = await get_latest_price_for_series(db, series_name)
                if not latest:
                    continue

                current_price = latest.price
                unit = _SERIES_UNITS.get(series_name, "TND")

                alerts = await get_active_alerts_for_series(db, series_name)

                for alert in alerts:
                    results["checked"] += 1

                    triggered = (
                        alert.condition == "above" and current_price > alert.threshold
                    ) or (
                        alert.condition == "below" and current_price < alert.threshold
                    )

                    if not triggered:
                        continue

                    # 24-hour cooldown — don't spam the farmer
                    if alert.last_triggered_at:
                        hours_since = (
                            datetime.utcnow() - alert.last_triggered_at
                        ).total_seconds() / 3600
                        if hours_since < 24:
                            continue

                    await self.notification_service.send_price_alert(
                        db=db,
                        user_id=str(alert.user_id),
                        series_name=series_name,
                        condition=alert.condition,
                        threshold=alert.threshold,
                        current_price=current_price,
                        unit=unit,
                    )

                    await mark_alert_triggered(db, alert.id)
                    results["triggered"] += 1

            except Exception as e:
                print(f"[AlertChecker] error for {series_name}: {e}")
                results["errors"] += 1

        return results
