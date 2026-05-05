"""Pydantic request/response schemas for the produce-prices API."""
from __future__ import annotations

from pydantic import BaseModel, Field


class ProductInfo(BaseModel):
    product: str
    category: str
    display_name: str
    unit: str
    latest_date: str | None = None
    latest_retail_price: float | None = None
    latest_wholesale_price: float | None = None
    weeks_of_data: int = 0


class ProduceHistoryPoint(BaseModel):
    date: str
    retail_mid: float
    wholesale_mid: float
    qte: float | None = None


class ProduceForecastRequest(BaseModel):
    product: str
    horizon: int = Field(default=220, ge=1, le=260)
    force_refresh: bool = False


class ProduceBatchRequest(BaseModel):
    products: list[str]
    horizon: int = Field(default=220, ge=1, le=260)
