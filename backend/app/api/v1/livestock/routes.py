from __future__ import annotations

import asyncio
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.middleware.auth import get_current_user
from app.modules.auth.models import User
from app.modules.livestock.service import LivestockService
from app.persistence.db import get_async_session

from .schemas import (
    AnimalCreate,
    AnimalResponse,
    AnimalUpdate,
    HealthEventCreate,
    HealthEventResponse,
    MarketPriceResponse,
)

router = APIRouter()

DbSession = Annotated[AsyncSession, Depends(get_async_session)]


# ---------------------------------------------------------------------------
# Animals
# ---------------------------------------------------------------------------

@router.get("/animals", response_model=list[AnimalResponse])
async def list_animals(
    farm_id: uuid.UUID,
    db: DbSession,
    skip: int = 0,
    limit: int = 100,
    _: dict = Depends(get_current_user),
) -> list[dict]:
    return await LivestockService.list_animals(db, farm_id)


@router.post("/animals", response_model=AnimalResponse, status_code=201)
async def create_animal(
    body: AnimalCreate,
    db: DbSession,
    _: dict = Depends(get_current_user),
) -> dict:
    try:
        return await LivestockService.create_animal(
            db, body.farm_id, body.model_dump(exclude={"farm_id"})
        )
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.get("/animals/stats")
async def get_herd_stats(
    farm_id: uuid.UUID,
    db: DbSession,
    _: dict = Depends(get_current_user),
) -> dict:
    return await LivestockService.get_herd_stats(db, farm_id)


@router.get("/animals/{animal_id}", response_model=AnimalResponse)
async def get_animal(
    animal_id: uuid.UUID,
    farm_id: uuid.UUID,
    db: DbSession,
    _: dict = Depends(get_current_user),
) -> dict:
    animal = await LivestockService.get_animal_detail(db, animal_id, farm_id)
    if animal is None:
        raise HTTPException(status_code=404, detail=f"Animal '{animal_id}' not found")
    return animal


@router.put("/animals/{animal_id}", response_model=AnimalResponse)
async def update_animal(
    animal_id: uuid.UUID,
    farm_id: uuid.UUID,
    body: AnimalUpdate,
    db: DbSession,
    _: dict = Depends(get_current_user),
) -> dict:
    try:
        data = body.model_dump(exclude_unset=True)
        animal = await LivestockService.update_animal(db, animal_id, farm_id, data)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    if animal is None:
        raise HTTPException(status_code=404, detail=f"Animal '{animal_id}' not found")
    return animal


@router.delete("/animals/{animal_id}")
async def delete_animal(
    animal_id: uuid.UUID,
    farm_id: uuid.UUID,
    db: DbSession,
    _: dict = Depends(get_current_user),
) -> dict:
    deleted = await LivestockService.delete_animal(db, animal_id, farm_id)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Animal '{animal_id}' not found")
    return {"deleted": True}


# ---------------------------------------------------------------------------
# Health events
# ---------------------------------------------------------------------------

@router.get("/animals/{animal_id}/health", response_model=list[HealthEventResponse])
async def get_health_events(
    animal_id: uuid.UUID,
    farm_id: uuid.UUID,
    db: DbSession,
    _: dict = Depends(get_current_user),
) -> list[dict]:
    try:
        return await LivestockService.get_health_events(db, animal_id, farm_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.post("/animals/{animal_id}/health", response_model=HealthEventResponse, status_code=201)
async def add_health_event(
    animal_id: uuid.UUID,
    farm_id: uuid.UUID,
    body: HealthEventCreate,
    db: DbSession,
    current_user: dict = Depends(get_current_user),
) -> dict:
    try:
        result = await LivestockService.add_health_event(
            db, animal_id, farm_id, body.model_dump()
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    _uid = uuid.UUID(current_user["user_id"])
    _ivf_result = await db.execute(select(User.is_verified_farmer).where(User.id == _uid))
    _ivf = bool(_ivf_result.scalar_one_or_none())
    _uid_str = str(_uid)

    async def _bg_health(uid: str, ivf: bool) -> None:
        from app.persistence.db import AsyncSessionLocal
        from app.modules.gamification.service import GamificationService
        async with AsyncSessionLocal() as _db:
            try:
                await GamificationService().complete_daily_task(_db, uid, "record_health_event", ivf)
            except Exception:
                pass

    asyncio.create_task(_bg_health(_uid_str, _ivf))
    return result



@router.delete("/animals/{animal_id}/health/{event_id}")
async def delete_health_event(
    animal_id: uuid.UUID,
    event_id: uuid.UUID,
    farm_id: uuid.UUID,
    db: DbSession,
    _: dict = Depends(get_current_user),
) -> dict:
    try:
        deleted = await LivestockService.delete_health_event(
            db, event_id, animal_id, farm_id
        )
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Health event '{event_id}' not found")
    return {"deleted": True}


# ---------------------------------------------------------------------------
# P&L calculator
# ---------------------------------------------------------------------------

@router.get("/animals/{animal_id}/pnl")
async def get_pnl(
    animal_id: uuid.UUID,
    farm_id: uuid.UUID,
    db: DbSession,
    _: dict = Depends(get_current_user),
) -> dict:
    result = await LivestockService.calculate_pnl(db, animal_id, farm_id)
    if result is None:
        raise HTTPException(status_code=404, detail=f"Animal '{animal_id}' not found")
    return result


# ---------------------------------------------------------------------------
# Market price lookup
# ---------------------------------------------------------------------------

@router.get("/animals/{animal_id}/market-price", response_model=MarketPriceResponse)
async def get_market_price(
    animal_id: uuid.UUID,
    farm_id: uuid.UUID,
    db: DbSession,
    _: dict = Depends(get_current_user),
) -> dict:
    animal = await LivestockService.get_animal_detail(db, animal_id, farm_id)
    if animal is None:
        raise HTTPException(status_code=404, detail=f"Animal '{animal_id}' not found")
    price = await LivestockService.get_market_price(db, animal["animal_type"])
    if price is None:
        raise HTTPException(
            status_code=404,
            detail=f"No market price series mapped for animal_type '{animal['animal_type']}'"
        )
    return price
