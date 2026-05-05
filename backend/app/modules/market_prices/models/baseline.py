"""Baseline forecasters for Tunisian livestock price series.

Three simple forecasters with a shared interface:

``NaiveForecaster``
    Forecast = last observed value.  Prediction intervals widen with the
    historical residual standard deviation.

``SeasonalNaiveForecaster``
    Forecast = value from the same calendar month one year ago.  Intervals
    are derived from the seasonal residual standard deviation.

``DriftForecaster``
    Forecast = last value + average monthly change × h.  Intervals widen
    proportionally to √h (random-walk-with-drift assumption).

All forecasters share a common abstract base so callers can use them
interchangeably without isinstance checks.

Usage
-----
>>> from app.modules.market_prices.models.baseline import SeasonalNaiveForecaster
>>> model = SeasonalNaiveForecaster()
>>> model.fit(price_series)
>>> forecast_df = model.predict(horizon=12, last_date=price_series.index[-1])
"""
from __future__ import annotations

import math
from abc import ABC, abstractmethod

import numpy as np
import pandas as pd

# z-scores for 80 % and 95 % symmetric prediction intervals
_Z80 = 1.281551565545
_Z95 = 1.959963984540


def _make_forecast_df(
    dates: pd.DatetimeIndex,
    point: np.ndarray,
    sigma: float | np.ndarray,
) -> pd.DataFrame:
    """Build the standard forecast DataFrame with PI columns.

    Parameters
    ----------
    dates:
        Monthly DatetimeIndex for the forecast horizon.
    point:
        1-D array of point forecasts.
    sigma:
        Per-horizon standard deviation (scalar or array of same length as
        *dates*).  Used to construct symmetric normal prediction intervals.

    Returns
    -------
    pd.DataFrame
        Columns: ``date``, ``forecast``, ``lower_80``, ``upper_80``,
        ``lower_95``, ``upper_95``.
    """
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


def _future_dates(last_date: pd.Timestamp, horizon: int) -> pd.DatetimeIndex:
    """Return *horizon* monthly timestamps starting the month after *last_date*."""
    return pd.date_range(
        start=last_date + pd.DateOffset(months=1),
        periods=horizon,
        freq="MS",
    )


# ---------------------------------------------------------------------------
# Abstract base
# ---------------------------------------------------------------------------


class _BaseForecaster(ABC):
    """Common interface for all baseline forecasters."""

    _fitted: bool = False

    def _check_fitted(self) -> None:
        """Raise ``ValueError`` if the model has not been fitted yet."""
        if not self._fitted:
            raise ValueError(
                f"{self.__class__.__name__}.fit() must be called before predict()."
            )

    @abstractmethod
    def fit(self, y: pd.Series) -> "_BaseForecaster":
        """Fit the model on the training series *y*.

        Parameters
        ----------
        y : pd.Series
            Monthly price series with a ``DatetimeIndex``.  Must contain at
            least 2 non-NaN observations.

        Returns
        -------
        self
        """

    @abstractmethod
    def predict(
        self,
        horizon: int,
        last_date: pd.Timestamp,
    ) -> pd.DataFrame:
        """Generate *horizon*-step-ahead point forecasts and prediction intervals.

        Parameters
        ----------
        horizon : int
            Number of months to forecast.  Must be ≥ 1.
        last_date : pd.Timestamp
            The date of the last known observation; forecasts start the
            following month.

        Returns
        -------
        pd.DataFrame
            Columns: ``date``, ``forecast``, ``lower_80``, ``upper_80``,
            ``lower_95``, ``upper_95``.
        """


# ---------------------------------------------------------------------------
# NaiveForecaster
# ---------------------------------------------------------------------------


class NaiveForecaster(_BaseForecaster):
    """Forecast the last observed value for all future horizons.

    Prediction intervals assume that forecast errors grow like white noise
    scaled by the in-sample residual standard deviation.  For a naive forecast
    of horizon *h* the standard deviation of the error is σ × √h.

    Parameters
    ----------
    None

    Attributes
    ----------
    last_value_ : float
        Last observed price value (set after :meth:`fit`).
    residual_std_ : float
        Standard deviation of one-step-ahead naive residuals (set after
        :meth:`fit`).
    """

    last_value_: float
    residual_std_: float

    def fit(self, y: pd.Series) -> "NaiveForecaster":
        """Fit on *y* by recording the last value and computing residual std.

        The naive residual at time *t* is ``y[t] − y[t-1]``.  Its standard
        deviation characterises the one-step forecast uncertainty.

        Parameters
        ----------
        y : pd.Series
            Monthly price series.  Must have ≥ 2 non-NaN values.

        Returns
        -------
        self
        """
        y = y.dropna().astype(float)
        if len(y) < 2:
            raise ValueError("NaiveForecaster.fit() requires at least 2 observations.")

        self.last_value_ = float(y.iloc[-1])
        residuals = y.diff().dropna()
        self.residual_std_ = float(residuals.std(ddof=1))
        self._fitted = True
        return self

    def predict(
        self,
        horizon: int,
        last_date: pd.Timestamp,
    ) -> pd.DataFrame:
        """Forecast the last observed value for each of the next *horizon* months.

        Parameters
        ----------
        horizon : int
            Number of months ahead.
        last_date : pd.Timestamp
            Date of the last training observation.

        Returns
        -------
        pd.DataFrame
            Forecast DataFrame with 80 % and 95 % prediction intervals.
            Intervals widen as σ × √h where h is the horizon step.
        """
        self._check_fitted()
        if horizon < 1:
            raise ValueError(f"horizon must be ≥ 1, got {horizon}")

        dates = _future_dates(last_date, horizon)
        point = np.full(horizon, self.last_value_)
        # PI grows with √h (accumulating white-noise errors)
        sigma = self.residual_std_ * np.sqrt(np.arange(1, horizon + 1, dtype=float))
        return _make_forecast_df(dates, point, sigma)


# ---------------------------------------------------------------------------
# SeasonalNaiveForecaster
# ---------------------------------------------------------------------------


class SeasonalNaiveForecaster(_BaseForecaster):
    """Forecast using the value from the same calendar month one year ago.

    This is the strongest simple baseline for Tunisian livestock prices because
    of the strong Eid al-Adha seasonality.

    Parameters
    ----------
    None

    Attributes
    ----------
    seasonal_values_ : dict[int, float]
        Mapping ``{month: mean_price}`` computed from the training series.
    residual_std_ : dict[int, float]
        Per-month residual standard deviation of the seasonal naive forecast.
    """

    seasonal_values_: dict[int, float]
    residual_std_: dict[int, float]

    def fit(self, y: pd.Series) -> "SeasonalNaiveForecaster":
        """Fit by recording the mean price and residual std for each calendar month.

        The seasonal naive residual for month *m* in year *t* is
        ``y[t, m] − y[t-1, m]``.

        Parameters
        ----------
        y : pd.Series
            Monthly price series with ``DatetimeIndex``.  Must have ≥ 13
            observations so that at least one year-over-year comparison is
            possible.

        Returns
        -------
        self
        """
        y = y.dropna().astype(float)
        if len(y) < 13:
            raise ValueError(
                "SeasonalNaiveForecaster.fit() requires at least 13 observations "
                "(one full year + one observation)."
            )
        if not isinstance(y.index, pd.DatetimeIndex):
            raise TypeError("y must have a DatetimeIndex.")

        self.seasonal_values_ = {}
        self.residual_std_ = {}

        for month in range(1, 13):
            month_vals = y[y.index.month == month]
            self.seasonal_values_[month] = float(month_vals.iloc[-1])
            # Year-over-year differences for this month
            yoy = month_vals.diff().dropna()
            std = float(yoy.std(ddof=1)) if len(yoy) >= 2 else float(y.std(ddof=1))
            self.residual_std_[month] = std if not math.isnan(std) else float(y.std(ddof=1))

        self._fitted = True
        return self

    def predict(
        self,
        horizon: int,
        last_date: pd.Timestamp,
    ) -> pd.DataFrame:
        """Forecast using the last observed value for the corresponding calendar month.

        Parameters
        ----------
        horizon : int
            Number of months ahead.
        last_date : pd.Timestamp
            Date of the last training observation.

        Returns
        -------
        pd.DataFrame
            Forecast DataFrame.  Intervals are month-specific and do not widen
            with horizon (the model assumes perfect seasonal repetition).
        """
        self._check_fitted()
        if horizon < 1:
            raise ValueError(f"horizon must be ≥ 1, got {horizon}")

        dates = _future_dates(last_date, horizon)
        point = np.array(
            [self.seasonal_values_[d.month] for d in dates], dtype=float
        )
        sigma = np.array(
            [self.residual_std_[d.month] for d in dates], dtype=float
        )
        return _make_forecast_df(dates, point, sigma)


# ---------------------------------------------------------------------------
# DriftForecaster
# ---------------------------------------------------------------------------


class DriftForecaster(_BaseForecaster):
    """Forecast using the random-walk-with-drift model.

    The drift *c* is the average month-over-month change in the training
    series.  The h-step-ahead forecast is ``y_T + c × h``.  Prediction
    intervals widen as σ × √h where σ is the residual standard deviation of
    one-step drift forecasts.

    Parameters
    ----------
    None

    Attributes
    ----------
    last_value_ : float
        Last observed value (set after :meth:`fit`).
    drift_ : float
        Average monthly change (set after :meth:`fit`).
    residual_std_ : float
        Standard deviation of drift residuals (set after :meth:`fit`).
    """

    last_value_: float
    drift_: float
    residual_std_: float

    def fit(self, y: pd.Series) -> "DriftForecaster":
        """Fit by estimating the average monthly price change.

        The drift is computed as ``(y[-1] − y[0]) / (T − 1)`` — equivalent to
        the average first difference — which is the MLE of the drift for an
        i.i.d. random walk.

        Parameters
        ----------
        y : pd.Series
            Monthly price series.  Must have ≥ 3 non-NaN observations.

        Returns
        -------
        self
        """
        y = y.dropna().astype(float)
        if len(y) < 3:
            raise ValueError("DriftForecaster.fit() requires at least 3 observations.")

        self.last_value_ = float(y.iloc[-1])
        # Drift = total change / number of steps
        self.drift_ = float((y.iloc[-1] - y.iloc[0]) / (len(y) - 1))
        # Residual std from one-step drift forecast
        fitted = y.iloc[0] + self.drift_ * np.arange(len(y))
        residuals = y.values - fitted
        self.residual_std_ = float(np.std(residuals, ddof=2))  # ddof=2: estimated mean + slope
        self._fitted = True
        return self

    def predict(
        self,
        horizon: int,
        last_date: pd.Timestamp,
    ) -> pd.DataFrame:
        """Forecast using last value + drift × h for each horizon step h.

        Parameters
        ----------
        horizon : int
            Number of months ahead.
        last_date : pd.Timestamp
            Date of the last training observation.

        Returns
        -------
        pd.DataFrame
            Forecast DataFrame.  Intervals widen as σ × √h reflecting the
            accumulation of one-step errors along the drift path.
        """
        self._check_fitted()
        if horizon < 1:
            raise ValueError(f"horizon must be ≥ 1, got {horizon}")

        dates = _future_dates(last_date, horizon)
        h = np.arange(1, horizon + 1, dtype=float)
        point = self.last_value_ + self.drift_ * h
        sigma = self.residual_std_ * np.sqrt(h)
        return _make_forecast_df(dates, point, sigma)
