from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import JSON, Date, Float, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.persistence.base_model import Base, TimestampMixin


class IrrigationEvent(Base, TimestampMixin):
    __tablename__ = "irrigation_events"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    field_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("fields.id"), index=True)
    event_date: Mapped[date] = mapped_column(Date)
    eto_mm: Mapped[float] = mapped_column(Float)
    kc: Mapped[float] = mapped_column(Float)
    etc_mm: Mapped[float] = mapped_column(Float)
    decision: Mapped[str] = mapped_column(String)
    explanation: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    volume_liters: Mapped[float | None] = mapped_column(Float, nullable=True)


class IrrigationPlan(Base, TimestampMixin):
    __tablename__ = "irrigation_plans"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    field_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("fields.id"))
    start_date: Mapped[date] = mapped_column(Date)
    end_date: Mapped[date] = mapped_column(Date)
    strategy: Mapped[str | None] = mapped_column(String, nullable=True)
