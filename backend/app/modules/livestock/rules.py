from __future__ import annotations

from datetime import date, timedelta

from app.modules.livestock.models import Animal, HealthEvent


def evaluate_alerts(
    animal: Animal,
    health_events: list[HealthEvent],
) -> list[dict]:
    today = date.today()
    alerts: list[dict] = []

    vaccination_events = [e for e in health_events if e.event_type == "vaccination"]
    if vaccination_events:
        latest_vaccination = max(vaccination_events, key=lambda e: e.event_date)
        if today - latest_vaccination.event_date > timedelta(days=180):
            alerts.append({
                "alert_type": "missed_vaccine",
                "severity": "high",
                "message": f"No vaccination recorded in the last 180 days for {animal.name}.",
                "animal_id": str(animal.id),
            })
    else:
        alerts.append({
            "alert_type": "missed_vaccine",
            "severity": "high",
            "message": f"No vaccination records found for {animal.name}.",
            "animal_id": str(animal.id),
        })

    checkup_events = [e for e in health_events if e.event_type == "checkup"]
    if checkup_events:
        latest_checkup = max(checkup_events, key=lambda e: e.event_date)
        if today - latest_checkup.event_date > timedelta(days=365):
            alerts.append({
                "alert_type": "overdue_checkup",
                "severity": "medium",
                "message": f"No checkup recorded in the last 365 days for {animal.name}.",
                "animal_id": str(animal.id),
            })
    else:
        alerts.append({
            "alert_type": "overdue_checkup",
            "severity": "medium",
            "message": f"No checkup records found for {animal.name}.",
            "animal_id": str(animal.id),
        })

    return alerts
