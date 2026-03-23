from __future__ import annotations

from datetime import date

from fastapi import APIRouter

from .schemas import DashboardSummary, KPIRecord, WaterFootprint

router = APIRouter()


@router.get("/dashboard", response_model=DashboardSummary)
async def get_dashboard() -> DashboardSummary:
    # TODO: inject service
    return DashboardSummary(
        water_saved_liters=15400.0,
        temperature_c=28.5,
        crop_health_pct=87.3,
        livestock_count=42,
        date=date.today(),
    )


@router.get("/water-footprint/{field_id}", response_model=WaterFootprint)
async def get_water_footprint(field_id: str) -> WaterFootprint:
    # TODO: inject service
    return WaterFootprint(
        field_id=field_id,
        period="last_30_days",
        total_liters=36000.0,
        efficiency_pct=82.5,
    )


@router.get("/kpis", response_model=list[KPIRecord])
async def get_kpis() -> list[KPIRecord]:
    # TODO: inject service
    return [
        KPIRecord(metric="yield_per_ha", value=4.2, unit="tonnes", date=date.today()),
        KPIRecord(metric="water_use_efficiency", value=82.5, unit="percent", date=date.today()),
    ]
