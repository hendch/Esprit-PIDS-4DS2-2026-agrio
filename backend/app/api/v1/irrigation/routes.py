from __future__ import annotations

from fastapi import APIRouter

from app.modules.irrigation.repository import IrrigationRepository

router = APIRouter()

_repo = IrrigationRepository()
_agent = None


def _get_agent():
    global _agent
    if _agent is None:
        from app.modules.ai.agent.orchestrator import IrrigationAgent

        _agent = IrrigationAgent()
    return _agent


@router.post("/check")
async def check_irrigation(data: dict):
    """Ask the irrigation agent whether to irrigate."""
    crop = data.get("crop", "wheat")
    growth_stage = data.get("growth_stage", "mid")
    lat = data.get("lat", 36.8)
    lon = data.get("lon", 10.18)
    query = f"Should I irrigate {crop} at {lat},{lon}?"
    result = _get_agent().run(
        query=query,
        crop=crop,
        growth_stage=growth_stage,
        lat=float(lat),
        lon=float(lon),
    )
    return {"decision": result}


@router.get("/history")
async def get_history():
    """Return recent irrigation events."""
    rows = _repo.get_history()
    return {"history": rows}


@router.get("/recommendation/{field_id}")
async def get_recommendation(field_id: str):
    """Get irrigation recommendation for a field (placeholder)."""
    # TODO: look up field coords from farms module
    result = _get_agent().run(
        query=f"Should I irrigate the field {field_id}?",
        crop="wheat",
        growth_stage="mid",
        lat=36.8,
        lon=10.18,
    )
    return {"field_id": field_id, "recommendation": result}
