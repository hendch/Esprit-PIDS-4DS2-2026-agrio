from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.middleware.auth import get_current_user
from app.modules.market_prices.data.loader import ALL_SERIES
from app.modules.notification import repository
from app.persistence.db import get_async_session

router = APIRouter()

DbSession = Annotated[AsyncSession, Depends(get_async_session)]
_VALID_SERIES = frozenset(ALL_SERIES)


class DeviceTokenBody(BaseModel):
    token: str
    platform: str  # 'ios' | 'android'


class DeleteTokenBody(BaseModel):
    token: str


class CreateAlertBody(BaseModel):
    series_name: str
    condition: str  # 'above' | 'below'
    threshold: float


class UpdateAlertBody(BaseModel):
    threshold: float | None = None
    condition: str | None = None
    is_active: bool | None = None


def _alert_to_dict(alert) -> dict:
    return {
        "id": str(alert.id),
        "user_id": str(alert.user_id),
        "series_name": alert.series_name,
        "condition": alert.condition,
        "threshold": alert.threshold,
        "is_active": alert.is_active,
        "last_triggered_at": (
            alert.last_triggered_at.isoformat() if alert.last_triggered_at else None
        ),
        "created_at": alert.created_at.isoformat(),
    }


@router.post("/device-token")
async def register_device_token(
    body: DeviceTokenBody,
    db: DbSession,
    current_user: dict = Depends(get_current_user),
) -> dict:
    await repository.save_device_token(db, current_user["user_id"], body.token, body.platform)
    return {"registered": True, "token": body.token}


@router.delete("/device-token")
async def remove_device_token(
    body: DeleteTokenBody,
    db: DbSession,
    _: dict = Depends(get_current_user),
) -> dict:
    deleted = await repository.delete_device_token(db, body.token)
    return {"deleted": deleted}


@router.get("/alerts")
async def list_alerts(
    db: DbSession,
    current_user: dict = Depends(get_current_user),
) -> list:
    alerts = await repository.get_alerts_for_user(db, current_user["user_id"])
    return [_alert_to_dict(a) for a in alerts]


@router.post("/alerts", status_code=201)
async def create_alert(
    body: CreateAlertBody,
    db: DbSession,
    current_user: dict = Depends(get_current_user),
) -> dict:
    if body.series_name not in _VALID_SERIES:
        raise HTTPException(
            status_code=422,
            detail=f"Unknown series '{body.series_name}'. Valid: {sorted(_VALID_SERIES)}",
        )
    if body.condition not in ("above", "below"):
        raise HTTPException(status_code=422, detail="condition must be 'above' or 'below'")

    alert = await repository.create_alert(
        db,
        current_user["user_id"],
        {
            "series_name": body.series_name,
            "condition": body.condition,
            "threshold": body.threshold,
        },
    )
    return _alert_to_dict(alert)


@router.put("/alerts/{alert_id}")
async def update_alert(
    alert_id: str,
    body: UpdateAlertBody,
    db: DbSession,
    current_user: dict = Depends(get_current_user),
) -> dict:
    if body.condition is not None and body.condition not in ("above", "below"):
        raise HTTPException(status_code=422, detail="condition must be 'above' or 'below'")

    alert = await repository.update_alert(
        db,
        alert_id,
        current_user["user_id"],
        body.model_dump(exclude_none=True),
    )
    if alert is None:
        raise HTTPException(status_code=404, detail="Alert not found")
    return _alert_to_dict(alert)


@router.delete("/alerts/{alert_id}")
async def delete_alert(
    alert_id: str,
    db: DbSession,
    current_user: dict = Depends(get_current_user),
) -> dict:
    deleted = await repository.delete_alert(db, alert_id, current_user["user_id"])
    if not deleted:
        raise HTTPException(status_code=404, detail="Alert not found")
    return {"deleted": True}


@router.post("/alerts/check-now")
async def trigger_alert_check(
    db: DbSession,
    _: dict = Depends(get_current_user),
) -> dict:
    """Manually trigger the price alert checker. Useful for testing."""
    from app.modules.notification.alert_checker import PriceAlertChecker

    checker = PriceAlertChecker()
    return await checker.check_all(db)


@router.post("/vaccination/check-now")
async def trigger_vaccination_check(
    db: DbSession,
    _: dict = Depends(get_current_user),
) -> dict:
    """Manually trigger the vaccination reminder checker. Useful for testing."""
    from app.modules.notification.vaccination_checker import VaccinationChecker

    checker = VaccinationChecker()
    return await checker.check_all(db)
