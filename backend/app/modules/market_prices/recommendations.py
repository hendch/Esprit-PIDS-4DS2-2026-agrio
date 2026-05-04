"""Buy/sell recommendation logic derived from a 12-month price forecast."""
from __future__ import annotations

from datetime import date, datetime


def generate_recommendation(
    forecast: list[dict],
    series_name: str,
    unit: str,
) -> dict | None:
    """Return a buy/sell recommendation dict from a 12-month forecast list.

    Parameters
    ----------
    forecast:
        List of dicts with keys: date (YYYY-MM or YYYY-MM-DD), forecast, lower_95, upper_95.
    series_name:
        Series identifier, included verbatim in the response.
    unit:
        Price unit string (e.g. "TND/head"), included in advice text.
    """
    if not forecast:
        return None

    today = date.today()
    current_month = today.replace(day=1)

    future_forecast = [
        row for row in forecast
        if date(int(row["date"][:4]), int(row["date"][5:7]), 1) >= current_month
    ]

    if not future_forecast:
        return {
            "series_name": series_name,
            "unit": unit,
            "action": "stale",
            "sell_advice": "No future forecast months available. Please refresh the forecast.",
            "best_month": None,
            "worst_month": None,
            "avoid_advice": None,
            "generated_from": "cached_forecast",
        }

    best = max(future_forecast, key=lambda x: x["forecast"])
    worst = min(future_forecast, key=lambda x: x["forecast"])
    current = future_forecast[0]

    pct_to_best = ((best["forecast"] - current["forecast"]) / current["forecast"]) * 100
    pct_to_worst = ((worst["forecast"] - current["forecast"]) / current["forecast"]) * 100

    def _parse_date(date_str: str) -> datetime:
        fmt = "%Y-%m-%d" if len(date_str) > 7 else "%Y-%m"
        return datetime.strptime(date_str, fmt)

    def month_label(date_str: str) -> str:
        return _parse_date(date_str).strftime("%B %Y")

    def short_date(date_str: str) -> str:
        return _parse_date(date_str).strftime("%Y-%m")

    if pct_to_best > 5:
        sell_advice = (
            f"Best time to sell is {month_label(best['date'])} "
            f"when prices are forecast to peak at "
            f"{round(best['forecast']):,} {unit}. "
            f"That is {pct_to_best:.1f}% above next month's forecast."
        )
        action = "wait"
    else:
        sell_advice = (
            "Prices are relatively stable over the next 12 months. "
            "No significant peak expected — you can sell anytime."
        )
        action = "neutral"

    avoid_advice = (
        f"Avoid selling in {month_label(worst['date'])} "
        f"when prices are forecast to drop to "
        f"{round(worst['forecast']):,} {unit} "
        f"({abs(pct_to_worst):.1f}% below next month)."
    ) if abs(pct_to_worst) > 3 else None

    return {
        "series_name": series_name,
        "unit": unit,
        "action": action,
        "best_month": {
            "date": short_date(best["date"]),
            "month_label": month_label(best["date"]),
            "forecast_price": round(best["forecast"], 2),
            "lower_95": round(best.get("lower_95", best["forecast"]), 2),
            "upper_95": round(best.get("upper_95", best["forecast"]), 2),
            "pct_above_current": round(pct_to_best, 1),
        },
        "worst_month": {
            "date": short_date(worst["date"]),
            "month_label": month_label(worst["date"]),
            "forecast_price": round(worst["forecast"], 2),
            "lower_95": round(worst.get("lower_95", worst["forecast"]), 2),
            "upper_95": round(worst.get("upper_95", worst["forecast"]), 2),
            "pct_below_current": round(abs(pct_to_worst), 1),
        },
        "sell_advice": sell_advice,
        "avoid_advice": avoid_advice,
        "generated_from": "cached_forecast",
    }
