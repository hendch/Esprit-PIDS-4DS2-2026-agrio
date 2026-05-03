from __future__ import annotations

import uuid
from datetime import date

from pydantic import BaseModel, Field


class AnimalCreate(BaseModel):
    farm_id: uuid.UUID
    name: str
    animal_type: str
    breed: str | None = None
    birth_date: date | None = None
    tag_id: str | None = None
    status: str = Field(default="active")
    purchase_price: float | None = None
    purchase_date: date | None = None


class AnimalUpdate(BaseModel):
    name: str | None = None
    animal_type: str | None = None
    breed: str | None = None
    birth_date: date | None = None
    tag_id: str | None = None
    status: str | None = None
    purchase_price: float | None = None
    purchase_date: date | None = None


class AnimalResponse(BaseModel):
    id: str
    farm_id: str
    name: str
    animal_type: str
    breed: str | None
    birth_date: str | None
    tag_id: str | None
    status: str
    purchase_price: float | None = None
    purchase_date: str | None = None
    age_months: int | None
    market_series: str | None
    created_at: str | None = None
    updated_at: str | None = None
    health_events: list["HealthEventResponse"] | None = None


class HealthEventCreate(BaseModel):
    event_type: str
    description: str | None = None
    event_date: date


class HealthEventResponse(BaseModel):
    id: str
    animal_id: str
    event_type: str
    description: str | None
    event_date: str
    created_at: str | None = None


class MarketPriceResponse(BaseModel):
    series_name: str
    latest_price: float
    unit: str
    cagr_pct: float
    market_series: str
