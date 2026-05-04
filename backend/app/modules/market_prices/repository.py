"""MarketPriceRepository — async DB access for price history and forecast cache."""
from __future__ import annotations

import json
from datetime import date, datetime, timezone
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.market_prices.db_models import MarketForecast, MarketPriceHistory


class MarketPriceRepository:
    """Async repository for market price history and forecast records.

    Parameters
    ----------
    session : AsyncSession
        SQLAlchemy async session injected by the FastAPI DI layer.
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    # ------------------------------------------------------------------
    # Price history
    # ------------------------------------------------------------------

    async def get_price_history(
        self,
        series_name: str,
        region: str = "national",
        start: date | None = None,
        end: date | None = None,
    ) -> list[MarketPriceHistory]:
        """Return price history rows ordered by date ascending.

        Parameters
        ----------
        series_name : str
            Series identifier (e.g. ``'brebis_suitees'``).
        region : str, default ``'national'``
            Region filter. Use ``'national'`` for the national average.
        start : date or None
            Inclusive lower bound on ``price_date``.
        end : date or None
            Inclusive upper bound on ``price_date``.
        """
        stmt = (
            select(MarketPriceHistory)
            .where(
                MarketPriceHistory.series_name == series_name,
                MarketPriceHistory.region == region,
            )
            .order_by(MarketPriceHistory.price_date.asc())
        )
        if start is not None:
            stmt = stmt.where(MarketPriceHistory.price_date >= start)
        if end is not None:
            stmt = stmt.where(MarketPriceHistory.price_date <= end)

        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    async def bulk_upsert_history(
        self,
        rows: list[dict[str, Any]],
    ) -> int:
        """Insert or update price history rows (upsert on series+region+date).

        Parameters
        ----------
        rows : list of dict
            Each dict must have keys: ``series_name``, ``region``,
            ``price_date`` (``date``), ``price`` (``float``).

        Returns
        -------
        int
            Number of rows inserted or updated.
        """
        if not rows:
            return 0

        stmt = pg_insert(MarketPriceHistory).values(rows)
        stmt = stmt.on_conflict_do_update(
            constraint="uq_series_region_date",
            set_={"price": stmt.excluded.price},
        )
        await self._session.execute(stmt)
        await self._session.commit()
        return len(rows)

    # ------------------------------------------------------------------
    # Forecast cache
    # ------------------------------------------------------------------

    async def get_latest_forecast(
        self, series_name: str, region: str = "national"
    ) -> MarketForecast | None:
        """Return the most recently generated forecast for *series_name* + *region*.

        Returns ``None`` if no forecast has ever been saved.
        """
        stmt = (
            select(MarketForecast)
            .where(
                MarketForecast.series_name == series_name,
                MarketForecast.region == region,
            )
            .order_by(MarketForecast.generated_date.desc())
            .limit(1)
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_forecast_generated_today(
        self, series_name: str, region: str = "national"
    ) -> MarketForecast | None:
        """Return today's cached forecast for *series_name* + *region*, or ``None``."""
        today = datetime.now(tz=timezone.utc).date()
        stmt = (
            select(MarketForecast)
            .where(
                MarketForecast.series_name == series_name,
                MarketForecast.region == region,
                MarketForecast.generated_date == today,
            )
            .limit(1)
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def save_forecast(
        self,
        series_name: str,
        horizon: int,
        model_used: str,
        result: dict[str, Any],
        region: str = "national",
    ) -> MarketForecast:
        """Persist a forecast result, replacing any existing one for today.

        Each (series_name, region) pair is cached independently, so national
        and regional forecasts coexist as separate rows.

        Parameters
        ----------
        series_name : str
            Series identifier.
        horizon : int
            Number of months forecast.
        model_used : str
            Model name (e.g. ``'sarima'``, ``'seasonal_naive'``).
        result : dict
            Full forecast dict from ``ForecastPipeline.run()``.
        region : str, default ``'national'``
            Region the forecast was produced for.

        Returns
        -------
        MarketForecast
            The persisted ORM object.
        """
        today = datetime.now(tz=timezone.utc).date()

        # Delete any existing forecast for this series+region today (replace semantics)
        await self._session.execute(
            delete(MarketForecast).where(
                MarketForecast.series_name == series_name,
                MarketForecast.region == region,
                MarketForecast.generated_date == today,
            )
        )

        record = MarketForecast(
            series_name=series_name,
            region=region,
            horizon=horizon,
            model_used=model_used,
            generated_date=today,
            result_json=json.dumps(result, default=str),
        )
        self._session.add(record)
        await self._session.commit()
        await self._session.refresh(record)
        return record
