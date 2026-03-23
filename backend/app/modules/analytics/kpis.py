from __future__ import annotations

from app.modules.analytics.models import DailySummary


def compute_water_saved(planned_liters: float, actual_liters: float) -> float:
    return max(planned_liters - actual_liters, 0.0)


def compute_streak(daily_summaries: list[DailySummary]) -> int:
    sorted_days = sorted(daily_summaries, key=lambda s: s.date, reverse=True)
    streak = 0
    for summary in sorted_days:
        if summary.water_saved_liters > 0:
            streak += 1
        else:
            break
    return streak
