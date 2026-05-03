from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.middleware.auth import get_current_user
from app.modules.gamification import repository
from app.modules.gamification.service import GamificationService
from app.persistence.db import get_async_session

router = APIRouter()

DbSession = Annotated[AsyncSession, Depends(get_async_session)]
_svc = GamificationService()


@router.get("/dashboard")
async def get_dashboard(
    db: DbSession,
    current_user: dict = Depends(get_current_user),
) -> dict:
    return await _svc.get_dashboard(db, current_user["user_id"])


@router.post("/login")
async def award_login(
    db: DbSession,
    current_user: dict = Depends(get_current_user),
) -> dict:
    from sqlalchemy import select
    from app.modules.auth.models import User

    user_id = uuid.UUID(current_user["user_id"])
    result = await db.execute(select(User.is_verified_farmer).where(User.id == user_id))
    is_verified_farmer = bool(result.scalar_one_or_none())

    outcome = await _svc.award_daily_login(db, str(user_id), is_verified_farmer)
    if outcome is None:
        raise HTTPException(status_code=403, detail="Only verified farmers can earn coins")
    return outcome


@router.post("/tasks/{task_key}/complete")
async def complete_task(
    task_key: str,
    db: DbSession,
    current_user: dict = Depends(get_current_user),
) -> dict:
    from sqlalchemy import select
    from app.modules.auth.models import User

    user_id = uuid.UUID(current_user["user_id"])
    result = await db.execute(select(User.is_verified_farmer).where(User.id == user_id))
    is_verified_farmer = bool(result.scalar_one_or_none())

    if not is_verified_farmer:
        raise HTTPException(status_code=403, detail="Only verified farmers can complete tasks")

    try:
        outcome = await _svc.complete_daily_task(db, str(user_id), task_key, is_verified_farmer)
    except ValueError as exc:
        if "already_completed" in str(exc):
            raise HTTPException(status_code=400, detail="Task already completed today")
        raise HTTPException(status_code=404, detail=str(exc))

    return outcome


@router.get("/leaderboard")
async def get_leaderboard(db: DbSession) -> list[dict]:
    return await repository.get_leaderboard(db, limit=50)
