"""Pydantic request/response schemas for the market-prices API."""
from __future__ import annotations

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# GET /series
# ---------------------------------------------------------------------------


class RegionPrices(BaseModel):
    nord: float | None = None
    sahel: float | None = None
    centre_et_sud: float | None = None


class SeriesInfo(BaseModel):
    series_name: str
    description: str
    unit: str
    latest_date: str
    latest_price: float
    cagr_pct: float
    regions: RegionPrices


# ---------------------------------------------------------------------------
# GET /series/{series_name}/history
# ---------------------------------------------------------------------------


class PricePoint(BaseModel):
    date: str
    price: float
    region: str


# ---------------------------------------------------------------------------
# POST /forecast
# ---------------------------------------------------------------------------


class ForecastRequest(BaseModel):
    series_name: str
    horizon: int = Field(default=12, ge=1, le=60)
    model: str = Field(default="auto", pattern="^(auto|sarima|seasonal_naive)$")
    force_refresh: bool = False
    region: str = Field(default="national", pattern="^(national|nord|sahel|centre_et_sud)$")


class ScenarioPoint(BaseModel):
    date: str
    p10: float
    p25: float
    p50: float
    p75: float
    p90: float
    mean: float


class ForecastPoint(BaseModel):
    date: str
    forecast: float
    lower_80: float
    upper_80: float
    lower_95: float
    upper_95: float


class ForecastResponse(BaseModel):
    series_name: str
    region: str = "national"
    generated_at: str
    model_used: str
    horizon: int
    forecast: list[ForecastPoint]
    scenarios: list[ScenarioPoint]


# ---------------------------------------------------------------------------
# GET /forecast/{series_name}/scenarios
# ---------------------------------------------------------------------------


class ScenariosResponse(BaseModel):
    series_name: str
    generated_at: str
    scenarios: list[ScenarioPoint]


# ---------------------------------------------------------------------------
# POST /forecast/batch
# ---------------------------------------------------------------------------


class BatchForecastRequest(BaseModel):
    series: list[str]
    horizon: int = Field(default=12, ge=1, le=60)
