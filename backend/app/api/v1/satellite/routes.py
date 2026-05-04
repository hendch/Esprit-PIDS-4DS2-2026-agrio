from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.di import get_db
from app.modules.farms.repository import FarmRepository
from app.modules.satellite.providers.demo_provider import DemoProvider
from app.modules.satellite.providers.sentinel_provider import SentinelProvider
from app.modules.satellite.repository import SatelliteRepository
from app.modules.satellite.service import SatelliteService

from .schemas import NDVIResponse, SatelliteSnapshot, ZoneMapResponse

router = APIRouter()


def get_satellite_service(db: AsyncSession = Depends(get_db)) -> SatelliteService:
    # Switch to DemoProvider() if you need a fallback while credentials are not configured.
    provider = SentinelProvider()
    return SatelliteService(
        provider=provider,
        repo=SatelliteRepository(db),
        farm_repo=FarmRepository(db),
    )


@router.get("/snapshot/{field_id}", response_model=SatelliteSnapshot)
async def get_snapshot(
    field_id: str,
    service: SatelliteService = Depends(get_satellite_service),
) -> SatelliteSnapshot:
    try:
        parsed_field_id = uuid.UUID(field_id)
        payload = await service.fetch_snapshot(parsed_field_id)
        return SatelliteSnapshot(**payload)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except NotImplementedError as exc:
        raise HTTPException(status_code=501, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Satellite snapshot failed: {exc}") from exc


@router.get("/ndvi/{field_id}", response_model=NDVIResponse)
async def get_ndvi(
    field_id: str,
    service: SatelliteService = Depends(get_satellite_service),
) -> NDVIResponse:
    try:
        parsed_field_id = uuid.UUID(field_id)
        payload = await service.compute_ndvi(parsed_field_id)
        return NDVIResponse(**payload)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except NotImplementedError as exc:
        raise HTTPException(status_code=501, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"NDVI computation failed: {exc}") from exc


@router.get("/zones/{field_id}", response_model=ZoneMapResponse)
async def get_zones(
    field_id: str,
    service: SatelliteService = Depends(get_satellite_service),
) -> ZoneMapResponse:
    try:
        parsed_field_id = uuid.UUID(field_id)
        payload = await service.generate_zones(parsed_field_id)
        return ZoneMapResponse(**payload)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    except NotImplementedError as exc:
        raise HTTPException(status_code=501, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Zone generation failed: {exc}") from exc