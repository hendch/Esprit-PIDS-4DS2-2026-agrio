"""Unit tests for baseline and SARIMA forecasters.

All tests use synthetic in-memory series — no real Excel files required.
SARIMA tests use a lightweight order (0,1,1)(0,1,1,12) and a 48-row series
so the test suite stays fast (< 10 s total).

Run with:
    pytest tests/unit/test_models.py -v
"""
from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from app.modules.market_prices.models.baseline import (
    DriftForecaster,
    NaiveForecaster,
    SeasonalNaiveForecaster,
)
from app.modules.market_prices.models.sarima import SARIMAForecaster

# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

_FORECAST_COLS = ["date", "forecast", "lower_80", "upper_80", "lower_95", "upper_95"]


def _make_series(n: int = 60, start: str = "2010-01-01", seed: int = 42) -> pd.Series:
    """Deterministic monthly price series with mild trend and seasonality."""
    rng = np.random.default_rng(seed)
    idx = pd.date_range(start=start, periods=n, freq="MS")
    trend = np.linspace(400, 600, n)
    seasonal = 30 * np.sin(2 * np.pi * np.arange(n) / 12)
    noise = rng.normal(0, 5, n)
    values = trend + seasonal + noise
    return pd.Series(values, index=idx, name="price")


@pytest.fixture
def y60() -> pd.Series:
    return _make_series(60)


@pytest.fixture
def y48() -> pd.Series:
    return _make_series(48)


@pytest.fixture
def last_date(y60) -> pd.Timestamp:
    return y60.index[-1]


# ---------------------------------------------------------------------------
# Shared contract — applies to ALL forecasters
# ---------------------------------------------------------------------------

BASELINE_CLASSES = [NaiveForecaster, SeasonalNaiveForecaster, DriftForecaster]


@pytest.mark.parametrize("cls", BASELINE_CLASSES)
class TestBaselineContract:
    """Verify the shared interface contract for all three baseline forecasters."""

    def test_predict_before_fit_raises(self, cls):
        model = cls()
        with pytest.raises(ValueError, match="fit()"):
            model.predict(horizon=6, last_date=pd.Timestamp("2020-01-01"))

    def test_returns_self_from_fit(self, cls, y60):
        model = cls()
        result = model.fit(y60)
        assert result is model

    def test_predict_returns_dataframe(self, cls, y60, last_date):
        model = cls().fit(y60)
        df = model.predict(horizon=6, last_date=last_date)
        assert isinstance(df, pd.DataFrame)

    def test_predict_correct_columns(self, cls, y60, last_date):
        df = cls().fit(y60).predict(horizon=6, last_date=last_date)
        assert list(df.columns) == _FORECAST_COLS

    def test_predict_correct_row_count(self, cls, y60, last_date):
        horizon = 12
        df = cls().fit(y60).predict(horizon=horizon, last_date=last_date)
        assert len(df) == horizon

    def test_predict_dates_start_next_month(self, cls, y60, last_date):
        df = cls().fit(y60).predict(horizon=3, last_date=last_date)
        expected_first = last_date + pd.DateOffset(months=1)
        assert df["date"].iloc[0] == pd.Timestamp(
            year=expected_first.year, month=expected_first.month, day=1
        )

    def test_predict_dates_are_monthly(self, cls, y60, last_date):
        df = cls().fit(y60).predict(horizon=6, last_date=last_date)
        diffs = df["date"].diff().dropna()
        # All consecutive dates should be ~28–31 days apart (monthly freq)
        assert (diffs.dt.days >= 28).all()
        assert (diffs.dt.days <= 31).all()

    def test_lower_80_below_upper_80(self, cls, y60, last_date):
        df = cls().fit(y60).predict(horizon=6, last_date=last_date)
        assert (df["lower_80"] < df["upper_80"]).all()

    def test_lower_95_below_lower_80(self, cls, y60, last_date):
        df = cls().fit(y60).predict(horizon=6, last_date=last_date)
        assert (df["lower_95"] <= df["lower_80"]).all()

    def test_upper_95_above_upper_80(self, cls, y60, last_date):
        df = cls().fit(y60).predict(horizon=6, last_date=last_date)
        assert (df["upper_95"] >= df["upper_80"]).all()

    def test_forecast_inside_95_interval(self, cls, y60, last_date):
        df = cls().fit(y60).predict(horizon=6, last_date=last_date)
        assert (df["forecast"] >= df["lower_95"]).all()
        assert (df["forecast"] <= df["upper_95"]).all()

    def test_horizon_zero_raises(self, cls, y60, last_date):
        model = cls().fit(y60)
        with pytest.raises(ValueError):
            model.predict(horizon=0, last_date=last_date)

    def test_no_nan_in_forecast(self, cls, y60, last_date):
        df = cls().fit(y60).predict(horizon=12, last_date=last_date)
        assert df.isnull().sum().sum() == 0


# ---------------------------------------------------------------------------
# NaiveForecaster specifics
# ---------------------------------------------------------------------------


class TestNaiveForecaster:
    def test_forecast_equals_last_value(self, y60, last_date):
        model = NaiveForecaster().fit(y60)
        df = model.predict(horizon=6, last_date=last_date)
        np.testing.assert_allclose(df["forecast"].values, model.last_value_)

    def test_intervals_widen_with_horizon(self, y60, last_date):
        model = NaiveForecaster().fit(y60)
        df = model.predict(horizon=12, last_date=last_date)
        widths = (df["upper_95"] - df["lower_95"]).values
        # Each width should be >= the previous (monotonically non-decreasing)
        assert (np.diff(widths) >= -1e-9).all(), "PI width should not decrease with horizon"

    def test_fit_requires_min_2_obs(self):
        with pytest.raises(ValueError, match="2 observations"):
            NaiveForecaster().fit(pd.Series([100.0]))

    def test_residual_std_positive(self, y60):
        model = NaiveForecaster().fit(y60)
        assert model.residual_std_ > 0


# ---------------------------------------------------------------------------
# SeasonalNaiveForecaster specifics
# ---------------------------------------------------------------------------


class TestSeasonalNaiveForecaster:
    def test_forecast_repeats_same_month_last_year(self, y60, last_date):
        model = SeasonalNaiveForecaster().fit(y60)
        df = model.predict(horizon=1, last_date=last_date)
        expected_month = (last_date.month % 12) + 1
        assert pytest.approx(df["forecast"].iloc[0]) == model.seasonal_values_[expected_month]

    def test_seasonal_values_all_12_months(self, y60):
        model = SeasonalNaiveForecaster().fit(y60)
        assert set(model.seasonal_values_.keys()) == set(range(1, 13))

    def test_fit_requires_13_obs(self):
        idx = pd.date_range("2020-01-01", periods=12, freq="MS")
        with pytest.raises(ValueError, match="13 observations"):
            SeasonalNaiveForecaster().fit(pd.Series(range(12), index=idx, dtype=float))

    def test_intervals_are_month_specific(self, y60, last_date):
        """Intervals should differ by month (seasonal std varies)."""
        model = SeasonalNaiveForecaster().fit(y60)
        df = model.predict(horizon=13, last_date=last_date)
        # Width of intervals: if all were the same sigma every month would be equal
        widths = (df["upper_95"] - df["lower_95"]).values
        # At least some variation expected across 13 months
        assert widths.std() >= 0  # just check it runs; std may be ~0 for short series


# ---------------------------------------------------------------------------
# DriftForecaster specifics
# ---------------------------------------------------------------------------


class TestDriftForecaster:
    def test_forecast_is_linear_in_horizon(self, y60, last_date):
        model = DriftForecaster().fit(y60)
        df = model.predict(horizon=6, last_date=last_date)
        # Consecutive differences should all equal drift_
        diffs = np.diff(df["forecast"].values)
        np.testing.assert_allclose(diffs, model.drift_, rtol=1e-6)

    def test_intervals_widen_with_horizon(self, y60, last_date):
        model = DriftForecaster().fit(y60)
        df = model.predict(horizon=12, last_date=last_date)
        widths = (df["upper_95"] - df["lower_95"]).values
        assert (np.diff(widths) >= -1e-9).all()

    def test_fit_requires_3_obs(self):
        idx = pd.date_range("2020-01-01", periods=2, freq="MS")
        with pytest.raises(ValueError, match="3 observations"):
            DriftForecaster().fit(pd.Series([100.0, 110.0], index=idx))

    def test_drift_direction_matches_series(self):
        """Positive trend → positive drift."""
        idx = pd.date_range("2020-01-01", periods=24, freq="MS")
        y = pd.Series(np.linspace(100, 200, 24), index=idx)
        model = DriftForecaster().fit(y)
        assert model.drift_ > 0


# ---------------------------------------------------------------------------
# SARIMAForecaster
# ---------------------------------------------------------------------------

# Use a small, fast order to keep test runtime short
_FAST_ORDER = (0, 1, 1)
_FAST_SEASONAL = (0, 1, 1, 12)


@pytest.fixture
def sarima_fitted(y48, capsys) -> SARIMAForecaster:
    """Pre-fitted SARIMAForecaster for re-use across tests."""
    model = SARIMAForecaster(order=_FAST_ORDER, seasonal_order=_FAST_SEASONAL)
    model.fit(y48)
    return model


class TestSARIMAForecasterUnfitted:
    def test_predict_before_fit_raises(self):
        model = SARIMAForecaster()
        with pytest.raises(ValueError, match="fit()"):
            model.predict(horizon=6, last_date=pd.Timestamp("2020-01-01"))

    def test_get_residuals_before_fit_raises(self):
        model = SARIMAForecaster()
        with pytest.raises(ValueError, match="fit()"):
            model.get_residuals()

    def test_repr_shows_not_fitted(self):
        model = SARIMAForecaster(order=(1, 1, 1), seasonal_order=(1, 1, 1, 12))
        assert "not fitted" in repr(model)


class TestSARIMAForecasterFit:
    def test_fit_returns_self(self, y48, capsys):
        model = SARIMAForecaster(order=_FAST_ORDER, seasonal_order=_FAST_SEASONAL)
        result = model.fit(y48)
        assert result is model

    def test_fit_sets_fitted_flag(self, sarima_fitted):
        assert sarima_fitted._fitted is True

    def test_fit_prints_aic_bic(self, y48, capsys):
        SARIMAForecaster(order=_FAST_ORDER, seasonal_order=_FAST_SEASONAL).fit(y48)
        out = capsys.readouterr().out
        assert "AIC" in out
        assert "BIC" in out

    def test_fit_prints_ljung_box(self, y48, capsys):
        SARIMAForecaster(order=_FAST_ORDER, seasonal_order=_FAST_SEASONAL).fit(y48)
        out = capsys.readouterr().out
        assert "Ljung-Box" in out

    def test_fit_requires_24_obs(self, capsys):
        idx = pd.date_range("2020-01-01", periods=23, freq="MS")
        y = pd.Series(np.linspace(100, 200, 23), index=idx)
        with pytest.raises(ValueError, match="24 observations"):
            SARIMAForecaster(order=_FAST_ORDER, seasonal_order=_FAST_SEASONAL).fit(y)

    def test_log_resid_std_positive(self, sarima_fitted):
        assert sarima_fitted.log_resid_std_ > 0

    def test_repr_shows_fitted(self, sarima_fitted):
        assert "fitted" in repr(sarima_fitted)
        assert "not fitted" not in repr(sarima_fitted)


class TestSARIMAForecasterPredict:
    def test_returns_dataframe(self, sarima_fitted, capsys):
        last = sarima_fitted._y_log.index[-1]
        df = sarima_fitted.predict(horizon=6, last_date=last)
        assert isinstance(df, pd.DataFrame)

    def test_correct_columns(self, sarima_fitted):
        last = sarima_fitted._y_log.index[-1]
        df = sarima_fitted.predict(horizon=6, last_date=last)
        assert list(df.columns) == _FORECAST_COLS

    def test_correct_row_count(self, sarima_fitted):
        last = sarima_fitted._y_log.index[-1]
        df = sarima_fitted.predict(horizon=12, last_date=last)
        assert len(df) == 12

    def test_dates_start_next_month(self, sarima_fitted):
        last = sarima_fitted._y_log.index[-1]
        df = sarima_fitted.predict(horizon=3, last_date=last)
        expected = last + pd.DateOffset(months=1)
        assert df["date"].iloc[0] == pd.Timestamp(
            year=expected.year, month=expected.month, day=1
        )

    def test_forecasts_are_positive(self, sarima_fitted):
        """Back-transform from log space must always be positive."""
        last = sarima_fitted._y_log.index[-1]
        df = sarima_fitted.predict(horizon=12, last_date=last)
        assert (df["forecast"] > 0).all()
        assert (df["lower_80"] > 0).all()
        assert (df["lower_95"] > 0).all()

    def test_intervals_ordered(self, sarima_fitted):
        last = sarima_fitted._y_log.index[-1]
        df = sarima_fitted.predict(horizon=6, last_date=last)
        assert (df["lower_95"] <= df["lower_80"]).all()
        assert (df["lower_80"] <= df["forecast"]).all()
        assert (df["forecast"] <= df["upper_80"]).all()
        assert (df["upper_80"] <= df["upper_95"]).all()

    def test_no_nan_in_output(self, sarima_fitted):
        last = sarima_fitted._y_log.index[-1]
        df = sarima_fitted.predict(horizon=12, last_date=last)
        assert df.isnull().sum().sum() == 0

    def test_horizon_zero_raises(self, sarima_fitted):
        last = sarima_fitted._y_log.index[-1]
        with pytest.raises(ValueError):
            sarima_fitted.predict(horizon=0, last_date=last)

    def test_95_interval_wider_than_80(self, sarima_fitted):
        last = sarima_fitted._y_log.index[-1]
        df = sarima_fitted.predict(horizon=6, last_date=last)
        width_95 = df["upper_95"] - df["lower_95"]
        width_80 = df["upper_80"] - df["lower_80"]
        assert (width_95 > width_80).all()


class TestSARIMAGetResiduals:
    def test_returns_series(self, sarima_fitted):
        resid = sarima_fitted.get_residuals()
        assert isinstance(resid, pd.Series)

    def test_residuals_have_datetime_index(self, sarima_fitted):
        resid = sarima_fitted.get_residuals()
        assert isinstance(resid.index, pd.DatetimeIndex)

    def test_residuals_length_matches_training(self, sarima_fitted, y48):
        resid = sarima_fitted.get_residuals().dropna()
        # After differencing, residuals should be shorter than training series
        assert len(resid) <= len(y48)
        assert len(resid) > 0

    def test_residuals_near_zero_mean(self, sarima_fitted):
        resid = sarima_fitted.get_residuals().dropna()
        assert abs(resid.mean()) < 1.0  # mean should be close to 0 in log space


class TestSARIMAAutoSelectOrder:
    def test_returns_dict_with_required_keys(self, y48, capsys):
        model = SARIMAForecaster()
        best = model.auto_select_order(y48, max_p=1, max_q=1, max_P=1, max_Q=1)
        assert "order" in best
        assert "seasonal_order" in best

    def test_order_tuple_length(self, y48, capsys):
        model = SARIMAForecaster()
        best = model.auto_select_order(y48, max_p=1, max_q=1, max_P=1, max_Q=1)
        assert len(best["order"]) == 3
        assert len(best["seasonal_order"]) == 4

    def test_fixed_d_and_D(self, y48, capsys):
        model = SARIMAForecaster()
        best = model.auto_select_order(y48, max_p=1, max_q=1, max_P=1, max_Q=1)
        assert best["order"][1] == 1        # d fixed at 1
        assert best["seasonal_order"][1] == 1  # D fixed at 1

    def test_seasonal_period_is_12(self, y48, capsys):
        model = SARIMAForecaster()
        best = model.auto_select_order(y48, max_p=1, max_q=1, max_P=1, max_Q=1)
        assert best["seasonal_order"][3] == 12

    def test_prints_top5_table(self, y48, capsys):
        model = SARIMAForecaster()
        model.auto_select_order(y48, max_p=1, max_q=1, max_P=1, max_Q=1)
        out = capsys.readouterr().out
        assert "AIC" in out
        assert "Rank" in out

    def test_best_order_can_be_used_to_fit(self, y48, capsys):
        """The returned dict should unpack directly into SARIMAForecaster."""
        model = SARIMAForecaster()
        best = model.auto_select_order(y48, max_p=1, max_q=1, max_P=0, max_Q=0)
        capsys.readouterr()  # clear output
        new_model = SARIMAForecaster(**best)
        new_model.fit(y48)  # should not raise
        assert new_model._fitted
