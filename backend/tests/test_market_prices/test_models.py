"""Tests for SeasonalNaiveForecaster and ConformalPredictor.

Uses 48 months of synthetic data (linear trend + noise).
ConformalPredictor tests are skipped when the class is not yet implemented.

Run with:
    pytest tests/test_market_prices/test_models.py -v
"""
from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from app.modules.market_prices.models.baseline import SeasonalNaiveForecaster

# ---------------------------------------------------------------------------
# Try to import ConformalPredictor — skip its tests if not yet implemented
# ---------------------------------------------------------------------------

try:
    from app.modules.market_prices.models.conformal import ConformalPredictor  # type: ignore[import]

    _CONFORMAL_AVAILABLE = True
except ImportError:
    _CONFORMAL_AVAILABLE = False

_skip_conformal = pytest.mark.skipif(
    not _CONFORMAL_AVAILABLE,
    reason="ConformalPredictor not yet implemented in app.modules.market_prices.models.conformal",
)

# ---------------------------------------------------------------------------
# Shared helpers / fixtures
# ---------------------------------------------------------------------------

_FORECAST_COLS = ["date", "forecast", "lower_80", "upper_80", "lower_95", "upper_95"]


def _make_series(n: int = 48, start: str = "2020-01-01", seed: int = 7) -> pd.Series:
    """Deterministic 48-month series with linear trend and mild noise."""
    rng = np.random.default_rng(seed)
    idx = pd.date_range(start=start, periods=n, freq="MS")
    trend = np.linspace(500, 700, n)
    noise = rng.normal(0, 8, n)
    return pd.Series(trend + noise, index=idx, name="price")


@pytest.fixture
def y48() -> pd.Series:
    return _make_series(48)


@pytest.fixture
def last_date(y48) -> pd.Timestamp:
    return y48.index[-1]


@pytest.fixture
def fitted_model(y48) -> SeasonalNaiveForecaster:
    return SeasonalNaiveForecaster().fit(y48)


# ---------------------------------------------------------------------------
# SeasonalNaiveForecaster
# ---------------------------------------------------------------------------


class TestSeasonalNaivePredict:
    def test_returns_dataframe(self, fitted_model, last_date):
        df = fitted_model.predict(horizon=12, last_date=last_date)
        assert isinstance(df, pd.DataFrame)

    def test_correct_horizon_length(self, fitted_model, last_date):
        for horizon in (1, 6, 12, 24):
            df = fitted_model.predict(horizon=horizon, last_date=last_date)
            assert len(df) == horizon, (
                f"horizon={horizon}: expected {horizon} rows, got {len(df)}"
            )

    def test_correct_columns(self, fitted_model, last_date):
        df = fitted_model.predict(horizon=6, last_date=last_date)
        assert list(df.columns) == _FORECAST_COLS

    def test_dates_start_one_month_after_last(self, fitted_model, last_date):
        df = fitted_model.predict(horizon=1, last_date=last_date)
        expected = last_date + pd.DateOffset(months=1)
        assert df["date"].iloc[0] == pd.Timestamp(
            year=expected.year, month=expected.month, day=1
        )

    def test_dates_are_monthly(self, fitted_model, last_date):
        df = fitted_model.predict(horizon=6, last_date=last_date)
        diffs = df["date"].diff().dropna().dt.days
        assert (diffs >= 28).all() and (diffs <= 31).all()

    def test_no_nan_in_output(self, fitted_model, last_date):
        df = fitted_model.predict(horizon=12, last_date=last_date)
        assert df.isnull().sum().sum() == 0

    def test_lower_80_le_forecast(self, fitted_model, last_date):
        df = fitted_model.predict(horizon=12, last_date=last_date)
        assert (df["lower_80"] <= df["forecast"]).all(), (
            "lower_80 must be ≤ forecast for every horizon step"
        )

    def test_forecast_le_upper_80(self, fitted_model, last_date):
        df = fitted_model.predict(horizon=12, last_date=last_date)
        assert (df["forecast"] <= df["upper_80"]).all(), (
            "forecast must be ≤ upper_80 for every horizon step"
        )

    def test_lower_80_le_upper_80(self, fitted_model, last_date):
        df = fitted_model.predict(horizon=12, last_date=last_date)
        assert (df["lower_80"] < df["upper_80"]).all()

    def test_lower_95_le_lower_80(self, fitted_model, last_date):
        df = fitted_model.predict(horizon=6, last_date=last_date)
        assert (df["lower_95"] <= df["lower_80"]).all()

    def test_upper_95_ge_upper_80(self, fitted_model, last_date):
        df = fitted_model.predict(horizon=6, last_date=last_date)
        assert (df["upper_95"] >= df["upper_80"]).all()

    def test_forecast_inside_95_interval(self, fitted_model, last_date):
        df = fitted_model.predict(horizon=12, last_date=last_date)
        assert (df["forecast"] >= df["lower_95"]).all()
        assert (df["forecast"] <= df["upper_95"]).all()

    def test_fit_returns_self(self, y48):
        model = SeasonalNaiveForecaster()
        assert model.fit(y48) is model

    def test_predict_before_fit_raises(self):
        model = SeasonalNaiveForecaster()
        with pytest.raises(ValueError, match="fit()"):
            model.predict(horizon=6, last_date=pd.Timestamp("2025-01-01"))

    def test_horizon_zero_raises(self, fitted_model, last_date):
        with pytest.raises(ValueError):
            fitted_model.predict(horizon=0, last_date=last_date)

    def test_seasonal_values_cover_all_12_months(self, y48):
        model = SeasonalNaiveForecaster().fit(y48)
        assert set(model.seasonal_values_.keys()) == set(range(1, 13))

    def test_forecast_repeats_same_month_last_year(self, fitted_model, last_date):
        df = fitted_model.predict(horizon=1, last_date=last_date)
        expected_month = (last_date.month % 12) + 1
        expected_value = fitted_model.seasonal_values_[expected_month]
        assert pytest.approx(df["forecast"].iloc[0]) == expected_value


# ---------------------------------------------------------------------------
# ConformalPredictor (skipped until the class is implemented)
# ---------------------------------------------------------------------------


@_skip_conformal
class TestConformalPredictor:
    """Tests for ConformalPredictor.predict_with_intervals().

    These tests are automatically skipped when the class does not exist.
    Remove the skip marker and add the import above once implemented.
    """

    @pytest.fixture
    def conformal_fitted(self, y48):
        model = ConformalPredictor()  # noqa: F821 — available when not skipped
        model.fit(y48)
        return model

    def test_returns_dataframe(self, conformal_fitted, last_date):
        df = conformal_fitted.predict_with_intervals(horizon=12, last_date=last_date)
        assert isinstance(df, pd.DataFrame)

    def test_correct_columns(self, conformal_fitted, last_date):
        df = conformal_fitted.predict_with_intervals(horizon=6, last_date=last_date)
        assert list(df.columns) == _FORECAST_COLS

    def test_correct_horizon_length(self, conformal_fitted, last_date):
        df = conformal_fitted.predict_with_intervals(horizon=12, last_date=last_date)
        assert len(df) == 12

    def test_lower_bounds_never_negative(self, conformal_fitted, last_date):
        """Prices are strictly positive; conformal lower bounds must be ≥ 0."""
        df = conformal_fitted.predict_with_intervals(horizon=12, last_date=last_date)
        assert (df["lower_80"] >= 0).all(), "lower_80 must be non-negative"
        assert (df["lower_95"] >= 0).all(), "lower_95 must be non-negative"

    def test_lower_80_le_forecast(self, conformal_fitted, last_date):
        df = conformal_fitted.predict_with_intervals(horizon=12, last_date=last_date)
        assert (df["lower_80"] <= df["forecast"]).all()

    def test_forecast_le_upper_80(self, conformal_fitted, last_date):
        df = conformal_fitted.predict_with_intervals(horizon=12, last_date=last_date)
        assert (df["forecast"] <= df["upper_80"]).all()

    def test_no_nan_in_output(self, conformal_fitted, last_date):
        df = conformal_fitted.predict_with_intervals(horizon=12, last_date=last_date)
        assert df.isnull().sum().sum() == 0
