from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter

from .schemas import NDVIResponse, SatelliteSnapshot, ZoneMapResponse

router = APIRouter()

_NOW = datetime.now(tz=timezone.utc)


@router.get("/snapshot/{field_id}", response_model=SatelliteSnapshot)
async def get_snapshot(field_id: str) -> SatelliteSnapshot:
    # TODO: inject service
    return SatelliteSnapshot(
        id="snap-001",
        field_id=field_id,
        captured_at=_NOW,
        provider="sentinel-2",
        indices={"ndvi": 0.72, "evi": 0.55},
    )


@router.get("/ndvi/{field_id}", response_model=NDVIResponse)
async def get_ndvi(field_id: str) -> NDVIResponse:
    # TODO: inject service
    return NDVIResponse(
        field_id=field_id,
        mean_ndvi=0.72,
        min_ndvi=0.45,
        max_ndvi=0.91,
        captured_at=_NOW,
    )


@router.get("/zones/{field_id}", response_model=ZoneMapResponse)
async def get_zones(field_id: str) -> ZoneMapResponse:
    # TODO: inject service
    return ZoneMapResponse(
        field_id=field_id,
        zones=[
            {"zone_id": 1, "label": "high-vigor", "area_pct": 40.0},
            {"zone_id": 2, "label": "medium-vigor", "area_pct": 45.0},
            {"zone_id": 3, "label": "low-vigor", "area_pct": 15.0},
        ],
        generated_at=_NOW,
    )
