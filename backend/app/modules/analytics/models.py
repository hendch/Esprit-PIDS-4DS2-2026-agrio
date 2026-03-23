from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import Date, Float, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.persistence.base_model import Base, TimestampMixin


class DailySummary(Base, TimestampMixin):
    __tablename__ = "daily_summaries"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    farm_id: Mapped[uuid.UUID] = mapped_column(index=True)
    date: Mapped[date] = mapped_column(Date)
    water_saved_liters: Mapped[float] = mapped_column(Float)
    crop_health_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    livestock_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    temperature_c: Mapped[float | None] = mapped_column(Float, nullable=True)
