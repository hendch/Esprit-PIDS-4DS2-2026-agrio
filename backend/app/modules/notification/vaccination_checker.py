"""Vaccination reminder checker — runs periodically alongside the price alert loop."""
from __future__ import annotations

from datetime import datetime

from app.modules.notification.repository import (
    get_due_vaccination_animals,
    get_vaccination_reminder,
    upsert_vaccination_reminder,
)
from app.modules.notification.service import NotificationService


class VaccinationChecker:
    def __init__(self) -> None:
        self.notification_service = NotificationService()

    async def check_all(self, db) -> dict:
        results = {"checked": 0, "reminded": 0, "errors": 0}

        due_animals = await get_due_vaccination_animals(db)

        for animal in due_animals:
            results["checked"] += 1
            try:
                reminder = await get_vaccination_reminder(db, animal["animal_id"])

                # 7-day cooldown between reminders
                if reminder and reminder.last_reminded_at:
                    days_since = (datetime.utcnow() - reminder.last_reminded_at).days
                    if days_since < 7:
                        continue

                last_vax = animal.get("last_vax_date")
                if last_vax:
                    msg = (
                        f"{animal['animal_name']} ({animal['animal_type']}) "
                        f"has not been vaccinated since {last_vax}. "
                        f"Annual vaccination is due."
                    )
                else:
                    msg = (
                        f"{animal['animal_name']} ({animal['animal_type']}) "
                        f"has no vaccination record. "
                        f"Please schedule a vaccination."
                    )

                await self.notification_service.send_to_user(
                    db=db,
                    user_id=animal["user_id"],
                    title="🐄 Vaccination Reminder",
                    body=msg,
                    data={
                        "type": "vaccination_reminder",
                        "animal_id": animal["animal_id"],
                        "farm_id": animal["farm_id"],
                    },
                )

                await upsert_vaccination_reminder(
                    db, animal["animal_id"], animal["user_id"], animal["farm_id"]
                )
                results["reminded"] += 1

            except Exception as e:
                print(f"[VaxChecker] error for {animal['animal_name']}: {e}")
                results["errors"] += 1

        return results
