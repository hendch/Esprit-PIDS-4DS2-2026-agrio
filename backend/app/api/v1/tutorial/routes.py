from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.middleware.auth import get_current_user
from app.modules.auth.models import TutorialProgress
from app.persistence.db import get_async_session

router = APIRouter()

STEPS_ORDER = [
    "add_animal",
    "view_market_value",
    "set_price_alert",
    "generate_forecast",
    "view_recommendation",
    "join_community",
]

DbSession = Annotated[AsyncSession, Depends(get_async_session)]


def _next_step(completed: list[str]) -> str | None:
    for step in STEPS_ORDER:
        if step not in completed:
            return step
    return None


def _progress_dict(record: TutorialProgress) -> dict:
    return {
        "is_completed": record.is_completed,
        "completed_steps": record.completed_steps,
        "skipped_at": record.skipped_at.isoformat() if record.skipped_at else None,
        "completed_at": record.completed_at.isoformat() if record.completed_at else None,
        "next_step": _next_step(record.completed_steps),
    }


async def _get_or_create(db: AsyncSession, user_id: uuid.UUID) -> TutorialProgress:
    result = await db.execute(
        select(TutorialProgress).where(TutorialProgress.user_id == user_id)
    )
    record = result.scalar_one_or_none()
    if record is None:
        record = TutorialProgress(user_id=user_id, completed_steps=[])
        db.add(record)
        await db.commit()
        await db.refresh(record)
    return record


@router.get("/progress")
async def get_progress(
    db: DbSession,
    current_user: dict = Depends(get_current_user),
) -> dict:
    user_id = uuid.UUID(current_user["user_id"])
    record = await _get_or_create(db, user_id)
    return _progress_dict(record)


@router.post("/step/{step_key}")
async def complete_step(
    step_key: str,
    db: DbSession,
    current_user: dict = Depends(get_current_user),
) -> dict:
    if step_key not in STEPS_ORDER:
        raise HTTPException(status_code=400, detail=f"Invalid step '{step_key}'. Must be one of: {STEPS_ORDER}")

    user_id = uuid.UUID(current_user["user_id"])
    record = await _get_or_create(db, user_id)

    steps = list(record.completed_steps)
    if step_key not in steps:
        steps.append(step_key)
        record.completed_steps = steps

    if all(s in steps for s in STEPS_ORDER):
        record.is_completed = True
        if record.completed_at is None:
            record.completed_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(record)

    # Award badge when tutorial completes if profile is also complete
    if record.is_completed:
        from app.modules.auth.models import User
        from app.modules.auth.service import is_profile_complete
        user_result = await db.execute(select(User).where(User.id == user_id))
        user = user_result.scalar_one_or_none()
        if user and not user.is_verified_farmer and is_profile_complete(user):
            user.is_verified_farmer = True
            await db.commit()

    return _progress_dict(record)


@router.post("/skip")
async def skip_tutorial(
    db: DbSession,
    current_user: dict = Depends(get_current_user),
) -> dict:
    user_id = uuid.UUID(current_user["user_id"])
    record = await _get_or_create(db, user_id)
    record.skipped_at = datetime.now(timezone.utc)
    await db.commit()
    return {"skipped": True}


@router.post("/reset")
async def reset_tutorial(
    db: DbSession,
    current_user: dict = Depends(get_current_user),
) -> dict:
    user_id = uuid.UUID(current_user["user_id"])
    record = await _get_or_create(db, user_id)
    record.completed_steps = []
    record.is_completed = False
    record.skipped_at = None
    record.completed_at = None
    await db.commit()
    await db.refresh(record)
    return _progress_dict(record)
