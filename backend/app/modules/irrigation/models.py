from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.persistence.base_model import Base, TimestampMixin


class IrrigationEvent(Base, TimestampMixin):
    __tablename__ = "irrigation_events"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    moisture_level: Mapped[float | None] = mapped_column(Float, nullable=True)
    water_amount: Mapped[float] = mapped_column(Float)
    duration: Mapped[int | None] = mapped_column(Integer, nullable=True)
    next_irrigation: Mapped[str | None] = mapped_column(String, nullable=True)
    crop_type: Mapped[str | None] = mapped_column(String, nullable=True)
    weather_conditions: Mapped[str | None] = mapped_column(String, nullable=True)


class IrrigationSchedule(Base, TimestampMixin):
    __tablename__ = "irrigation_schedules"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    field_id: Mapped[str] = mapped_column(String, index=True)
    target_date: Mapped[date] = mapped_column(Date, index=True)
    start_time: Mapped[str] = mapped_column(String)
    duration_minutes: Mapped[int] = mapped_column(Integer)
    water_volume: Mapped[float] = mapped_column(Float)
    status: Mapped[str] = mapped_column(String, default="pending")


class AppSetting(Base):
    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String, primary_key=True)
    value: Mapped[str] = mapped_column(String)
