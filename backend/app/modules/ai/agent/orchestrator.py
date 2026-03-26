from __future__ import annotations

import logging

from langchain_groq import ChatGroq

from app.modules.irrigation.engine.decision_rules import evaluate_irrigation_need
from app.modules.irrigation.engine.explainability import build_explanation
from app.settings import settings

logger = logging.getLogger(__name__)


class IrrigationAgent:
    """LLM-powered agent that reasons about irrigation decisions."""

    def __init__(self) -> None:
        self.llm = ChatGroq(
            api_key=settings.groq_api_key,
            model=settings.groq_model,
            temperature=0,
        )
        from app.modules.ai.agent.tools import (
            calculate_crop_water_need,
            control_irrigation_pump,
            fetch_weather_data,
            log_irrigation_event,
            read_soil_moisture,
        )

        self.tools = {
            "fetch_weather": fetch_weather_data,
            "calc_water": calculate_crop_water_need,
            "read_moisture": read_soil_moisture,
            "control_pump": control_irrigation_pump,
            "log_event": log_irrigation_event,
        }

    def run(
        self,
        query: str,
        crop: str = "wheat",
        growth_stage: str = "mid",
        lat: float = 36.8,
        lon: float = 10.18,
    ) -> str:
        prompt = (
            "You are an irrigation decision agent.\n\n"
            f"Task: {query}\n\n"
            "Available tools: fetch_weather, calc_water, read_moisture, "
            "control_pump, log_event\n\n"
            "Reason through the decision step by step, "
            "then provide a final recommendation."
        )
        reasoning = self.llm.invoke(prompt)
        logger.info("LLM reasoning: %s", reasoning.content[:200])
        return self._execute_decision(
            reasoning=reasoning.content,
            crop=crop,
            growth_stage=growth_stage,
            lat=lat,
            lon=lon,
        )

    def _execute_decision(
        self,
        reasoning: str,
        crop: str,
        growth_stage: str,
        lat: float,
        lon: float,
    ) -> str:
        weather = self.tools["fetch_weather"].invoke({"lat": lat, "lon": lon})
        moisture = self.tools["read_moisture"].invoke({})
        water_need = self.tools["calc_water"].invoke(
            {
                "et0": float(weather["et0"]),
                "crop": crop,
                "growth_stage": growth_stage,
            }
        )

        decision = evaluate_irrigation_need(
            etc_mm=float(water_need["etc_mm_per_day"]),
            soil_moisture_pct=float(moisture["moisture_percent"]),
            forecast_rain_mm=float(weather["precipitation"]),
        )
        explanation = build_explanation(
            eto=float(weather["et0"]),
            kc=float(water_need["kc"]),
            etc=float(water_need["etc_mm_per_day"]),
            soil_moisture=float(moisture["moisture_percent"]),
            forecast_rain=float(weather["precipitation"]),
            decision_result=decision,
        )

        if decision["decision"] in {"irrigate", "reduce"} and decision["recommended_mm"] > 0:
            recommended_mm = float(decision["recommended_mm"])
            duration = max(60, int(recommended_mm * 45))
            self.tools["control_pump"].invoke(
                {"action": "ON", "duration_seconds": duration}
            )
            self.tools["log_event"].invoke(
                {
                    "moisture": moisture["moisture_percent"],
                    "amount": recommended_mm,
                    "duration": duration,
                    "crop": crop,
                    "weather": str(weather),
                }
            )
            return (
                f"{decision['decision'].capitalize()} - ET0 {weather['et0']:.2f}, "
                f"Kc {water_need['kc']:.2f}, ETc {water_need['etc_mm_per_day']:.2f}, "
                f"rain {weather['precipitation']:.2f} mm, moisture {moisture['moisture_percent']:.1f}%. "
                f"Apply {recommended_mm:.2f} mm (pump {duration}s). "
                f"Reason: {decision['reason']}. "
                f"Confidence: {explanation['confidence']:.2f}."
            )

        return (
            f"Skip - ET0 {weather['et0']:.2f}, Kc {water_need['kc']:.2f}, "
            f"ETc {water_need['etc_mm_per_day']:.2f}, rain {weather['precipitation']:.2f} mm, "
            f"moisture {moisture['moisture_percent']:.1f}%. "
            f"Reason: {decision['reason']}. Confidence: {explanation['confidence']:.2f}."
        )
