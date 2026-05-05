from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, Float, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.persistence.base_model import Base, TimestampMixin


class DevicePushToken(Base, TimestampMixin):
    __tablename__ = "device_push_tokens"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    token: Mapped[str] = mapped_column(String, unique=True)
    platform: Mapped[str] = mapped_column(String)  # 'ios' | 'android'

    __table_args__ = (UniqueConstraint("user_id", "token", name="uq_device_token_user_token"),)


class PriceAlert(Base, TimestampMixin):
    __tablename__ = "price_alerts"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    series_name: Mapped[str] = mapped_column(String, index=True)
    condition: Mapped[str] = mapped_column(String)  # 'above' | 'below'
    threshold: Mapped[float] = mapped_column(Float)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_triggered_at: Mapped[datetime | None] = mapped_column(nullable=True)


class VaccinationReminder(Base, TimestampMixin):
    __tablename__ = "vaccination_reminders"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    animal_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("animals.id"), index=True)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    farm_id: Mapped[uuid.UUID] = mapped_column(index=True)
    last_reminded_at: Mapped[datetime | None] = mapped_column(nullable=True)
    is_resolved: Mapped[bool] = mapped_column(Boolean, default=False)

    __table_args__ = (UniqueConstraint("animal_id", name="uq_vaccination_reminder_animal"),)
