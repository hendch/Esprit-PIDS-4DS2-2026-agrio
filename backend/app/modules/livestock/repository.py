from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.livestock.models import Animal, HealthEvent


class LivestockRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def list_animals(self, farm_id: uuid.UUID) -> list[Animal]:
        stmt = select(Animal).where(Animal.farm_id == farm_id)
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def get_animal(self, animal_id: uuid.UUID) -> Animal | None:
        stmt = select(Animal).where(Animal.id == animal_id)
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def create_animal(self, animal: Animal) -> Animal:
        self._session.add(animal)
        await self._session.flush()
        return animal

    async def save_health_event(self, event: HealthEvent) -> HealthEvent:
        self._session.add(event)
        await self._session.flush()
        return event

    async def list_health_events(self, animal_id: uuid.UUID) -> list[HealthEvent]:
        stmt = (
            select(HealthEvent)
            .where(HealthEvent.animal_id == animal_id)
            .order_by(HealthEvent.event_date.desc())
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())
