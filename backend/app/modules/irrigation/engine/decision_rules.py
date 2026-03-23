from __future__ import annotations


def evaluate_irrigation_need(
    etc_mm: float,
    soil_moisture_pct: float,
    forecast_rain_mm: float,
) -> dict:
    if soil_moisture_pct > 80:
        return {
            "decision": "skip",
            "reason": "Soil moisture already above 80%",
            "recommended_mm": 0.0,
        }

    if forecast_rain_mm >= etc_mm:
        return {
            "decision": "skip",
            "reason": "Forecasted rain covers crop water demand",
            "recommended_mm": 0.0,
        }

    deficit = etc_mm - forecast_rain_mm
    recommended = max(deficit, 0.0)

    if forecast_rain_mm > 0:
        return {
            "decision": "reduce",
            "reason": "Partial rain expected; supplementing remaining deficit",
            "recommended_mm": round(recommended, 2),
        }

    return {
        "decision": "irrigate",
        "reason": "No rain expected and soil moisture below threshold",
        "recommended_mm": round(recommended, 2),
    }
