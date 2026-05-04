from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text
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
    user_id: Mapped[str] = mapped_column(String, index=True)  
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


class FieldMoistureSensor(Base, TimestampMixin):
    __tablename__ = "field_moisture_sensors"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    field_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("fields.id"), index=True)
    name: Mapped[str] = mapped_column(String)
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    depth_cm: Mapped[float | None] = mapped_column(Float, nullable=True)
    simulated_moisture_pct: Mapped[float] = mapped_column(Float, default=45.0)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class FieldTask(Base, TimestampMixin):
    __tablename__ = "field_tasks"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    field_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("fields.id"), index=True)
    task_type: Mapped[str] = mapped_column(String)
    title: Mapped[str] = mapped_column(String)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    source: Mapped[str] = mapped_column(String, default="system")
