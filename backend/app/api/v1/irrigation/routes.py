from __future__ import annotations

from datetime import date, datetime, timezone

from fastapi import APIRouter

from .schemas import IrrigationLog, IrrigationOverride, IrrigationRecommendation

router = APIRouter()


@router.get("/recommendation/{field_id}", response_model=IrrigationRecommendation)
async def get_recommendation(field_id: str) -> IrrigationRecommendation:
    # TODO: inject service
    return IrrigationRecommendation(
        field_id=field_id,
        date=date.today(),
        eto_mm=4.2,
        kc=0.85,
        etc_mm=3.57,
        decision="irrigate",
        explanation={"reason": "soil moisture below threshold"},
    )


@router.get("/logs/{field_id}", response_model=list[IrrigationLog])
async def get_logs(field_id: str) -> list[IrrigationLog]:
    # TODO: inject service
    return [
        IrrigationLog(
            id="log-001",
            field_id=field_id,
            timestamp=datetime.now(tz=timezone.utc),
            volume_liters=1200.0,
            source="well",
            method="drip",
        )
    ]


@router.post("/override", response_model=dict)
async def create_override(body: IrrigationOverride) -> dict:
    # TODO: inject service
    return {"status": "accepted", "field_id": body.field_id}


@router.get("/usage/{field_id}", response_model=dict)
async def get_usage(field_id: str) -> dict:
    # TODO: inject service
    return {
        "field_id": field_id,
        "period": "last_7_days",
        "total_liters": 8400.0,
        "avg_daily_liters": 1200.0,
    }
