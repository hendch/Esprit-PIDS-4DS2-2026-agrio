"""Baseline forecasters for Tunisian produce price series (weekly frequency).

Three simple forecasters with a shared interface, adapted for weekly (W-MON)
data from the monthly ``market_prices`` baseline.

``NaiveForecaster``
    Forecast = last observed value.

``SeasonalNaiveForecaster``
    Forecast = value from the same calendar week one year ago (52-week lag).
    Strongest baseline for seasonal produce prices.

``DriftForecaster``
    Forecast = last value + average weekly change × h.

Usage
-----
>>> from app.modules.produce_prices.models.baseline import SeasonalNaiveForecaster
>>> model = SeasonalNaiveForecaster()
>>> model.fit(price_series)
>>> forecast_df = model.predict(horizon=12, last_date=price_series.index[-1])
"""
from __future__ import annotations

import math
from abc import ABC, abstractmethod

import numpy as np
import pandas as pd

_Z80 = 1.281551565545
_Z95 = 1.959963984540


def _make_forecast_df(
    dates: pd.DatetimeIndex,
    point: np.ndarray,
    sigma: float | np.ndarray,
) -> pd.DataFrame:
    """Build the standard weekly forecast DataFrame with PI columns."""
    sigma = np.asarray(sigma, dtype=float)
    if sigma.ndim == 0:
        sigma = np.full(len(dates), float(sigma))

    return pd.DataFrame(
        {
            "date": dates,
            "forecast": point,
            "lower_80": point - _Z80 * sigma,
            "upper_80": point + _Z80 * sigma,
            "lower_95": point - _Z95 * sigma,
            "upper_95": point + _Z95 * sigma,
        }
    )


def _future_weekly_dates(last_date: pd.Timestamp, horizon: int) -> pd.DatetimeIndex:
    """Return *horizon* weekly (W-MON) timestamps starting after *last_date*."""
    return pd.date_range(
        start=last_date + pd.DateOffset(weeks=1),
        periods=horizon,
        freq="W-MON",
    )


class _BaseForecaster(ABC):
    """Common interface for all baseline forecasters."""

    _fitted: bool = False

    def _check_fitted(self) -> None:
        if not self._fitted:
            raise ValueError(
                f"{self.__class__.__name__}.fit() must be called before predict()."
            )

    @abstractmethod
    def fit(self, y: pd.Series) -> "_BaseForecaster":
        """Fit on weekly price series *y*."""

    @abstractmethod
    def predict(self, horizon: int, last_date: pd.Timestamp) -> pd.DataFrame:
        """Predict *horizon* weeks ahead, returning a DataFrame."""


# ---------------------------------------------------------------------------
# NaiveForecaster
# ---------------------------------------------------------------------------


class NaiveForecaster(_BaseForecaster):
    """Forecast the last observed value for all future horizons."""

    last_value_: float
    residual_std_: float

    def fit(self, y: pd.Series) -> "NaiveForecaster":
        y = y.dropna().astype(float)
        if len(y) < 2:
            raise ValueError("NaiveForecaster.fit() requires at least 2 observations.")

        self.last_value_ = float(y.iloc[-1])
        residuals = y.diff().dropna()
        self.residual_std_ = float(residuals.std(ddof=1))
        self._fitted = True
        return self

    def predict(self, horizon: int, last_date: pd.Timestamp) -> pd.DataFrame:
        self._check_fitted()
        if horizon < 1:
            raise ValueError(f"horizon must be ≥ 1, got {horizon}")

        dates = _future_weekly_dates(last_date, horizon)
        point = np.full(horizon, self.last_value_)
        sigma = self.residual_std_ * np.sqrt(np.arange(1, horizon + 1, dtype=float))
        return _make_forecast_df(dates, point, sigma)


# ---------------------------------------------------------------------------
# SeasonalNaiveForecaster
# ---------------------------------------------------------------------------


class SeasonalNaiveForecaster(_BaseForecaster):
    """Forecast using the value from the same week-of-year, one year ago.

    Uses a 52-week seasonal period.  Best baseline for strongly seasonal
    produce prices (citrus, potatoes).
    """

    seasonal_values_: dict[int, float]
    residual_std_: dict[int, float]

    def fit(self, y: pd.Series) -> "SeasonalNaiveForecaster":
        y = y.dropna().astype(float)
        if len(y) < 53:
            raise ValueError(
                "SeasonalNaiveForecaster.fit() requires at least 53 observations "
                "(one full year + one extra week)."
            )
        if not isinstance(y.index, pd.DatetimeIndex):
            raise TypeError("y must have a DatetimeIndex.")

        weeks = y.index.isocalendar().week.astype(int)

        self.seasonal_values_ = {}
        self.residual_std_ = {}
        global_std = float(y.std(ddof=1))

        for week in range(1, 54):  # ISO weeks 1–53
            week_vals = y[weeks == week]
            if len(week_vals) == 0:
                continue
            self.seasonal_values_[week] = float(week_vals.iloc[-1])
            yoy = week_vals.diff().dropna()
            std = float(yoy.std(ddof=1)) if len(yoy) >= 2 else global_std
            self.residual_std_[week] = std if not math.isnan(std) else global_std

        # Fill any missing week slots with overall mean / std
        overall_mean = float(y.mean())
        for week in range(1, 54):
            if week not in self.seasonal_values_:
                self.seasonal_values_[week] = overall_mean
                self.residual_std_[week] = global_std

        self._fitted = True
        return self

    def predict(self, horizon: int, last_date: pd.Timestamp) -> pd.DataFrame:
        self._check_fitted()
        if horizon < 1:
            raise ValueError(f"horizon must be ≥ 1, got {horizon}")

        dates = _future_weekly_dates(last_date, horizon)
        weeks = dates.isocalendar().week.astype(int)

        point = np.array(
            [self.seasonal_values_.get(int(w), self.seasonal_values_[1]) for w in weeks],
            dtype=float,
        )
        sigma = np.array(
            [self.residual_std_.get(int(w), self.residual_std_[1]) for w in weeks],
            dtype=float,
        )
        return _make_forecast_df(dates, point, sigma)


# ---------------------------------------------------------------------------
# DriftForecaster
# ---------------------------------------------------------------------------


class DriftForecaster(_BaseForecaster):
    """Forecast using last value + average weekly price change × h."""

    last_value_: float
    drift_: float
    residual_std_: float

    def fit(self, y: pd.Series) -> "DriftForecaster":
        y = y.dropna().astype(float)
        if len(y) < 3:
            raise ValueError("DriftForecaster.fit() requires at least 3 observations.")

        self.last_value_ = float(y.iloc[-1])
        self.drift_ = float((y.iloc[-1] - y.iloc[0]) / (len(y) - 1))
        fitted = y.iloc[0] + self.drift_ * np.arange(len(y))
        residuals = y.values - fitted
        self.residual_std_ = float(np.std(residuals, ddof=2))
        self._fitted = True
        return self

    def predict(self, horizon: int, last_date: pd.Timestamp) -> pd.DataFrame:
        self._check_fitted()
        if horizon < 1:
            raise ValueError(f"horizon must be ≥ 1, got {horizon}")

        dates = _future_weekly_dates(last_date, horizon)
        h = np.arange(1, horizon + 1, dtype=float)
        point = self.last_value_ + self.drift_ * h
        sigma = self.residual_std_ * np.sqrt(h)
        return _make_forecast_df(dates, point, sigma)
