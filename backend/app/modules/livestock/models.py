from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import Date, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.persistence.base_model import Base, TimestampMixin


class Animal(Base, TimestampMixin):
    __tablename__ = "animals"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    farm_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("farms.id"), index=True)
    name: Mapped[str] = mapped_column(String)
    animal_type: Mapped[str] = mapped_column(String)
    breed: Mapped[str | None] = mapped_column(String, nullable=True)
    birth_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    tag_id: Mapped[str | None] = mapped_column(String, unique=True, nullable=True)
    status: Mapped[str] = mapped_column(String, default="active")
    purchase_price: Mapped[float | None] = mapped_column(nullable=True)
    purchase_date: Mapped[date | None] = mapped_column(Date, nullable=True)


class HealthEvent(Base, TimestampMixin):
    __tablename__ = "health_events"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    animal_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("animals.id"), index=True)
    event_type: Mapped[str] = mapped_column(String)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    event_date: Mapped[date] = mapped_column(Date)
