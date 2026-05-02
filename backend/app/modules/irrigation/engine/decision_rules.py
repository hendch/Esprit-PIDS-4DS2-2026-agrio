from __future__ import annotations


def evaluate_irrigation_need(
    etc_mm: float,
    soil_moisture_pct: float,
    forecast_rain_mm: float,
) -> dict:
    # Skip if moisture already very high
    if soil_moisture_pct >= 80:
        return {
            "decision": "skip",
            "reason": "Soil moisture already above 80%",
            "recommended_mm": 0.0,
        }
    
    # CRITICAL: Check 50% threshold first
    if soil_moisture_pct < 50:
        # But check rain forecast before deciding to irrigate
        if forecast_rain_mm >= etc_mm:
            return {
                "decision": "skip",
                "reason": "Moisture below 50% but forecasted rain covers crop water demand",
                "recommended_mm": 0.0,
            }
        # Moisture low AND insufficient rain -> IRRIGATE
        return {
            "decision": "irrigate",
            "reason": "Soil moisture below 50% threshold and insufficient rain forecast",
            "recommended_mm": etc_mm,
        }
    
    # Moisture >= 50%, check if rain covers crop need
    if forecast_rain_mm >= etc_mm:
        return {
            "decision": "skip",
            "reason": "Forecasted rain covers crop water demand",
            "recommended_mm": 0.0,
        }

    # Moisture adequate but partial rain expected
    deficit = etc_mm - forecast_rain_mm
    recommended = max(deficit, 0.0)

    if forecast_rain_mm > 0:
        return {
            "decision": "reduce",
            "reason": "Partial rain expected; supplementing remaining deficit",
            "recommended_mm": round(recommended, 2),
        }

    # Moisture adequate, no rain expected -> skip
    return {
        "decision": "skip",
        "reason": "Soil moisture adequate (>= 50%) and no additional water needed",
        "recommended_mm": 0.0,
    }