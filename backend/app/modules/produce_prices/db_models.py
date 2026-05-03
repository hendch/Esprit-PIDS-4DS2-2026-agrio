"""SQLAlchemy ORM models for produce price history and forecast storage."""
from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Float,
    Integer,
    JSON,
    String,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.persistence.base_model import Base


class ProducePriceForecast(Base):
    """Cached forecast result (JSON blob) for a produce product."""

    __tablename__ = "produce_price_forecasts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    product: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    category: Mapped[str] = mapped_column(String(16), index=True, nullable=False)
    model_used: Mapped[str] = mapped_column(String(32), nullable=False)
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        index=True,
        nullable=False,
    )
    horizon_weeks: Mapped[int] = mapped_column(Integer, nullable=False)
    forecast_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    scenarios_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    backtest_metrics: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    best_mape: Mapped[float | None] = mapped_column(Float, nullable=True)
    best_mase: Mapped[float | None] = mapped_column(Float, nullable=True)
    warnings: Mapped[list | None] = mapped_column(JSON, nullable=True)
    is_latest: Mapped[bool] = mapped_column(Boolean, default=True, index=True, nullable=False)


class ProducePriceHistory(Base):
    """One weekly price observation for a produce product."""

    __tablename__ = "produce_price_history"
    __table_args__ = (
        UniqueConstraint("product", "price_date", name="uq_produce_product_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    product: Mapped[str] = mapped_column(String(64), index=True, nullable=False)
    category: Mapped[str] = mapped_column(String(16), index=True, nullable=False)
    price_date: Mapped[date] = mapped_column(Date, index=True, nullable=False)
    retail_mid: Mapped[float] = mapped_column(Float, nullable=False)
    wholesale_mid: Mapped[float] = mapped_column(Float, nullable=False)
    qte: Mapped[float | None] = mapped_column(Float, nullable=True)
    unit: Mapped[str] = mapped_column(String(32), nullable=False, default="millimes/kg")
