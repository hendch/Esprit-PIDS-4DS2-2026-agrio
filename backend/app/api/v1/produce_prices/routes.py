"""Produce-prices API routes.

Endpoints
---------
GET  /products                          — summary info for all 8 produce products
GET  /products/{product}/history        — weekly price history from DB
POST /forecast                          — run or return cached forecast
GET  /forecast/{product}/latest         — most recent stored forecast
POST /forecast/batch                    — run forecasts for multiple products
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timezone
from typing import Annotated, Any

from app.middleware.auth import get_current_user
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.produce_prices.db_models import ProducePriceHistory
from app.modules.produce_prices.repository import ProducePriceRepository
from app.persistence.db import get_async_session

from .schemas import (
    ProduceBatchRequest,
    ProduceForecastRequest,
    ProduceHistoryPoint,
    ProductInfo,
)

router = APIRouter()
logger = logging.getLogger(__name__)

DbSession = Annotated[AsyncSession, Depends(get_async_session)]

# ---------------------------------------------------------------------------
# Product catalogue
# ---------------------------------------------------------------------------

VALID_PRODUCTS = [
    "clementine", "maltaise", "thomson", "pommes",
    "oignon", "piment_doux", "piment_piquant", "pomme_de_terre",
]

DISPLAY_NAMES: dict[str, str] = {
    "clementine": "Cl\u00e9mentine",
    "maltaise": "Maltaise",
    "thomson": "Thomson",
    "pommes": "Pommes",
    "oignon": "Oignon",
    "piment_doux": "Piment doux",
    "piment_piquant": "Piment piquant",
    "pomme_de_terre": "Pomme de terre",
}

CATEGORIES: dict[str, str] = {
    "clementine": "fruit",
    "maltaise": "fruit",
    "thomson": "fruit",
    "pommes": "fruit",
    "oignon": "legume",
    "piment_doux": "legume",
    "piment_piquant": "legume",
    "pomme_de_terre": "legume",
}

_VALID_SET = set(VALID_PRODUCTS)


def _check_product(product: str) -> None:
    if product not in _VALID_SET:
        raise HTTPException(
            status_code=404,
            detail=f"Product '{product}' not found. Valid options: {VALID_PRODUCTS}",
        )


def _serialize_result(result: dict[str, Any]) -> dict[str, Any]:
    """Recursively convert Timestamps / dates / numpy scalars to JSON-safe types."""
    import numpy as np
    import pandas as pd

    def _convert(obj: Any) -> Any:
        if isinstance(obj, (pd.Timestamp, datetime)):
            return obj.isoformat()
        if isinstance(obj, date):
            return obj.strftime("%Y-%m-%d")
        if isinstance(obj, (np.integer,)):
            return int(obj)
        if isinstance(obj, (np.floating,)):
            return float(obj)
        if isinstance(obj, dict):
            return {k: _convert(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [_convert(v) for v in obj]
        return obj

    return _convert(result)


# ---------------------------------------------------------------------------
# GET /products
# ---------------------------------------------------------------------------


@router.get("/products", response_model=list[ProductInfo])
async def list_products(db: DbSession, _: dict = Depends(get_current_user)) -> list[ProductInfo]:
    """Return summary information for every produce product.

    Fetches the most recent price row and total week count from the DB
    for each of the 8 products.
    """
    result: list[ProductInfo] = []

    for product in VALID_PRODUCTS:
        # Count total non-null rows in DB
        count_stmt = select(func.count()).where(
            ProducePriceHistory.product == product
        )
        count_res = await db.execute(count_stmt)
        weeks_count = count_res.scalar() or 0

        # Fetch most recent row
        latest_stmt = (
            select(ProducePriceHistory)
            .where(ProducePriceHistory.product == product)
            .order_by(ProducePriceHistory.price_date.desc())
            .limit(1)
        )
        latest_res = await db.execute(latest_stmt)
        latest_row = latest_res.scalar_one_or_none()

        result.append(
            ProductInfo(
                product=product,
                category=CATEGORIES[product],
                display_name=DISPLAY_NAMES[product],
                unit="millimes/kg",
                latest_date=latest_row.price_date.strftime("%Y-%m-%d") if latest_row else None,
                latest_retail_price=round(latest_row.retail_mid, 2) if latest_row else None,
                latest_wholesale_price=round(latest_row.wholesale_mid, 2) if latest_row else None,
                weeks_of_data=weeks_count,
            )
        )

    return result


# ---------------------------------------------------------------------------
# GET /products/{product}/history
# ---------------------------------------------------------------------------


@router.get("/products/{product}/history", response_model=list[ProduceHistoryPoint])
async def get_product_history(
    product: str,
    db: DbSession,
    start: str | None = None,
    end: str | None = None,
    _: dict = Depends(get_current_user),
) -> list[ProduceHistoryPoint]:
    """Return weekly price history for *product* from the database.

    Query parameters
    ----------------
    start : str, optional
        Inclusive start date ``YYYY-MM-DD``.
    end : str, optional
        Inclusive end date ``YYYY-MM-DD``.
    """
    _check_product(product)

    start_date: date | None = None
    end_date: date | None = None

    if start is not None:
        try:
            start_date = datetime.strptime(start, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(
                status_code=422,
                detail=f"Invalid start format '{start}'. Use YYYY-MM-DD.",
            )

    if end is not None:
        try:
            end_date = datetime.strptime(end, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(
                status_code=422,
                detail=f"Invalid end format '{end}'. Use YYYY-MM-DD.",
            )

    repo = ProducePriceRepository(db)
    rows = await repo.get_price_history(product, start_date=start_date, end_date=end_date)

    return [
        ProduceHistoryPoint(
            date=row.price_date.strftime("%Y-%m-%d"),
            retail_mid=round(row.retail_mid, 2),
            wholesale_mid=round(row.wholesale_mid, 2),
            qte=round(row.qte, 3) if row.qte is not None else None,
        )
        for row in rows
    ]


# ---------------------------------------------------------------------------
# POST /forecast
# ---------------------------------------------------------------------------


@router.post("/forecast")
async def create_forecast(body: ProduceForecastRequest, db: DbSession, _: dict = Depends(get_current_user)) -> dict:
    """Run a price forecast or return the cached latest result.

    If ``force_refresh=False`` and a forecast was already generated today
    for this product, the cached result is returned immediately.
    """
    _check_product(body.product)

    repo = ProducePriceRepository(db)

    # Return cached forecast if available and generated today
    if not body.force_refresh:
        cached = await repo.get_latest_forecast(body.product)
        if cached is not None:
            generated_day = cached.generated_at.date()
            today = datetime.now(tz=timezone.utc).date()
            if generated_day == today:
                return {
                    "product": cached.product,
                    "category": cached.category,
                    "best_model_name": cached.model_used,
                    "forecast": cached.forecast_json or [],
                    "scenarios": cached.scenarios_json or [],
                    "backtest_metrics": cached.backtest_metrics or {},
                    "best_mape": cached.best_mape,
                    "best_mase": cached.best_mase,
                    "warnings": cached.warnings or [],
                    "generated_at": cached.generated_at.isoformat(),
                    "horizon_weeks": cached.horizon_weeks,
                    "cached": True,
                }

    # Run pipeline
    try:
        from app.modules.produce_prices.pipeline import ProducePricePipeline

        pipeline = ProducePricePipeline(horizon=body.horizon)
        result = pipeline.run(body.product)
    except (ValueError, RuntimeError) as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        logger.exception("Pipeline failed for product '%s'", body.product)
        raise HTTPException(status_code=500, detail=f"Forecast pipeline error: {exc}")

    # Serialize all dates/timestamps before saving and returning
    result = _serialize_result(result)

    # Compute summary metrics
    bm = result.get("backtest_metrics", {})
    best_mape = min(
        (v.get("mape", float("inf")) for v in bm.values()),
        default=None,
    )
    best_mase = min(
        (v.get("mase", float("inf")) for v in bm.values()),
        default=None,
    )

    # Save to DB
    await repo.save_forecast({
        "product": body.product,
        "category": CATEGORIES[body.product],
        "model_used": result["best_model_name"],
        "horizon_weeks": body.horizon,
        "forecast_json": result.get("forecast"),
        "scenarios_json": result.get("scenarios"),
        "backtest_metrics": result.get("backtest_metrics"),
        "best_mape": best_mape if best_mape != float("inf") else None,
        "best_mase": best_mase if best_mase != float("inf") else None,
        "warnings": result.get("warnings"),
    })

    return {
        **result,
        "product": body.product,
        "category": CATEGORIES[body.product],
        "horizon_weeks": body.horizon,
        "generated_at": datetime.now(tz=timezone.utc).isoformat(),
        "cached": False,
    }


# ---------------------------------------------------------------------------
# GET /forecast/{product}/latest
# ---------------------------------------------------------------------------


@router.get("/forecast/{product}/latest")
async def get_latest_forecast(product: str, db: DbSession, _: dict = Depends(get_current_user)) -> dict:
    """Return the most recently stored forecast for *product*.

    Raises 404 if no forecast has ever been generated for this product.
    """
    _check_product(product)

    repo = ProducePriceRepository(db)
    record = await repo.get_latest_forecast(product)

    if record is None:
        raise HTTPException(
            status_code=404,
            detail=f"No forecast found for '{product}'. Run POST /forecast first.",
        )

    return {
        "product": record.product,
        "category": record.category,
        "best_model_name": record.model_used,
        "forecast": record.forecast_json or [],
        "scenarios": record.scenarios_json or [],
        "backtest_metrics": record.backtest_metrics or {},
        "best_mape": record.best_mape,
        "best_mase": record.best_mase,
        "warnings": record.warnings or [],
        "generated_at": record.generated_at.isoformat(),
        "horizon_weeks": record.horizon_weeks,
    }


# ---------------------------------------------------------------------------
# POST /forecast/batch
# ---------------------------------------------------------------------------


@router.post("/forecast/batch")
async def batch_forecast(body: ProduceBatchRequest, db: DbSession, _: dict = Depends(get_current_user)) -> list[dict]:
    """Run the forecast pipeline for multiple products sequentially.

    Raises 404 if any product in the list is invalid.
    """
    for p in body.products:
        _check_product(p)

    from app.modules.produce_prices.pipeline import ProducePricePipeline

    repo = ProducePriceRepository(db)
    pipeline = ProducePricePipeline(horizon=body.horizon)
    results: list[dict] = []

    for product in body.products:
        try:
            result = pipeline.run(product)
            result = _serialize_result(result)

            bm = result.get("backtest_metrics", {})
            best_mape = min(
                (v.get("mape", float("inf")) for v in bm.values()), default=None
            )
            best_mase = min(
                (v.get("mase", float("inf")) for v in bm.values()), default=None
            )

            await repo.save_forecast({
                "product": product,
                "category": CATEGORIES[product],
                "model_used": result["best_model_name"],
                "horizon_weeks": body.horizon,
                "forecast_json": result.get("forecast"),
                "scenarios_json": result.get("scenarios"),
                "backtest_metrics": result.get("backtest_metrics"),
                "best_mape": best_mape if best_mape != float("inf") else None,
                "best_mase": best_mase if best_mase != float("inf") else None,
                "warnings": result.get("warnings"),
            })

            results.append({
                **result,
                "product": product,
                "category": CATEGORIES[product],
                "horizon_weeks": body.horizon,
                "generated_at": datetime.now(tz=timezone.utc).isoformat(),
            })

        except Exception as exc:
            logger.warning("batch_forecast: pipeline failed for '%s': %s", product, exc)
            results.append({
                "product": product,
                "error": str(exc),
            })

    return results
