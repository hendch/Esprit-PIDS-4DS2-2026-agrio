"""ProducePriceRepository — async DB access for produce price history and forecast cache."""
from __future__ import annotations

from datetime import date
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.produce_prices.db_models import ProducePriceForecast, ProducePriceHistory


class ProducePriceRepository:
    """Async repository for produce price history and forecast records.

    Parameters
    ----------
    session : AsyncSession
        SQLAlchemy async session injected by the FastAPI DI layer.
    """

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    # ------------------------------------------------------------------
    # Forecast cache
    # ------------------------------------------------------------------

    async def save_forecast(
        self,
        result_dict: dict[str, Any],
    ) -> ProducePriceForecast:
        """Persist a forecast, marking all previous forecasts for this product as not latest.

        Parameters
        ----------
        result_dict : dict
            Must contain at minimum: ``product``, ``category``, ``model_used``,
            ``horizon_weeks``.  Optional keys: ``forecast_json``, ``scenarios_json``,
            ``backtest_metrics``, ``best_mape``, ``best_mase``, ``warnings``.

        Returns
        -------
        ProducePriceForecast
        """
        product = result_dict["product"]

        # Mark all existing forecasts for this product as not latest
        await self._session.execute(
            update(ProducePriceForecast)
            .where(
                ProducePriceForecast.product == product,
                ProducePriceForecast.is_latest.is_(True),
            )
            .values(is_latest=False)
        )

        record = ProducePriceForecast(
            product=product,
            category=result_dict.get("category", ""),
            model_used=result_dict.get("model_used", ""),
            horizon_weeks=result_dict.get("horizon_weeks", 0),
            forecast_json=result_dict.get("forecast_json"),
            scenarios_json=result_dict.get("scenarios_json"),
            backtest_metrics=result_dict.get("backtest_metrics"),
            best_mape=result_dict.get("best_mape"),
            best_mase=result_dict.get("best_mase"),
            warnings=result_dict.get("warnings"),
            is_latest=True,
        )
        self._session.add(record)
        await self._session.commit()
        await self._session.refresh(record)
        return record

    async def get_latest_forecast(
        self, product: str
    ) -> ProducePriceForecast | None:
        """Return the most recent forecast for *product*, or None."""
        stmt = (
            select(ProducePriceForecast)
            .where(
                ProducePriceForecast.product == product,
                ProducePriceForecast.is_latest.is_(True),
            )
            .order_by(ProducePriceForecast.generated_at.desc())
            .limit(1)
        )
        result = await self._session.execute(stmt)
        return result.scalar_one_or_none()

    async def get_forecast_history(
        self, product: str, limit: int = 10
    ) -> list[ProducePriceForecast]:
        """Return the last *limit* forecasts for *product*, newest first."""
        stmt = (
            select(ProducePriceForecast)
            .where(ProducePriceForecast.product == product)
            .order_by(ProducePriceForecast.generated_at.desc())
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        return list(result.scalars().all())

    # ------------------------------------------------------------------
    # Price history
    # ------------------------------------------------------------------

    async def bulk_upsert_history(
        self,
        records: list[dict[str, Any]],
    ) -> int:
        """Insert or update price history rows (upsert on product + price_date).

        Parameters
        ----------
        records : list of dict
            Each dict must have: ``product``, ``category``, ``price_date`` (date),
            ``retail_mid``, ``wholesale_mid``.  Optional: ``qte``, ``unit``.

        Returns
        -------
        int
            Number of rows processed.
        """
        if not records:
            return 0

        stmt = pg_insert(ProducePriceHistory).values(records)
        stmt = stmt.on_conflict_do_update(
            constraint="uq_produce_product_date",
            set_={
                "retail_mid": stmt.excluded.retail_mid,
                "wholesale_mid": stmt.excluded.wholesale_mid,
                "qte": stmt.excluded.qte,
            },
        )
        await self._session.execute(stmt)
        await self._session.commit()
        return len(records)

    async def get_price_history(
        self,
        product: str,
        start_date: date | None = None,
        end_date: date | None = None,
    ) -> list[ProducePriceHistory]:
        """Return price history rows for *product*, ordered by date ascending.

        Parameters
        ----------
        product : str
            Internal product key (e.g. ``'clementine'``).
        start_date : date or None
            Inclusive lower bound on ``price_date``.
        end_date : date or None
            Inclusive upper bound on ``price_date``.
        """
        stmt = (
            select(ProducePriceHistory)
            .where(ProducePriceHistory.product == product)
            .order_by(ProducePriceHistory.price_date.asc())
        )
        if start_date is not None:
            stmt = stmt.where(ProducePriceHistory.price_date >= start_date)
        if end_date is not None:
            stmt = stmt.where(ProducePriceHistory.price_date <= end_date)

        result = await self._session.execute(stmt)
        return list(result.scalars().all())
