"""Market-prices API routes.

Endpoints
---------
GET  /series                          — summary info for all loaded series
GET  /series/{series_name}/history    — historical price points from DB
POST /forecast                        — run or return cached forecast
GET  /forecast/{series_name}/latest   — most recent stored forecast
GET  /forecast/{series_name}/scenarios — scenario fan from latest forecast
POST /forecast/batch                  — run forecasts for multiple series
"""
from __future__ import annotations

import json
import logging
from datetime import date, datetime, timezone
from typing import Annotated

import numpy as np
import pandas as pd
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.middleware.auth import get_current_user
from app.modules.market_prices.data.loader import ALL_SERIES, LivestockDataLoader
from app.modules.market_prices.pipeline import ForecastPipeline
from app.modules.market_prices.recommendations import generate_recommendation
from app.modules.market_prices.repository import MarketPriceRepository
from app.persistence.db import get_async_session

from .schemas import (
    BatchForecastRequest,
    ForecastPoint,
    ForecastRequest,
    ForecastResponse,
    PricePoint,
    RegionPrices,
    ScenarioPoint,
    ScenariosResponse,
    SeriesInfo,
)

router = APIRouter()
logger = logging.getLogger(__name__)

# Dependency alias — mirrors the pattern used in other route files
DbSession = Annotated[AsyncSession, Depends(get_async_session)]

# Human-readable descriptions keyed by series name
_SERIES_DESCRIPTIONS: dict[str, str] = {
    "brebis_suitees": "Ewes with suckling lambs — average price per head by region",
    "genisses_pleines": "In-calf heifers — average price per head by region",
    "vaches_suitees": "Cows with suckling calves — average price per head by region",
    "viandes_rouges": "Red meat live-weight sale price per kg by species",
    "bovins_suivis": "Monitored cattle — average price per head, all breeds",
    "vaches_gestantes": "Pregnant cows — average price per head by region",
    "tbn": "Straw (التبن) — animal fodder, price per bale by region",
    "qrt": "Clover/Vetch (القرط) — green fodder, price per bale by region",
}

_SERIES_METADATA: dict[str, dict] = {
    "brebis_suitees": {"display_name": "Brebis suitées", "unit": "TND/head", "category": "livestock"},
    "genisses_pleines": {"display_name": "Génisses pleines", "unit": "TND/head", "category": "livestock"},
    "vaches_suitees": {"display_name": "Vaches suitées", "unit": "TND/head", "category": "livestock"},
    "viandes_rouges": {"display_name": "Viandes rouges", "unit": "TND/kg", "category": "livestock"},
    "bovins_suivis": {"display_name": "Bovins suivis", "unit": "TND/head", "category": "livestock"},
    "vaches_gestantes": {"display_name": "Vaches gestantes", "unit": "TND/head", "category": "livestock"},
    "tbn": {"display_name": "Paille (التبن)", "unit": "TND/bale", "category": "fodder"},
    "qrt": {"display_name": "Vesce (القرط)", "unit": "TND/bale", "category": "fodder"},
}

_VALID_SERIES = set(ALL_SERIES)


def _check_series(series_name: str) -> None:
    """Raise 404 for unknown series names."""
    if series_name not in _VALID_SERIES:
        raise HTTPException(
            status_code=404,
            detail=(
                f"Series '{series_name}' not found. "
                f"Valid options: {sorted(_VALID_SERIES)}"
            ),
        )


def _cagr(series: pd.Series) -> float:
    """Compound annual growth rate over the full series history."""
    clean = series.dropna()
    if len(clean) < 13:
        return 0.0
    years = (len(clean) - 1) / 12.0
    try:
        return float((clean.iloc[-1] / clean.iloc[0]) ** (1 / years) - 1) * 100
    except (ZeroDivisionError, ValueError):
        return 0.0


# ---------------------------------------------------------------------------
# GET /series
# ---------------------------------------------------------------------------


@router.get("/series", response_model=list[SeriesInfo])
async def list_series(db: DbSession, _: dict = Depends(get_current_user)) -> list[SeriesInfo]:
    """Return summary information for every loaded price series.

    Loads metadata (latest price, CAGR) from the raw Excel files and
    fetches per-region prices from the database so that all series with
    regional data show non-null values.
    """
    loader = LivestockDataLoader()
    all_data = loader.load_all()
    repo = MarketPriceRepository(db)

    result: list[SeriesInfo] = []
    for name in ALL_SERIES:
        df = all_data.get(name)
        if df is None:
            continue

        nat = df["national_avg"].dropna()
        if nat.empty:
            continue

        latest_date = nat.index[-1].strftime("%Y-%m")
        latest_price = round(float(nat.iloc[-1]), 2)
        cagr = round(_cagr(nat), 2)

        # Fetch regional prices from DB at the most recent date for this series
        national_rows = await repo.get_price_history(series_name=name, region="national")
        region_values: dict[str, float | None] = {
            "nord": None, "sahel": None, "centre_et_sud": None
        }
        if national_rows:
            latest_db_date = national_rows[-1].price_date
            for region_key in ("nord", "sahel", "centre_et_sud"):
                rows = await repo.get_price_history(
                    series_name=name,
                    region=region_key,
                    start=latest_db_date,
                    end=latest_db_date,
                )
                if rows:
                    region_values[region_key] = round(rows[0].price, 2)

        regions = RegionPrices(
            nord=region_values["nord"],
            sahel=region_values["sahel"],
            centre_et_sud=region_values["centre_et_sud"],
        )

        result.append(
            SeriesInfo(
                series_name=name,
                description=_SERIES_DESCRIPTIONS.get(name, name),
                unit=str(df["unit"].iloc[0]) if "unit" in df.columns else "TND",
                latest_date=latest_date,
                latest_price=latest_price,
                cagr_pct=cagr,
                regions=regions,
            )
        )

    return result


# ---------------------------------------------------------------------------
# GET /series/{series_name}/history
# ---------------------------------------------------------------------------


@router.get("/series/{series_name}/history", response_model=list[PricePoint])
async def get_series_history(
    series_name: str,
    db: DbSession,
    start: str = "2020-01",
    end: str | None = None,
    region: str = "national",
    _: dict = Depends(get_current_user),
) -> list[PricePoint]:
    """Return monthly price history for *series_name* from the database.

    Query parameters
    ----------------
    start : str
        Inclusive start month in ``YYYY-MM`` format. Default: ``2020-01``.
    end : str | None
        Inclusive end month in ``YYYY-MM`` format. Default: current month.
    region : str
        One of ``national``, ``nord``, ``sahel``, ``centre_et_sud``.
        Default: ``national``.
    """
    _check_series(series_name)

    try:
        start_date = datetime.strptime(start, "%Y-%m").date().replace(day=1)
    except ValueError:
        raise HTTPException(status_code=422, detail=f"Invalid start format '{start}'. Use YYYY-MM.")

    end_date = None
    if end is not None:
        try:
            end_date = datetime.strptime(end, "%Y-%m").date().replace(day=1)
        except ValueError:
            raise HTTPException(status_code=422, detail=f"Invalid end format '{end}'. Use YYYY-MM.")

    repo = MarketPriceRepository(db)
    rows = await repo.get_price_history(
        series_name=series_name,
        region=region,
        start=start_date,
        end=end_date,
    )

    return [
        PricePoint(
            date=row.price_date.strftime("%Y-%m-%d"),
            price=round(row.price, 2),
            region=row.region,
        )
        for row in rows
    ]


# ---------------------------------------------------------------------------
# POST /forecast
# ---------------------------------------------------------------------------


@router.post("/forecast", response_model=ForecastResponse)
async def create_forecast(
    body: ForecastRequest,
    background_tasks: BackgroundTasks,
    db: DbSession,
    _: dict = Depends(get_current_user),
) -> ForecastResponse:
    """Run a price forecast or return today's cached result.

    If ``force_refresh=False`` and a forecast was already generated today
    for this series, the cached result is returned immediately without
    re-running the pipeline.

    After a fresh forecast the raw history data is saved to the DB in a
    background task so the ``/history`` endpoint stays up to date.
    """
    _check_series(body.series_name)

    repo = MarketPriceRepository(db)

    # Return cached forecast if available and not forcing refresh
    if not body.force_refresh:
        cached = await repo.get_forecast_generated_today(body.series_name, body.region)
        if cached is not None:
            return _forecast_record_to_response(cached)

    # Run pipeline
    try:
        pipeline = ForecastPipeline()
        result = pipeline.run(
            series_name=body.series_name,
            horizon=body.horizon,
            model=body.model,
            region=body.region,
        )
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        logger.exception("Pipeline failed for series '%s'", body.series_name)
        raise HTTPException(status_code=500, detail=f"Forecast pipeline error: {exc}")

    # Unsupported region (e.g. viandes_rouges + regional)
    if "error" in result:
        raise HTTPException(status_code=422, detail=result["error"])

    # Save forecast to DB
    history_rows = result.pop("history_rows", [])
    await repo.save_forecast(
        series_name=body.series_name,
        horizon=body.horizon,
        model_used=result["model_used"],
        result=result,
        region=body.region,
    )

    # Background: bulk upsert history so /history stays fresh
    if history_rows:
        background_tasks.add_task(_bulk_upsert_background, history_rows)

    return _result_dict_to_response(result)


# ---------------------------------------------------------------------------
# GET /forecast/{series_name}/latest
# ---------------------------------------------------------------------------


@router.get("/forecast/{series_name}/latest", response_model=ForecastResponse)
async def get_latest_forecast(series_name: str, db: DbSession, _: dict = Depends(get_current_user)) -> ForecastResponse:
    """Return the most recently stored forecast for *series_name*.

    Raises ``404`` if no forecast has ever been generated for this series.
    """
    _check_series(series_name)

    repo = MarketPriceRepository(db)
    record = await repo.get_latest_forecast(series_name)

    if record is None:
        raise HTTPException(
            status_code=404,
            detail=f"No forecast found for series '{series_name}'. Run POST /forecast first.",
        )

    return _forecast_record_to_response(record)


# ---------------------------------------------------------------------------
# GET /forecast/{series_name}/scenarios
# ---------------------------------------------------------------------------


@router.get("/forecast/{series_name}/scenarios", response_model=ScenariosResponse)
async def get_forecast_scenarios(series_name: str, db: DbSession, _: dict = Depends(get_current_user)) -> ScenariosResponse:
    """Return only the Monte Carlo scenario fan from the latest stored forecast.

    Raises ``404`` if no forecast has been saved yet.
    """
    _check_series(series_name)

    repo = MarketPriceRepository(db)
    record = await repo.get_latest_forecast(series_name)

    if record is None:
        raise HTTPException(
            status_code=404,
            detail=f"No forecast found for series '{series_name}'. Run POST /forecast first.",
        )

    data = json.loads(record.result_json)
    return ScenariosResponse(
        series_name=series_name,
        generated_at=record.generated_at.isoformat(),
        scenarios=[ScenarioPoint(**s) for s in data.get("scenarios", [])],
    )


# ---------------------------------------------------------------------------
# GET /series/{series_name}/recommendation
# ---------------------------------------------------------------------------


def _is_forecast_stale(forecast_list: list) -> bool:
    """Return True if every row in the forecast list is in the past."""
    if not forecast_list:
        return True
    current_month = date.today().replace(day=1)
    for row in forecast_list:
        ym = row["date"][:7]  # YYYY-MM
        if date(int(ym[:4]), int(ym[5:7]), 1) >= current_month:
            return False
    return True


async def _run_and_save_forecast(
    series_name: str,
    region: str,
    repo: MarketPriceRepository,
) -> tuple[list, str]:
    """Run the pipeline and persist the result. Returns (forecast_list, model_used)."""
    try:
        pipeline = ForecastPipeline()
        result = pipeline.run(series_name=series_name, horizon=12, model="auto", region=region)
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        logger.exception("Pipeline failed for series '%s'", series_name)
        raise HTTPException(status_code=500, detail=f"Forecast pipeline error: {exc}")

    if "error" in result:
        raise HTTPException(status_code=422, detail=result["error"])

    history_rows = result.pop("history_rows", [])
    await repo.save_forecast(
        series_name=series_name,
        horizon=12,
        model_used=result["model_used"],
        result=result,
        region=region,
    )
    if history_rows:
        import asyncio
        asyncio.create_task(_bulk_upsert_background(history_rows))

    return result.get("forecast", [])


@router.get("/series/{series_name}/recommendation")
async def get_series_recommendation(
    series_name: str,
    response: Response,
    db: DbSession,
    region: str = "national",
    _: dict = Depends(get_current_user),
) -> dict:
    """Return a buy/sell recommendation based on the latest 12-month forecast.

    Always uses a fresh forecast (future dates present). If the cached forecast
    is stale (all dates in the past) or missing, the pipeline is re-run.
    Sets ``X-Cache: HIT`` or ``MISS`` response header accordingly.
    """
    _check_series(series_name)

    repo = MarketPriceRepository(db)
    record = await repo.get_latest_forecast(series_name, region)
    cache_status = "HIT"

    if record is not None:
        data = json.loads(record.result_json)
        forecast_list = data.get("forecast", [])
        if _is_forecast_stale(forecast_list):
            record = None  # treat as missing — will re-run below

    if record is None:
        cache_status = "MISS"
        forecast_list = await _run_and_save_forecast(series_name, region, repo)
    else:
        data = json.loads(record.result_json)
        forecast_list = data.get("forecast", [])

    unit = _SERIES_METADATA.get(series_name, {}).get("unit", "TND")
    recommendation = generate_recommendation(forecast_list, series_name, unit)

    if recommendation is None:
        raise HTTPException(status_code=422, detail="No forecast data available to generate a recommendation.")

    response.headers["X-Cache"] = cache_status
    return recommendation


# ---------------------------------------------------------------------------
# POST /forecast/batch
# ---------------------------------------------------------------------------


@router.post("/forecast/batch", response_model=list[ForecastResponse])
async def batch_forecast(
    body: BatchForecastRequest,
    background_tasks: BackgroundTasks,
    db: DbSession,
    _: dict = Depends(get_current_user),
) -> list[ForecastResponse]:
    """Run the forecast pipeline for multiple series sequentially.

    Invalid series names are skipped with a warning log rather than aborting
    the entire batch.  Successfully completed forecasts are saved to the DB.
    """
    results: list[ForecastResponse] = []
    repo = MarketPriceRepository(db)
    pipeline = ForecastPipeline()

    for series_name in body.series:
        if series_name not in _VALID_SERIES:
            logger.warning("batch_forecast: skipping unknown series '%s'", series_name)
            continue

        try:
            result = pipeline.run(
                series_name=series_name,
                horizon=body.horizon,
                model="auto",
            )
        except Exception as exc:
            logger.warning("batch_forecast: pipeline failed for '%s': %s", series_name, exc)
            continue

        history_rows = result.pop("history_rows", [])
        await repo.save_forecast(
            series_name=series_name,
            horizon=body.horizon,
            model_used=result["model_used"],
            result=result,
        )

        if history_rows:
            background_tasks.add_task(_bulk_upsert_background, history_rows)

        results.append(_result_dict_to_response(result))

    return results


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------


def _result_dict_to_response(result: dict) -> ForecastResponse:
    """Convert a pipeline result dict to a ForecastResponse Pydantic model."""
    return ForecastResponse(
        series_name=result["series_name"],
        region=result.get("region", "national"),
        generated_at=result["generated_at"],
        model_used=result["model_used"],
        horizon=result["horizon"],
        forecast=[ForecastPoint(**p) for p in result["forecast"]],
        scenarios=[ScenarioPoint(**s) for s in result["scenarios"]],
    )


def _forecast_record_to_response(record) -> ForecastResponse:
    """Convert a MarketForecast ORM record to a ForecastResponse."""
    data = json.loads(record.result_json)
    return ForecastResponse(
        series_name=record.series_name,
        region=record.region,
        generated_at=record.generated_at.isoformat(),
        model_used=record.model_used,
        horizon=record.horizon,
        forecast=[ForecastPoint(**p) for p in data.get("forecast", [])],
        scenarios=[ScenarioPoint(**s) for s in data.get("scenarios", [])],
    )


async def _bulk_upsert_background(history_rows: list[dict]) -> None:
    """Background task: upsert history rows using a fresh DB session."""
    from app.persistence.db import AsyncSessionLocal

    async with AsyncSessionLocal() as session:
        repo = MarketPriceRepository(session)
        await repo.bulk_upsert_history(history_rows)
