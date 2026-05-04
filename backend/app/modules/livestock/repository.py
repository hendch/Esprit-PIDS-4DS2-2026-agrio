from __future__ import annotations

import uuid

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.livestock.models import Animal, HealthEvent


class LivestockRepository:
    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    # ------------------------------------------------------------------
    # Animals
    # ------------------------------------------------------------------

    async def get_animals(
        self,
        farm_id: uuid.UUID,
        skip: int = 0,
        limit: int = 100,
    ) -> list[Animal]:
        stmt = (
            select(Animal)
            .where(Animal.farm_id == farm_id)
            .order_by(Animal.created_at.asc())
            .offset(skip)
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def get_animal(
        self, animal_id: uuid.UUID, farm_id: uuid.UUID
    ) -> Animal | None:
        stmt = select(Animal).where(
            Animal.id == animal_id,
            Animal.farm_id == farm_id,
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def create_animal(self, farm_id: uuid.UUID, data: dict) -> Animal:
        animal = Animal(farm_id=farm_id, **data)
        self._session.add(animal)
        await self._session.commit()
        await self._session.refresh(animal)
        return animal

    async def update_animal(
        self, animal_id: uuid.UUID, farm_id: uuid.UUID, data: dict
    ) -> Animal | None:
        animal = await self.get_animal(animal_id, farm_id)
        if animal is None:
            return None
        for key, value in data.items():
            setattr(animal, key, value)
        await self._session.commit()
        await self._session.refresh(animal)
        return animal

    async def delete_animal(
        self, animal_id: uuid.UUID, farm_id: uuid.UUID
    ) -> bool:
        animal = await self.get_animal(animal_id, farm_id)
        if animal is None:
            return False
        await self._session.delete(animal)
        await self._session.commit()
        return True

    # ------------------------------------------------------------------
    # Health events
    # ------------------------------------------------------------------

    async def get_health_events(self, animal_id: uuid.UUID) -> list[HealthEvent]:
        stmt = (
            select(HealthEvent)
            .where(HealthEvent.animal_id == animal_id)
            .order_by(HealthEvent.event_date.desc())
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def create_health_event(
        self, animal_id: uuid.UUID, data: dict
    ) -> HealthEvent:
        event = HealthEvent(animal_id=animal_id, **data)
        self._session.add(event)
        await self._session.commit()
        await self._session.refresh(event)
        return event

    async def delete_health_event(
        self, event_id: uuid.UUID, animal_id: uuid.UUID
    ) -> bool:
        stmt = select(HealthEvent).where(
            HealthEvent.id == event_id,
            HealthEvent.animal_id == animal_id,
        )
        result = await self._session.execute(stmt)
        event = result.scalar_one_or_none()
        if event is None:
            return False
        await self._session.delete(event)
        await self._session.commit()
        return True
