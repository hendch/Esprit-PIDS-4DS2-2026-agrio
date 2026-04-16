"""SQLAlchemy ORM models for market price history and forecast storage."""
from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Float, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.persistence.base_model import Base, TimestampMixin


class MarketPriceHistory(Base, TimestampMixin):
    """One monthly price observation for a series + region combination."""

    __tablename__ = "market_price_history"
    __table_args__ = (
        UniqueConstraint("series_name", "region", "price_date", name="uq_series_region_date"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    series_name: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    region: Mapped[str] = mapped_column(String(32), nullable=False, default="national")
    price_date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    price: Mapped[float] = mapped_column(Float, nullable=False)


class MarketForecast(Base):
    """Cached forecast result (JSON blob) for a series + region, keyed by generation date."""

    __tablename__ = "market_forecasts"
    __table_args__ = (
        UniqueConstraint(
            "series_name", "region", "generated_date",
            name="uq_series_region_generated_date",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    series_name: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    region: Mapped[str] = mapped_column(String(32), index=True, nullable=False, default="national")
    horizon: Mapped[int] = mapped_column(Integer, nullable=False)
    model_used: Mapped[str] = mapped_column(String(32), nullable=False)
    generated_date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    result_json: Mapped[str] = mapped_column(Text, nullable=False)
