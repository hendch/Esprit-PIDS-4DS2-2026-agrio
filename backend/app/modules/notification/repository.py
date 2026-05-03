from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.notification.models import DevicePushToken, PriceAlert, VaccinationReminder


async def save_device_token(
    db: AsyncSession,
    user_id: str | uuid.UUID,
    token: str,
    platform: str,
) -> DevicePushToken:
    stmt = select(DevicePushToken).where(DevicePushToken.token == token)
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()

    if existing is not None:
        existing.platform = platform
        await db.commit()
        await db.refresh(existing)
        return existing

    new_token = DevicePushToken(
        id=uuid.uuid4(),
        user_id=uuid.UUID(str(user_id)),
        token=token,
        platform=platform,
    )
    db.add(new_token)
    await db.commit()
    await db.refresh(new_token)
    return new_token


async def get_device_tokens_for_user(
    db: AsyncSession,
    user_id: str | uuid.UUID,
) -> list[DevicePushToken]:
    stmt = select(DevicePushToken).where(
        DevicePushToken.user_id == uuid.UUID(str(user_id))
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def delete_device_token(db: AsyncSession, token: str) -> bool:
    stmt = delete(DevicePushToken).where(DevicePushToken.token == token)
    result = await db.execute(stmt)
    await db.commit()
    return result.rowcount > 0


async def get_alerts_for_user(
    db: AsyncSession,
    user_id: str | uuid.UUID,
) -> list[PriceAlert]:
    stmt = select(PriceAlert).where(
        PriceAlert.user_id == uuid.UUID(str(user_id))
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def create_alert(
    db: AsyncSession,
    user_id: str | uuid.UUID,
    data: dict,
) -> PriceAlert:
    alert = PriceAlert(
        id=uuid.uuid4(),
        user_id=uuid.UUID(str(user_id)),
        series_name=data["series_name"],
        condition=data["condition"],
        threshold=data["threshold"],
    )
    db.add(alert)
    await db.commit()
    await db.refresh(alert)
    return alert


async def update_alert(
    db: AsyncSession,
    alert_id: str | uuid.UUID,
    user_id: str | uuid.UUID,
    data: dict,
) -> PriceAlert | None:
    stmt = select(PriceAlert).where(
        PriceAlert.id == uuid.UUID(str(alert_id)),
        PriceAlert.user_id == uuid.UUID(str(user_id)),
    )
    result = await db.execute(stmt)
    alert = result.scalar_one_or_none()
    if alert is None:
        return None

    for field, value in data.items():
        setattr(alert, field, value)

    await db.commit()
    await db.refresh(alert)
    return alert


async def delete_alert(
    db: AsyncSession,
    alert_id: str | uuid.UUID,
    user_id: str | uuid.UUID,
) -> bool:
    stmt = delete(PriceAlert).where(
        PriceAlert.id == uuid.UUID(str(alert_id)),
        PriceAlert.user_id == uuid.UUID(str(user_id)),
    )
    result = await db.execute(stmt)
    await db.commit()
    return result.rowcount > 0


async def get_active_alerts_for_series(
    db: AsyncSession,
    series_name: str,
) -> list[PriceAlert]:
    stmt = select(PriceAlert).where(
        PriceAlert.series_name == series_name,
        PriceAlert.is_active.is_(True),
    )
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def mark_alert_triggered(db: AsyncSession, alert_id: str | uuid.UUID) -> None:
    stmt = select(PriceAlert).where(PriceAlert.id == uuid.UUID(str(alert_id)))
    result = await db.execute(stmt)
    alert = result.scalar_one_or_none()
    if alert is not None:
        alert.last_triggered_at = datetime.utcnow()
        await db.commit()


async def get_distinct_alert_series(db: AsyncSession) -> list[str]:
    from sqlalchemy import distinct

    stmt = (
        select(distinct(PriceAlert.series_name))
        .where(PriceAlert.is_active.is_(True))
    )
    result = await db.execute(stmt)
    return [row[0] for row in result.fetchall()]


async def get_latest_price_for_series(db: AsyncSession, series_name: str):
    from app.modules.market_prices.db_models import MarketPriceHistory

    stmt = (
        select(MarketPriceHistory)
        .where(MarketPriceHistory.series_name == series_name)
        .where(MarketPriceHistory.region == "national")
        .order_by(MarketPriceHistory.price_date.desc())
        .limit(1)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


# ---------------------------------------------------------------------------
# Vaccination reminders
# ---------------------------------------------------------------------------


async def get_due_vaccination_animals(db: AsyncSession) -> list[dict]:
    """Return all active animals due for vaccination across all farms."""
    from sqlalchemy import func, or_
    from app.modules.livestock.models import Animal, HealthEvent
    from app.modules.farms.models import Farm
    from datetime import date, timedelta

    cutoff_date = date.today() - timedelta(days=365)

    # Subquery: latest vaccination date per animal
    latest_vax = (
        select(
            HealthEvent.animal_id,
            func.max(HealthEvent.event_date).label("last_vax_date"),
        )
        .where(HealthEvent.event_type == "vaccination")
        .group_by(HealthEvent.animal_id)
        .subquery()
    )

    result = await db.execute(
        select(
            Animal.id.label("animal_id"),
            Animal.name.label("animal_name"),
            Animal.animal_type,
            Animal.farm_id,
            Farm.owner_id.label("user_id"),
            latest_vax.c.last_vax_date,
        )
        .join(Farm, Farm.id == Animal.farm_id)
        .outerjoin(latest_vax, latest_vax.c.animal_id == Animal.id)
        .where(Animal.status == "active")
        .where(
            or_(
                latest_vax.c.last_vax_date.is_(None),
                latest_vax.c.last_vax_date <= cutoff_date,
            )
        )
    )

    return [
        {
            "animal_id": str(r.animal_id),
            "animal_name": r.animal_name,
            "animal_type": r.animal_type,
            "farm_id": str(r.farm_id),
            "user_id": str(r.user_id),
            "last_vax_date": r.last_vax_date,
        }
        for r in result.fetchall()
    ]


async def get_vaccination_reminder(
    db: AsyncSession, animal_id: str | uuid.UUID
) -> VaccinationReminder | None:
    stmt = (
        select(VaccinationReminder)
        .where(VaccinationReminder.animal_id == uuid.UUID(str(animal_id)))
        .where(VaccinationReminder.is_resolved.is_(False))
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def upsert_vaccination_reminder(
    db: AsyncSession,
    animal_id: str | uuid.UUID,
    user_id: str | uuid.UUID,
    farm_id: str | uuid.UUID,
) -> VaccinationReminder:
    # Find ANY reminder for this animal (including resolved) to avoid unique constraint conflict
    stmt = select(VaccinationReminder).where(
        VaccinationReminder.animal_id == uuid.UUID(str(animal_id))
    )
    result = await db.execute(stmt)
    reminder = result.scalar_one_or_none()

    if reminder:
        reminder.last_reminded_at = datetime.utcnow()
        reminder.is_resolved = False  # reactivate if previously resolved
        await db.commit()
        return reminder

    reminder = VaccinationReminder(
        animal_id=uuid.UUID(str(animal_id)),
        user_id=uuid.UUID(str(user_id)),
        farm_id=uuid.UUID(str(farm_id)),
        last_reminded_at=datetime.utcnow(),
    )
    db.add(reminder)
    await db.commit()
    return reminder


async def resolve_vaccination_reminder(
    db: AsyncSession, animal_id: str | uuid.UUID
) -> None:
    """Mark reminder resolved when a vaccination health event is recorded."""
    reminder = await get_vaccination_reminder(db, animal_id)
    if reminder:
        reminder.is_resolved = True
        await db.commit()
