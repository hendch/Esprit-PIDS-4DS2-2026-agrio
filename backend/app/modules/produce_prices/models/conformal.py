"""ConformalPredictor — split-conformal prediction intervals for weekly produce prices.

Adapted from ``market_prices/models/conformal.py`` for weekly (W-MON) produce
data.  Uses a seasonal-naive in-sample baseline with a 52-week seasonal period
instead of 12 months.

    nonconformity score_i = |log y_i - log y_{i-52}|   (log_transform=True)
                          = |y_i - y_{i-52}|            (log_transform=False)

Usage
-----
>>> cp = ProduceConformalPredictor()
>>> cp.fit(historical_series)          # pd.Series with weekly DatetimeIndex
>>> df = cp.predict_with_intervals(horizon=12, last_date=series.index[-1])
"""
from __future__ import annotations

from typing import List

import numpy as np
import pandas as pd


class ProduceConformalPredictor:
    """Split-conformal prediction intervals calibrated on a single weekly price series.

    Parameters
    ----------
    significance_levels : list of float, default [0.05, 0.20]
        ``0.05`` → 95 % interval, ``0.20`` → 80 % interval.
    log_transform : bool, default True
        Compute scores in log space for multiplicative seasonal series.
    """

    def __init__(
        self,
        significance_levels: List[float] | None = None,
        log_transform: bool = True,
    ) -> None:
        self._significance_levels: List[float] = (
            significance_levels if significance_levels is not None else [0.05, 0.20]
        )
        self._log_transform = log_transform
        self._quantiles: dict[float, float] = {}
        self._y: pd.Series | None = None
        self._fitted = False

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def fit(self, y: pd.Series) -> "ProduceConformalPredictor":
        """Calibrate nonconformity quantiles from a weekly price series.

        Uses the seasonal-naive baseline with a 52-week lag so at least one
        full year of calibration scores can be computed.

        Parameters
        ----------
        y : pd.Series
            Weekly price series with a ``DatetimeIndex``.  Must contain at
            least 53 non-NaN observations.

        Returns
        -------
        self

        Raises
        ------
        ValueError
            If fewer than 53 observations are present.
        """
        y_valid = y.dropna()
        if len(y_valid) < 53:
            raise ValueError(
                "ProduceConformalPredictor.fit() requires at least 53 non-NaN "
                f"observations; got {len(y_valid)}."
            )

        self._y = y.copy()

        lag52 = y.shift(52).dropna()
        actuals = y.loc[lag52.index].dropna()
        lag52 = lag52.loc[actuals.index]

        if self._log_transform:
            log_act = np.log(np.maximum(actuals.values, 1e-9))
            log_fc = np.log(np.maximum(lag52.values, 1e-9))
            scores = np.abs(log_act - log_fc)
        else:
            scores = np.abs(actuals.values - lag52.values)

        self._quantiles = {
            alpha: float(np.quantile(scores, 1.0 - alpha))
            for alpha in self._significance_levels
        }
        self._fitted = True
        return self

    def predict_with_intervals(
        self, horizon: int, last_date: pd.Timestamp
    ) -> pd.DataFrame:
        """Generate conformal prediction intervals for future weeks.

        Parameters
        ----------
        horizon : int
            Number of weekly steps to forecast.
        last_date : pd.Timestamp
            Last date of the observed series.

        Returns
        -------
        pd.DataFrame
            Columns: ``date``, ``forecast``, ``lower_80``, ``upper_80``,
            ``lower_95``, ``upper_95``.

        Raises
        ------
        RuntimeError
            If called before :meth:`fit`.
        """
        if not self._fitted:
            raise RuntimeError(
                "ProduceConformalPredictor must be fitted before predicting."
            )
        if horizon < 1:
            raise ValueError(f"horizon must be ≥ 1, got {horizon}")

        future_dates = pd.date_range(
            start=last_date + pd.DateOffset(weeks=1),
            periods=horizon,
            freq="W-MON",
        )

        point_forecasts = np.array([
            self._seasonal_naive_forecast(dt) for dt in future_dates
        ], dtype=float)

        interval_cols: dict[str, np.ndarray] = {}
        for alpha, q in self._quantiles.items():
            if self._log_transform:
                log_fc = np.log(np.maximum(point_forecasts, 1e-9))
                lower = np.exp(log_fc - q)
                upper = np.exp(log_fc + q)
            else:
                lower = point_forecasts - q
                upper = point_forecasts + q

            lower = np.maximum(lower, 0.0)

            coverage = round((1.0 - alpha) * 100)
            interval_cols[f"lower_{coverage}"] = lower
            interval_cols[f"upper_{coverage}"] = upper

        df = pd.DataFrame({
            "date": future_dates,
            "forecast": point_forecasts,
            "lower_80": interval_cols.get("lower_80", np.zeros(horizon)),
            "upper_80": interval_cols.get("upper_80", np.zeros(horizon)),
            "lower_95": interval_cols.get("lower_95", np.zeros(horizon)),
            "upper_95": interval_cols.get("upper_95", np.zeros(horizon)),
        })
        return df

    @property
    def quantiles(self) -> dict[float, float]:
        """Calibrated nonconformity quantiles, keyed by significance level."""
        return self._quantiles

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _seasonal_naive_forecast(self, target_date: pd.Timestamp) -> float:
        """Return the last observed value for the same ISO week as *target_date*."""
        assert self._y is not None
        target_week = target_date.isocalendar()[1]
        week_series = self._y.dropna()
        week_vals = week_series[week_series.index.isocalendar().week == target_week]
        if len(week_vals) > 0:
            return float(week_vals.iloc[-1])
        return float(week_series.iloc[-1])
