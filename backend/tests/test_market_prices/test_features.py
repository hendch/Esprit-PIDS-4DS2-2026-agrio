"""Tests for FeatureEngineer focused on build_full_feature_set().

All tests use 60 rows of synthetic monthly data — no real Excel files needed.

Run with:
    pytest tests/test_market_prices/test_features.py -v
"""
from __future__ import annotations

import numpy as np
import pandas as pd
import pytest

from app.modules.market_prices.data.holidays import get_tunisian_holidays
from app.modules.market_prices.features.engineering import FeatureEngineer

# Default lag list used by build_full_feature_set
_DEFAULT_LAGS = (1, 2, 3, 6, 9, 12, 24)


# ---------------------------------------------------------------------------
# Shared helpers / fixtures
# ---------------------------------------------------------------------------


def _make_df(n: int = 60, start: str = "2008-01-01") -> pd.DataFrame:
    """Return a minimal wide-format monthly DataFrame with ``n`` rows."""
    idx = pd.date_range(start=start, periods=n, freq="MS")
    rng = np.random.default_rng(0)
    prices = 500.0 + np.cumsum(rng.normal(0, 5, n))
    return pd.DataFrame(
        {
            "national_avg": prices,
            "nord": prices * 1.02,
            "sahel": prices * 0.99,
            "centre_et_sud": prices * 0.98,
            "series": "brebis_suitees",
            "unit": "TND/head",
        },
        index=idx,
    )


@pytest.fixture
def df60() -> pd.DataFrame:
    return _make_df(60)


@pytest.fixture
def holidays() -> pd.DataFrame:
    return get_tunisian_holidays(start_year=2008, end_year=2030)


@pytest.fixture
def fe() -> FeatureEngineer:
    return FeatureEngineer()


# ---------------------------------------------------------------------------
# build_full_feature_set — core contract
# ---------------------------------------------------------------------------


class TestBuildFullFeatureSet:
    def test_returns_dataframe(self, df60, fe, holidays, capsys):
        result = fe.build_full_feature_set(df60, "national_avg", holidays)
        assert isinstance(result, pd.DataFrame)

    def test_no_nan_in_output(self, df60, fe, holidays, capsys):
        result = fe.build_full_feature_set(df60, "national_avg", holidays)
        total_nan = result.isnull().sum().sum()
        assert total_nan == 0, (
            f"build_full_feature_set output must have zero NaN; got {total_nan}"
        )

    def test_datetime_index_preserved(self, df60, fe, holidays, capsys):
        result = fe.build_full_feature_set(df60, "national_avg", holidays)
        assert isinstance(result.index, pd.DatetimeIndex)

    def test_input_not_mutated(self, df60, fe, holidays, capsys):
        original_cols = list(df60.columns)
        fe.build_full_feature_set(df60, "national_avg", holidays)
        assert list(df60.columns) == original_cols

    def test_fewer_rows_than_input(self, df60, fe, holidays, capsys):
        """Rows are dropped to eliminate NaN from lagging — output < 60."""
        result = fe.build_full_feature_set(df60, "national_avg", holidays)
        assert len(result) < len(df60)

    def test_rows_capped_by_max_lag(self, fe, holidays, capsys):
        """With max lag 24, at most 60-24=36 usable rows."""
        df = _make_df(60)
        result = fe.build_full_feature_set(df, "national_avg", holidays, lags=(1, 12, 24))
        assert len(result) <= 60 - 24

    # --- Lag columns --------------------------------------------------------

    def test_lag_columns_exist(self, df60, fe, holidays, capsys):
        result = fe.build_full_feature_set(df60, "national_avg", holidays,
                                           lags=_DEFAULT_LAGS)
        lag_cols = [c for c in result.columns if "national_avg_lag_" in c]
        assert len(lag_cols) > 0, "No lag columns found in output"

    def test_lag_column_count_matches_lags_list(self, df60, fe, holidays, capsys):
        lags = (1, 3, 6, 12)
        result = fe.build_full_feature_set(df60, "national_avg", holidays, lags=lags)
        lag_cols = [c for c in result.columns if "national_avg_lag_" in c]
        assert len(lag_cols) == len(lags), (
            f"Expected {len(lags)} lag columns, got {len(lag_cols)}: {lag_cols}"
        )

    def test_each_lag_column_named_correctly(self, df60, fe, holidays, capsys):
        lags = (1, 6, 12)
        result = fe.build_full_feature_set(df60, "national_avg", holidays, lags=lags)
        for n in lags:
            assert f"national_avg_lag_{n}" in result.columns, (
                f"Column 'national_avg_lag_{n}' missing from output"
            )

    # --- Cyclical calendar features -----------------------------------------

    def test_month_sin_bounded(self, df60, fe, holidays, capsys):
        result = fe.build_full_feature_set(df60, "national_avg", holidays)
        assert result["month_sin"].between(-1.0, 1.0).all(), (
            "month_sin has values outside [-1, 1]"
        )

    def test_month_cos_bounded(self, df60, fe, holidays, capsys):
        result = fe.build_full_feature_set(df60, "national_avg", holidays)
        assert result["month_cos"].between(-1.0, 1.0).all(), (
            "month_cos has values outside [-1, 1]"
        )

    def test_month_sin_cos_on_unit_circle(self, df60, fe, holidays, capsys):
        """sin² + cos² must equal 1 for every row."""
        result = fe.build_full_feature_set(df60, "national_avg", holidays)
        norm = result["month_sin"] ** 2 + result["month_cos"] ** 2
        np.testing.assert_allclose(norm.values, 1.0, atol=1e-10)

    def test_quarter_sin_cos_bounded(self, df60, fe, holidays, capsys):
        result = fe.build_full_feature_set(df60, "national_avg", holidays)
        assert result["quarter_sin"].between(-1.0, 1.0).all()
        assert result["quarter_cos"].between(-1.0, 1.0).all()

    # --- Holiday features ---------------------------------------------------

    def test_days_to_eid_adha_integer_dtype(self, df60, fe, holidays, capsys):
        result = fe.build_full_feature_set(df60, "national_avg", holidays)
        assert result["days_to_eid_adha"].dtype in (np.int32, np.int64, int), (
            f"Expected integer dtype, got {result['days_to_eid_adha'].dtype}"
        )

    def test_binary_holiday_flags_zero_or_one(self, df60, fe, holidays, capsys):
        result = fe.build_full_feature_set(df60, "national_avg", holidays)
        for col in ("is_eid_adha_month", "is_ramadan_month", "is_pre_eid_month"):
            assert result[col].isin([0, 1]).all(), f"'{col}' must be 0 or 1"

    # --- Summary print ------------------------------------------------------

    def test_prints_summary(self, df60, fe, holidays, capsys):
        fe.build_full_feature_set(df60, "national_avg", holidays)
        out = capsys.readouterr().out
        assert "Features created" in out
        assert "Rows dropped" in out
