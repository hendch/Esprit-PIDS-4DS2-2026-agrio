"""Forecast evaluation metrics for weekly produce price series.

All functions accept ``actual`` and ``forecast`` as 1-D array-like inputs and
return a scalar (float).  NaN positions in *actual* are dropped before any
computation.

Functions
---------
mae        — Mean Absolute Error
rmse       — Root Mean Squared Error
mape       — Mean Absolute Percentage Error (requires actual > 0)
smape      — Symmetric MAPE
coverage   — Empirical coverage of a prediction interval
winkler    — Winkler score (interval sharpness + coverage penalty)
evaluate   — Compute all metrics and return a dict
"""
from __future__ import annotations

import numpy as np
import pandas as pd


def _align(actual: np.ndarray, forecast: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Drop positions where *actual* is NaN."""
    a = np.asarray(actual, dtype=float)
    f = np.asarray(forecast, dtype=float)
    mask = ~np.isnan(a)
    return a[mask], f[mask]


def mae(actual: np.ndarray, forecast: np.ndarray) -> float:
    """Mean Absolute Error."""
    a, f = _align(actual, forecast)
    if len(a) == 0:
        return float("nan")
    return float(np.mean(np.abs(a - f)))


def rmse(actual: np.ndarray, forecast: np.ndarray) -> float:
    """Root Mean Squared Error."""
    a, f = _align(actual, forecast)
    if len(a) == 0:
        return float("nan")
    return float(np.sqrt(np.mean((a - f) ** 2)))


def mape(actual: np.ndarray, forecast: np.ndarray) -> float:
    """Mean Absolute Percentage Error.

    Positions where *actual* == 0 are excluded to avoid division by zero.
    """
    a, f = _align(actual, forecast)
    valid = a > 0
    a, f = a[valid], f[valid]
    if len(a) == 0:
        return float("nan")
    return float(np.mean(np.abs((a - f) / a)) * 100)


def mase(
    actual: np.ndarray,
    forecast: np.ndarray,
    train: np.ndarray,
    seasonal_period: int = 52,
) -> float:
    """Mean Absolute Scaled Error using seasonal naive scale.

    Parameters
    ----------
    actual, forecast : array-like
        Test set actuals and point forecasts.
    train : array-like
        Training series used to compute the naive scale.
    seasonal_period : int, default 52
        Seasonal period for the naive baseline (52 weeks = 1 year).

    Returns
    -------
    float
        MASE score.  Values < 1 mean the model beats the seasonal naive.
    """
    a, f = _align(actual, forecast)
    if len(a) == 0:
        return float("nan")

    train_arr = np.asarray(train, dtype=float)
    # Seasonal naive in-sample errors on training set
    if len(train_arr) <= seasonal_period:
        # Fallback: use 1-step naive
        naive_errors = np.abs(np.diff(train_arr))
    else:
        naive_errors = np.abs(train_arr[seasonal_period:] - train_arr[:-seasonal_period])

    scale = float(np.nanmean(naive_errors))
    if scale == 0:
        return float("nan")

    return float(np.mean(np.abs(a - f)) / scale)


def smape(actual: np.ndarray, forecast: np.ndarray) -> float:
    """Symmetric Mean Absolute Percentage Error."""
    a, f = _align(actual, forecast)
    denom = (np.abs(a) + np.abs(f)) / 2.0
    valid = denom > 0
    if not valid.any():
        return float("nan")
    return float(np.mean(np.abs(a[valid] - f[valid]) / denom[valid]) * 100)


def coverage(
    actual: np.ndarray,
    lower: np.ndarray,
    upper: np.ndarray,
) -> float:
    """Empirical coverage: fraction of actuals within [lower, upper].

    Parameters
    ----------
    actual, lower, upper : array-like
        Same length.  NaN positions in *actual* are dropped.

    Returns
    -------
    float
        Value in [0, 1].
    """
    a = np.asarray(actual, dtype=float)
    lo = np.asarray(lower, dtype=float)
    hi = np.asarray(upper, dtype=float)
    mask = ~np.isnan(a)
    a, lo, hi = a[mask], lo[mask], hi[mask]
    if len(a) == 0:
        return float("nan")
    return float(np.mean((a >= lo) & (a <= hi)))


def winkler(
    actual: np.ndarray,
    lower: np.ndarray,
    upper: np.ndarray,
    alpha: float = 0.20,
) -> float:
    """Winkler score for one prediction interval at level (1-alpha).

    Lower is better.  Score = interval width + penalty for misses.

    Parameters
    ----------
    alpha : float, default 0.20
        Significance level (0.20 → 80 % interval).
    """
    a = np.asarray(actual, dtype=float)
    lo = np.asarray(lower, dtype=float)
    hi = np.asarray(upper, dtype=float)
    mask = ~np.isnan(a)
    a, lo, hi = a[mask], lo[mask], hi[mask]
    if len(a) == 0:
        return float("nan")

    width = hi - lo
    penalty = np.where(
        a < lo, 2.0 / alpha * (lo - a),
        np.where(a > hi, 2.0 / alpha * (a - hi), 0.0),
    )
    return float(np.mean(width + penalty))


def evaluate(
    actual: np.ndarray,
    forecast: np.ndarray,
    lower_80: np.ndarray | None = None,
    upper_80: np.ndarray | None = None,
    lower_95: np.ndarray | None = None,
    upper_95: np.ndarray | None = None,
) -> dict[str, float]:
    """Compute all available metrics and return them as a dict.

    Parameters
    ----------
    actual, forecast : array-like
    lower_80, upper_80 : array-like or None
        80 % prediction interval bounds.
    lower_95, upper_95 : array-like or None
        95 % prediction interval bounds.

    Returns
    -------
    dict[str, float]
        Keys: ``mae``, ``rmse``, ``mape``, ``smape``,
        and optionally ``coverage_80``, ``coverage_95``,
        ``winkler_80``, ``winkler_95``.
    """
    result: dict[str, float] = {
        "mae": mae(actual, forecast),
        "rmse": rmse(actual, forecast),
        "mape": mape(actual, forecast),
        "smape": smape(actual, forecast),
    }

    if lower_80 is not None and upper_80 is not None:
        result["coverage_80"] = coverage(actual, lower_80, upper_80)
        result["winkler_80"] = winkler(actual, lower_80, upper_80, alpha=0.20)

    if lower_95 is not None and upper_95 is not None:
        result["coverage_95"] = coverage(actual, lower_95, upper_95)
        result["winkler_95"] = winkler(actual, lower_95, upper_95, alpha=0.05)

    return result
