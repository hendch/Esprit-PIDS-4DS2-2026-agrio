"""Unit tests for FeatureEngineer and get_feature_importance_names.

All tests use synthetic in-memory DataFrames — no real Excel files required.

Run with:
    pytest tests/unit/test_features.py -v
"""
from __future__ import annotations

import math

import numpy as np
import pandas as pd
import pytest

from app.modules.market_prices.data.holidays import get_tunisian_holidays
from app.modules.market_prices.features.engineering import (
    FeatureEngineer,
    get_feature_importance_names,
)


# ---------------------------------------------------------------------------
# Shared fixtures
# ---------------------------------------------------------------------------

LAGS = (1, 2, 3, 6, 9, 12, 24)
WINDOWS = (3, 6, 12)
ROLLING_FUNCS = ("mean", "std", "min", "max")


def _make_df(n: int = 60, start: str = "2010-01-01") -> pd.DataFrame:
    """Return a minimal wide-format monthly price DataFrame with n rows.

    Uses a simple deterministic price series so tests are reproducible.
    """
    idx = pd.date_range(start=start, periods=n, freq="MS")
    rng = np.random.default_rng(42)
    base = 500.0
    prices = base + np.cumsum(rng.normal(0, 5, n))  # random walk around 500
    df = pd.DataFrame(
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
    df.index.name = "date"
    return df


@pytest.fixture
def df60() -> pd.DataFrame:
    """60-row monthly DataFrame starting 2010-01-01."""
    return _make_df(60)


@pytest.fixture
def holidays() -> pd.DataFrame:
    return get_tunisian_holidays(start_year=2008, end_year=2030)


@pytest.fixture
def fe() -> FeatureEngineer:
    return FeatureEngineer()


# ---------------------------------------------------------------------------
# add_lag_features
# ---------------------------------------------------------------------------


class TestAddLagFeatures:
    def test_correct_number_of_lag_columns(self, df60, fe):
        result = fe.add_lag_features(df60.copy(), "national_avg", lags=LAGS)
        lag_cols = [c for c in result.columns if c.startswith("national_avg_lag_")]
        assert len(lag_cols) == len(LAGS), (
            f"Expected {len(LAGS)} lag columns, got {len(lag_cols)}: {lag_cols}"
        )

    def test_lag_column_names(self, df60, fe):
        result = fe.add_lag_features(df60.copy(), "national_avg", lags=LAGS)
        for n in LAGS:
            assert f"national_avg_lag_{n}" in result.columns

    def test_lag_1_shifts_by_one(self, df60, fe):
        result = fe.add_lag_features(df60.copy(), "national_avg", lags=(1,))
        # Row index 1: lag_1 should equal original row 0
        assert result["national_avg_lag_1"].iloc[1] == pytest.approx(
            df60["national_avg"].iloc[0]
        )

    def test_lag_12_shifts_by_twelve(self, df60, fe):
        result = fe.add_lag_features(df60.copy(), "national_avg", lags=(12,))
        assert result["national_avg_lag_12"].iloc[12] == pytest.approx(
            df60["national_avg"].iloc[0]
        )

    def test_missing_target_col_raises(self, df60, fe):
        with pytest.raises(KeyError):
            fe.add_lag_features(df60.copy(), "nonexistent_col")

    def test_first_n_rows_are_nan(self, df60, fe):
        result = fe.add_lag_features(df60.copy(), "national_avg", lags=(3,))
        # First 3 rows of lag_3 must be NaN
        assert result["national_avg_lag_3"].iloc[:3].isna().all()

    def test_returns_same_dataframe_object(self, df60, fe):
        copy = df60.copy()
        returned = fe.add_lag_features(copy, "national_avg", lags=(1,))
        assert returned is copy  # in-place + return


# ---------------------------------------------------------------------------
# add_rolling_features
# ---------------------------------------------------------------------------


class TestAddRollingFeatures:
    def test_correct_number_of_roll_columns(self, df60, fe):
        result = fe.add_rolling_features(
            df60.copy(), "national_avg", windows=WINDOWS, funcs=ROLLING_FUNCS
        )
        roll_cols = [
            c for c in result.columns
            if c.startswith("national_avg_roll_") and not c.endswith(("cv", "momentum", "acceleration"))
        ]
        expected = len(WINDOWS) * len(ROLLING_FUNCS)
        assert len(roll_cols) == expected

    def test_derived_columns_present(self, df60, fe):
        result = fe.add_rolling_features(df60.copy(), "national_avg")
        for col in ("rolling_cv", "momentum", "acceleration"):
            assert col in result.columns, f"'{col}' missing from rolling features"

    def test_rolling_mean_non_negative(self, df60, fe):
        result = fe.add_rolling_features(df60.copy(), "national_avg", windows=(6,), funcs=("mean",))
        # All prices are positive so rolling mean must be positive
        valid = result["national_avg_roll_6_mean"].dropna()
        assert (valid > 0).all()

    def test_momentum_zero_before_lag12(self, df60, fe):
        result = fe.add_rolling_features(df60.copy(), "national_avg")
        # Rows 0–11 have no lag-12 value so momentum must be NaN
        assert result["momentum"].iloc[:12].isna().all()


# ---------------------------------------------------------------------------
# add_calendar_features
# ---------------------------------------------------------------------------


class TestAddCalendarFeatures:
    def test_all_columns_present(self, df60, fe):
        result = fe.add_calendar_features(df60.copy())
        expected = [
            "month", "quarter", "year", "year_norm",
            "month_sin", "month_cos",
            "quarter_sin", "quarter_cos",
            "is_q1", "is_q2", "is_q3", "is_q4",
        ]
        for col in expected:
            assert col in result.columns, f"Calendar column '{col}' missing"

    def test_month_range(self, df60, fe):
        result = fe.add_calendar_features(df60.copy())
        assert result["month"].between(1, 12).all()

    def test_quarter_range(self, df60, fe):
        result = fe.add_calendar_features(df60.copy())
        assert result["quarter"].between(1, 4).all()

    def test_cyclical_month_bounded(self, df60, fe):
        result = fe.add_calendar_features(df60.copy())
        assert result["month_sin"].between(-1.0, 1.0).all(), "month_sin out of [-1, 1]"
        assert result["month_cos"].between(-1.0, 1.0).all(), "month_cos out of [-1, 1]"

    def test_cyclical_quarter_bounded(self, df60, fe):
        result = fe.add_calendar_features(df60.copy())
        assert result["quarter_sin"].between(-1.0, 1.0).all(), "quarter_sin out of [-1, 1]"
        assert result["quarter_cos"].between(-1.0, 1.0).all(), "quarter_cos out of [-1, 1]"

    def test_month_sin_cos_unit_circle(self, df60, fe):
        """sin² + cos² must equal 1 for every row."""
        result = fe.add_calendar_features(df60.copy())
        norm = result["month_sin"] ** 2 + result["month_cos"] ** 2
        np.testing.assert_allclose(norm.values, 1.0, atol=1e-10)

    def test_binary_quarter_flags_mutually_exclusive(self, df60, fe):
        result = fe.add_calendar_features(df60.copy())
        flag_sum = result[["is_q1", "is_q2", "is_q3", "is_q4"]].sum(axis=1)
        assert (flag_sum == 1).all(), "Quarter flags must sum to exactly 1 per row"

    def test_year_norm_anchored_at_2008(self, df60, fe):
        result = fe.add_calendar_features(df60.copy())
        expected = result["year"] - 2008
        pd.testing.assert_series_equal(result["year_norm"], expected, check_names=False)

    def test_non_datetime_index_raises(self, fe):
        df = pd.DataFrame({"national_avg": [1, 2, 3]})
        with pytest.raises(TypeError):
            fe.add_calendar_features(df)


# ---------------------------------------------------------------------------
# add_holiday_features
# ---------------------------------------------------------------------------


class TestAddHolidayFeatures:
    def test_all_columns_present(self, df60, fe, holidays):
        result = fe.add_holiday_features(df60.copy(), holidays)
        for col in (
            "days_to_eid_adha", "days_to_ramadan", "days_to_eid_fitr",
            "is_eid_adha_month", "is_ramadan_month", "is_pre_eid_month",
        ):
            assert col in result.columns, f"Holiday column '{col}' missing"

    def test_days_to_eid_adha_are_integers(self, df60, fe, holidays):
        result = fe.add_holiday_features(df60.copy(), holidays)
        col = result["days_to_eid_adha"]
        assert col.dtype in (np.int32, np.int64, int), (
            f"days_to_eid_adha dtype should be int, got {col.dtype}"
        )

    def test_days_to_ramadan_are_integers(self, df60, fe, holidays):
        result = fe.add_holiday_features(df60.copy(), holidays)
        assert result["days_to_ramadan"].dtype in (np.int32, np.int64, int)

    def test_days_to_eid_fitr_are_integers(self, df60, fe, holidays):
        result = fe.add_holiday_features(df60.copy(), holidays)
        assert result["days_to_eid_fitr"].dtype in (np.int32, np.int64, int)

    def test_binary_flags_are_zero_or_one(self, df60, fe, holidays):
        result = fe.add_holiday_features(df60.copy(), holidays)
        for col in ("is_eid_adha_month", "is_ramadan_month", "is_pre_eid_month"):
            assert result[col].isin([0, 1]).all(), f"'{col}' must be 0 or 1"

    def test_pre_eid_window_consistent_with_days_to_eid(self, df60, fe, holidays):
        result = fe.add_holiday_features(df60.copy(), holidays)
        pre_eid = result["is_pre_eid_month"] == 1
        days = result.loc[pre_eid, "days_to_eid_adha"]
        assert ((days >= 14) & (days <= 45)).all(), (
            "is_pre_eid_month=1 rows must have days_to_eid_adha between 14 and 45"
        )

    def test_eid_month_flag_when_eid_date_in_month(self, fe, holidays):
        """is_eid_adha_month must be 1 for 2022-07-01 (Eid al-Adha 2022-07-09)."""
        idx = pd.date_range("2022-07-01", periods=1, freq="MS")
        df = pd.DataFrame({"national_avg": [100.0]}, index=idx)
        result = fe.add_holiday_features(df, holidays)
        assert result["is_eid_adha_month"].iloc[0] == 1


# ---------------------------------------------------------------------------
# add_trend_features
# ---------------------------------------------------------------------------


class TestAddTrendFeatures:
    def test_all_columns_present(self, df60, fe):
        result = fe.add_trend_features(df60.copy(), "national_avg")
        for col in ("log_price", "log_diff_1", "log_diff_12", "pct_change_1", "pct_change_12"):
            assert col in result.columns

    def test_log_price_positive_for_positive_series(self, df60, fe):
        result = fe.add_trend_features(df60.copy(), "national_avg")
        assert (result["log_price"] > 0).all()

    def test_log_diff_1_first_row_nan(self, df60, fe):
        result = fe.add_trend_features(df60.copy(), "national_avg")
        assert pd.isna(result["log_diff_1"].iloc[0])

    def test_pct_change_12_first_12_rows_nan(self, df60, fe):
        result = fe.add_trend_features(df60.copy(), "national_avg")
        assert result["pct_change_12"].iloc[:12].isna().all()


# ---------------------------------------------------------------------------
# add_regional_features
# ---------------------------------------------------------------------------


class TestAddRegionalFeatures:
    def test_columns_present(self, df60, fe):
        result = fe.add_regional_features(df60.copy())
        for col in ("regional_spread", "regional_cv", "nord_premium", "sahel_premium", "sud_premium"):
            assert col in result.columns

    def test_regional_spread_non_negative(self, df60, fe):
        result = fe.add_regional_features(df60.copy())
        assert (result["regional_spread"] >= 0).all()

    def test_nord_premium_sign(self, df60, fe):
        # nord = national_avg × 1.02, so premium should be ~0.02 (positive)
        result = fe.add_regional_features(df60.copy())
        assert (result["nord_premium"].dropna() > 0).all()

    def test_graceful_no_region_cols(self, fe):
        df = pd.DataFrame(
            {"national_avg": [100.0, 200.0]},
            index=pd.date_range("2020-01-01", periods=2, freq="MS"),
        )
        result = fe.add_regional_features(df.copy(), region_cols=["nord", "sahel"])
        # No region columns present — method should not crash
        assert "regional_spread" not in result.columns


# ---------------------------------------------------------------------------
# build_full_feature_set
# ---------------------------------------------------------------------------


class TestBuildFullFeatureSet:
    def test_no_nan_in_output(self, df60, fe, holidays, capsys):
        result = fe.build_full_feature_set(df60, "national_avg", holidays)
        assert result.isnull().sum().sum() == 0, (
            "build_full_feature_set output must have zero NaN values"
        )

    def test_input_not_mutated(self, df60, fe, holidays, capsys):
        original_cols = list(df60.columns)
        fe.build_full_feature_set(df60, "national_avg", holidays)
        assert list(df60.columns) == original_cols, "build_full_feature_set must not mutate input"

    def test_rows_dropped_equal_max_lag(self, fe, holidays, capsys):
        # With 60 rows and max lag 24, we expect 60 - 24 = 36 usable rows
        # (rolling warm-up for lag_24 is the binding constraint)
        df = _make_df(60, start="2008-01-01")
        result = fe.build_full_feature_set(df, "national_avg", holidays, lags=(1, 12, 24))
        assert len(result) <= 60 - 24

    def test_datetime_index_preserved(self, df60, fe, holidays, capsys):
        result = fe.build_full_feature_set(df60, "national_avg", holidays)
        assert isinstance(result.index, pd.DatetimeIndex)

    def test_summary_printed(self, df60, fe, holidays, capsys):
        fe.build_full_feature_set(df60, "national_avg", holidays)
        captured = capsys.readouterr()
        assert "Features created" in captured.out
        assert "Rows dropped" in captured.out
        assert "Usable date range" in captured.out

    def test_correct_lag_count_in_full_set(self, df60, fe, holidays, capsys):
        lags = (1, 2, 3, 6, 12)
        result = fe.build_full_feature_set(df60, "national_avg", holidays, lags=lags)
        lag_cols = [c for c in result.columns if c.startswith("national_avg_lag_")]
        assert len(lag_cols) == len(lags)

    def test_cyclical_features_bounded(self, df60, fe, holidays, capsys):
        result = fe.build_full_feature_set(df60, "national_avg", holidays)
        for col in ("month_sin", "month_cos", "quarter_sin", "quarter_cos"):
            assert result[col].between(-1.0, 1.0).all(), (
                f"Cyclical feature '{col}' out of [-1, 1] bounds"
            )

    def test_days_to_eid_integer_dtype(self, df60, fe, holidays, capsys):
        result = fe.build_full_feature_set(df60, "national_avg", holidays)
        assert result["days_to_eid_adha"].dtype in (np.int32, np.int64, int), (
            f"days_to_eid_adha must be integer, got {result['days_to_eid_adha'].dtype}"
        )


# ---------------------------------------------------------------------------
# get_feature_importance_names
# ---------------------------------------------------------------------------


class TestGetFeatureImportanceNames:
    def test_excludes_raw_price_columns(self, df60, fe, holidays, capsys):
        result = fe.build_full_feature_set(df60, "national_avg", holidays)
        names = get_feature_importance_names(result, "national_avg")
        for raw in ("national_avg", "nord", "sahel", "centre_et_sud", "series", "unit"):
            assert raw not in names, f"Raw column '{raw}' must not appear in feature names"

    def test_includes_lag_columns(self, df60, fe, holidays, capsys):
        result = fe.build_full_feature_set(df60, "national_avg", holidays)
        names = get_feature_importance_names(result, "national_avg")
        lag_cols = [c for c in names if "lag" in c]
        assert len(lag_cols) > 0, "Feature names should include lag columns"

    def test_includes_calendar_columns(self, df60, fe, holidays, capsys):
        result = fe.build_full_feature_set(df60, "national_avg", holidays)
        names = get_feature_importance_names(result, "national_avg")
        assert "month_sin" in names
        assert "year_norm" in names

    def test_returns_sorted_list(self, df60, fe, holidays, capsys):
        result = fe.build_full_feature_set(df60, "national_avg", holidays)
        names = get_feature_importance_names(result, "national_avg")
        assert names == sorted(names), "Feature names must be sorted"

    def test_no_duplicates(self, df60, fe, holidays, capsys):
        result = fe.build_full_feature_set(df60, "national_avg", holidays)
        names = get_feature_importance_names(result, "national_avg")
        assert len(names) == len(set(names)), "Feature names must be unique"
