"""ConformalPredictor — split-conformal prediction intervals for price series.

The predictor is calibrated on a single historical series using a seasonal-
naive in-sample baseline:

    nonconformity score_i = |log y_i - log y_{i-12}|   (log_transform=True)
                          = |y_i - y_{i-12}|            (log_transform=False)

for all i ≥ 12.  The empirical (1-α)-quantile of these scores gives the
conformal margin for the α-coverage interval:

    lower = exp(log ŷ - q_α)   upper = exp(log ŷ + q_α)   [log space]
    lower = ŷ - q_α            upper = ŷ + q_α              [linear space]

All lower bounds are clipped at 0 so price forecasts stay non-negative.

Usage
-----
>>> cp = ConformalPredictor()
>>> cp.fit(historical_series)          # pd.Series with monthly DatetimeIndex
>>> df = cp.predict_with_intervals(horizon=12, last_date=series.index[-1])
"""
from __future__ import annotations

from typing import List

import numpy as np
import pandas as pd


class ConformalPredictor:
    """Split-conformal prediction intervals calibrated on a single price series.

    Parameters
    ----------
    significance_levels : list of float, default [0.05, 0.20]
        Each alpha produces a ``(1-alpha)*100 %`` prediction interval.
        ``0.05`` → 95 % interval (columns ``lower_95`` / ``upper_95``).
        ``0.20`` → 80 % interval (columns ``lower_80`` / ``upper_80``).
    log_transform : bool, default True
        When ``True``, nonconformity scores are computed and intervals are
        constructed in log space, ensuring intervals scale proportionally
        with price level and lower bounds are always positive before clipping.
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

    def fit(self, y: pd.Series) -> "ConformalPredictor":
        """Calibrate nonconformity quantiles from the historical series.

        Uses a seasonal-naive in-sample baseline: the "forecast" for
        observation i is observation i-12 (same month last year).
        Only observations with a valid lag-12 predecessor are used
        (i.e. the first 12 rows are skipped).

        Parameters
        ----------
        y : pd.Series
            Monthly price series with a ``DatetimeIndex``.  Must contain
            at least 13 observations so that at least one calibration
            score can be computed.

        Returns
        -------
        self

        Raises
        ------
        ValueError
            If ``y`` contains fewer than 13 observations.
        """
        if len(y) < 13:
            raise ValueError(
                "ConformalPredictor.fit() requires at least 13 observations "
                f"to compute calibration scores; got {len(y)}."
            )

        self._y = y.copy()

        # In-sample seasonal-naive baseline: ŷ_i = y_{i-12}
        lag12 = y.shift(12).dropna()
        actuals = y.loc[lag12.index]

        if self._log_transform:
            log_act = np.log(np.maximum(actuals.values, 1e-9))
            log_fc = np.log(np.maximum(lag12.values, 1e-9))
            scores = np.abs(log_act - log_fc)
        else:
            scores = np.abs(actuals.values - lag12.values)

        self._quantiles = {
            alpha: float(np.quantile(scores, 1.0 - alpha))
            for alpha in self._significance_levels
        }
        self._fitted = True
        return self

    def predict_with_intervals(
        self, horizon: int, last_date: pd.Timestamp
    ) -> pd.DataFrame:
        """Generate conformal prediction intervals for future months.

        The point forecast for each future month is the last observed value
        for that calendar month in the calibration series (seasonal-naive).

        Parameters
        ----------
        horizon : int
            Number of monthly steps to forecast.
        last_date : pd.Timestamp
            The last date of the observed series.  Forecasts start at
            ``last_date + 1 month``.

        Returns
        -------
        pd.DataFrame
            Columns: ``date``, ``forecast``, ``lower_80``, ``upper_80``,
            ``lower_95``, ``upper_95``.  Rows are sorted by date ascending.

        Raises
        ------
        RuntimeError
            If called before :meth:`fit`.
        ValueError
            If ``horizon`` is less than 1.
        """
        if not self._fitted:
            raise RuntimeError(
                "ConformalPredictor must be fitted before predicting. "
                "Call fit() first."
            )
        if horizon < 1:
            raise ValueError(f"horizon must be ≥ 1, got {horizon}")

        future_dates = pd.date_range(
            start=last_date + pd.DateOffset(months=1),
            periods=horizon,
            freq="MS",
        )

        # Point forecasts: last observed value for each calendar month
        point_forecasts = np.array([
            self._seasonal_naive_forecast(dt.month) for dt in future_dates
        ], dtype=float)

        # Build interval columns
        interval_cols: dict[str, np.ndarray] = {}
        for alpha, q in self._quantiles.items():
            if self._log_transform:
                log_fc = np.log(np.maximum(point_forecasts, 1e-9))
                lower = np.exp(log_fc - q)
                upper = np.exp(log_fc + q)
            else:
                lower = point_forecasts - q
                upper = point_forecasts + q

            lower = np.maximum(lower, 0.0)  # prices can never be negative

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

    # ------------------------------------------------------------------
    # Properties
    # ------------------------------------------------------------------

    @property
    def quantiles(self) -> dict[float, float]:
        """Calibrated nonconformity quantiles, keyed by significance level."""
        return self._quantiles

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _seasonal_naive_forecast(self, target_month: int) -> float:
        """Return the last observed price for *target_month* in the stored series."""
        assert self._y is not None
        month_vals = self._y[self._y.index.month == target_month]
        if len(month_vals) > 0:
            return float(month_vals.iloc[-1])
        # Fallback: use the overall last value
        return float(self._y.iloc[-1])
