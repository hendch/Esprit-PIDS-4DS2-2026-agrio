from __future__ import annotations

from typing import Any


def build_explanation(
    eto: float,
    kc: float,
    etc: float,
    soil_moisture: float,
    forecast_rain: float,
    decision_result: dict[str, Any],
) -> dict[str, Any]:
    rules_fired: list[str] = []
    if soil_moisture > 80:
        rules_fired.append("high_soil_moisture_skip")
    if forecast_rain >= etc:
        rules_fired.append("rain_covers_demand")
    if 0 < forecast_rain < etc:
        rules_fired.append("partial_rain_reduce")
    if forecast_rain == 0 and soil_moisture <= 80:
        rules_fired.append("no_rain_irrigate")

    confidence = _estimate_confidence(soil_moisture, forecast_rain, etc)

    decision = decision_result.get("decision", "unknown")
    recommended_mm = decision_result.get("recommended_mm", 0.0)
    reason = decision_result.get("reason", "")

    narrative = (
        f"ET0={eto:.2f} mm, Kc={kc:.2f}, ETc={etc:.2f} mm. "
        f"Soil moisture at {soil_moisture:.1f}%, forecast rain {forecast_rain:.1f} mm. "
        f"Decision: {decision}. {reason}"
    )

    return {
        "signals": {
            "eto": eto,
            "kc": kc,
            "etc": etc,
            "soil_moisture_pct": soil_moisture,
            "forecast_rain_mm": forecast_rain,
        },
        "rules_fired": rules_fired,
        "decision": decision,
        "recommended_mm": recommended_mm,
        "confidence": round(confidence, 2),
        "narrative": narrative,
    }


def _estimate_confidence(
    soil_moisture: float,
    forecast_rain: float,
    etc: float,
) -> float:
    base = 0.70
    if soil_moisture > 80 or soil_moisture < 20:
        base += 0.15
    if forecast_rain == 0 or forecast_rain > etc * 1.5:
        base += 0.10
    return min(base, 1.0)
