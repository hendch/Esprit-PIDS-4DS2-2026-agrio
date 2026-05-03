"""Walk-forward backtester for produce price forecasting models.

Performs a time-series cross-validation using an expanding window:

    Train on [0 … t]  →  Forecast [t+1 … t+horizon]

The window expands by *step* weeks each fold.  Only folds where *actual*
values exist are scored; NaN-only folds (citrus off-season) are skipped.

Usage
-----
>>> from app.modules.produce_prices.evaluation.backtester import ProduceBacktester
>>> from app.modules.produce_prices.models.baseline import SeasonalNaiveForecaster
>>> bt = ProduceBacktester(horizon=12, step=4, min_train=104)
>>> results = bt.run(price_series, SeasonalNaiveForecaster())
>>> print(results["summary"])
"""
from __future__ import annotations

import logging
from typing import Protocol

import numpy as np
import pandas as pd

from app.modules.produce_prices.evaluation.metrics import evaluate

logger = logging.getLogger(__name__)


class _Forecaster(Protocol):
    """Minimal interface expected from forecasting models."""

    def fit(self, y: pd.Series) -> "_Forecaster":
        ...

    def predict(self, horizon: int, last_date: pd.Timestamp) -> pd.DataFrame:
        ...


class ProduceBacktester:
    """Walk-forward backtester for weekly produce price models.

    Parameters
    ----------
    horizon : int, default 12
        Number of weeks ahead to forecast per fold.
    step : int, default 4
        Number of weeks to advance the training window each fold.
    min_train : int, default 104
        Minimum training observations (weeks) required before the first fold.
        Defaults to 2 years of weekly data.
    """

    def __init__(
        self,
        horizon: int = 12,
        step: int = 4,
        min_train: int = 104,
    ) -> None:
        self.horizon = horizon
        self.step = step
        self.min_train = min_train

    def run(
        self,
        series: pd.Series,
        model: _Forecaster,
    ) -> dict:
        """Run the backtest and return per-fold results plus a summary.

        Parameters
        ----------
        series : pd.Series
            Weekly price series with a ``DatetimeIndex``.
            NaN gaps (off-season) are allowed; folds with all-NaN actuals
            are skipped silently.
        model : _Forecaster
            Any model with ``fit(y)`` and ``predict(horizon, last_date)``
            methods matching the baseline interface.

        Returns
        -------
        dict with keys:
            ``folds``   — list of per-fold dicts (dates, forecasts, actuals, metrics)
            ``summary`` — dict of mean metrics across all scored folds
        """
        y = series.dropna().sort_index()
        n = len(y)

        if n < self.min_train + self.horizon:
            logger.warning(
                "Series too short for backtesting: %d observations, need ≥ %d",
                n,
                self.min_train + self.horizon,
            )
            return {"folds": [], "summary": {}}

        folds = []
        t = self.min_train

        while t + self.horizon <= n:
            train = y.iloc[:t]
            test = y.iloc[t : t + self.horizon]

            # Skip folds where test is entirely NaN
            if test.isna().all():
                t += self.step
                continue

            last_date = train.index[-1]

            try:
                model.fit(train)
                fc_df = model.predict(horizon=self.horizon, last_date=last_date)
            except Exception as exc:
                logger.warning("Fold at t=%d failed: %s", t, exc)
                t += self.step
                continue

            actual_vals = test.values
            forecast_vals = fc_df["forecast"].values[: len(actual_vals)]
            lower_80 = fc_df.get("lower_80", pd.Series(dtype=float)).values[: len(actual_vals)]
            upper_80 = fc_df.get("upper_80", pd.Series(dtype=float)).values[: len(actual_vals)]
            lower_95 = fc_df.get("lower_95", pd.Series(dtype=float)).values[: len(actual_vals)]
            upper_95 = fc_df.get("upper_95", pd.Series(dtype=float)).values[: len(actual_vals)]

            fold_metrics = evaluate(
                actual_vals,
                forecast_vals,
                lower_80=lower_80 if len(lower_80) else None,
                upper_80=upper_80 if len(upper_80) else None,
                lower_95=lower_95 if len(lower_95) else None,
                upper_95=upper_95 if len(upper_95) else None,
            )

            folds.append({
                "train_end": last_date,
                "test_start": test.index[0],
                "test_end": test.index[-1],
                "forecast_df": fc_df,
                "actual": test,
                "metrics": fold_metrics,
            })

            logger.debug(
                "Fold t=%d: MAE=%.1f RMSE=%.1f MAPE=%.1f%%",
                t,
                fold_metrics.get("mae", float("nan")),
                fold_metrics.get("rmse", float("nan")),
                fold_metrics.get("mape", float("nan")),
            )

            t += self.step

        if not folds:
            return {"folds": [], "summary": {}}

        # Aggregate metrics
        metric_keys = list(folds[0]["metrics"].keys())
        summary = {}
        for key in metric_keys:
            vals = [f["metrics"][key] for f in folds if not np.isnan(f["metrics"].get(key, float("nan")))]
            summary[key] = float(np.mean(vals)) if vals else float("nan")

        logger.info(
            "Backtest complete: %d folds | mean MAE=%.1f | mean MAPE=%.1f%%",
            len(folds),
            summary.get("mae", float("nan")),
            summary.get("mape", float("nan")),
        )

        return {"folds": folds, "summary": summary}
