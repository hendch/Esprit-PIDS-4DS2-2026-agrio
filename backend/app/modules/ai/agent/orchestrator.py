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
        if not settings.groq_api_key:
            raise ValueError("GROQ_API_KEY is missing in settings!")

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
            "You are an expert irrigation decision agent.\n\n"
            f"Task: {query}\n\n"
            "Use tools when needed and give clear final decision."
        )

        reasoning = self.llm.invoke(prompt)
        logger.info("LLM reasoning: %s", reasoning.content[:300])

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
        # Get real data
        weather = self.tools["fetch_weather"].invoke({"lat": lat, "lon": lon})
        moisture = self.tools["read_moisture"].invoke({})
        water_need = self.tools["calc_water"].invoke(
            {
                "et0": float(weather.get("et0", 0)),
                "crop": crop,
                "growth_stage": growth_stage,
            }
        )

        decision = evaluate_irrigation_need(
            etc_mm=float(water_need.get("etc_mm_per_day", 0)),
            soil_moisture_pct=float(moisture.get("moisture_percent", 0)),
            forecast_rain_mm=float(weather.get("precipitation", 0)),
        )

        explanation = build_explanation(
            eto=float(weather.get("et0", 0)),
            kc=float(water_need.get("kc", 0)),
            etc=float(water_need.get("etc_mm_per_day", 0)),
            soil_moisture=float(moisture.get("moisture_percent", 0)),
            forecast_rain=float(weather.get("precipitation", 0)),
            decision_result=decision,
        )

        # === IRRIGATE / REDUCE ===
        if decision["decision"] in {"irrigate", "reduce"} and decision.get("recommended_mm", 0) > 0:
            recommended_mm = float(decision["recommended_mm"])
            duration = max(60, int(recommended_mm * 45))

            logger.info(f"Activating pump for {duration} seconds ({recommended_mm:.1f}mm)")

            self.tools["control_pump"].invoke(
                {"action": "ON", "duration_seconds": duration}
            )

            self.tools["log_event"].invoke({
                "moisture": moisture.get("moisture_percent"),
                "amount": recommended_mm,
                "duration": duration,
                "crop": crop,
                "weather": str(weather),
            })

            return (
                f"{decision['decision'].capitalize()} - "
                f"Recommended {recommended_mm:.1f}mm → Pump ON for {duration}s. "
                f"Reason: {decision['reason']}"
            )

        # === NO IRRIGATION NEEDED → TURN PUMP OFF ===
        else:
            logger.info("No irrigation needed → Turning pump OFF")

            # Fixed: Provide duration_seconds even for OFF
            self.tools["control_pump"].invoke(
                {"action": "OFF", "duration_seconds": 0}
            )

            self.tools["log_event"].invoke({
                "moisture": moisture.get("moisture_percent"),
                "amount": 0.0,
                "duration": 0,
                "crop": crop,
                "weather": str(weather),
            })

            return (
                f"No irrigation needed. "
                f"Reason: {decision['reason']}. "
                f"Moisture: {moisture.get('moisture_percent', 0):.1f}%"
            )