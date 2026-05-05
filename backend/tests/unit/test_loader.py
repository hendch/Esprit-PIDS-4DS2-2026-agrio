"""Unit tests for LivestockDataLoader.

These tests use synthetic in-memory data so they run without the real Excel
files being present.  Each test builds a minimal fake file (or patches the
private loader methods) to verify the public contract of the class.

Run with:
    pytest tests/unit/test_loader.py -v
"""
from __future__ import annotations

import io
from pathlib import Path
from unittest.mock import MagicMock, patch

import pandas as pd
import pytest

from app.modules.market_prices.data.loader import (
    ALL_SERIES,
    FRENCH_MONTHS,
    REGION_COLS,
    LivestockDataLoader,
    _parse_french_date,
    _parse_mslash_date,
    _validate_no_duplicate_dates,
    _validate_prices_positive,
)


# ---------------------------------------------------------------------------
# Fixtures — minimal DataFrames that simulate what the private loaders return
# ---------------------------------------------------------------------------

def _make_regional_df(series_name: str, start: str = "2008-01-01", periods: int = 12) -> pd.DataFrame:
    """Return a minimal wide-format regional DataFrame."""
    idx = pd.date_range(start=start, periods=periods, freq="MS")
    df = pd.DataFrame(
        {
            "nord": [100.0 + i for i in range(periods)],
            "sahel": [110.0 + i for i in range(periods)],
            "centre_et_sud": [105.0 + i for i in range(periods)],
        },
        index=idx,
    )
    df.index.name = "date"
    df["national_avg"] = df[["nord", "sahel", "centre_et_sud"]].mean(axis=1)
    df["series"] = series_name
    df["unit"] = "TND/head"
    return df


def _make_fodder_df(series_name: str, start: str = "2008-01-01", periods: int = 12) -> pd.DataFrame:
    """Return a minimal wide-format fodder DataFrame (unit TND/bale)."""
    idx = pd.date_range(start=start, periods=periods, freq="MS")
    df = pd.DataFrame(
        {
            "nord": [10.0 + i * 0.5 for i in range(periods)],
            "sahel": [11.0 + i * 0.5 for i in range(periods)],
            "centre_et_sud": [9.0 + i * 0.5 for i in range(periods)],
        },
        index=idx,
    )
    df.index.name = "date"
    df["national_avg"] = df[["nord", "sahel", "centre_et_sud"]].mean(axis=1)
    df["series"] = series_name
    df["unit"] = "TND/bale"
    return df


def _make_meat_df(start: str = "2008-01-01", periods: int = 12) -> pd.DataFrame:
    """Return a minimal wide-format meat DataFrame."""
    idx = pd.date_range(start=start, periods=periods, freq="MS")
    species = ["taurillon_maigre", "taurillon_engraisse", "agneau", "antenais", "caprin"]
    data = {sp: [10.0 + i * 0.5 for i in range(periods)] for sp in species}
    df = pd.DataFrame(data, index=idx)
    df.index.name = "date"
    df["national_avg"] = df[species].mean(axis=1)
    df["series"] = "viandes_rouges"
    df["unit"] = "TND/kg"
    return df


# ---------------------------------------------------------------------------
# Helper — build a loader whose private _load_* methods are all patched
# ---------------------------------------------------------------------------

def _patched_loader(tmp_path: Path) -> LivestockDataLoader:
    """Return a LivestockDataLoader with all eight series pre-loaded via mocks."""
    loader = LivestockDataLoader(data_dir=tmp_path)
    loader._load_xlsx_regional = MagicMock(side_effect=[  # type: ignore[method-assign]
        _make_regional_df("brebis_suitees"),
        _make_regional_df("genisses_pleines"),
        _make_regional_df("vaches_suitees"),
    ])
    loader._load_xlsx_meat = MagicMock(return_value=_make_meat_df())  # type: ignore[method-assign]
    loader._load_xls_html = MagicMock(side_effect=[  # type: ignore[method-assign]
        _make_regional_df("bovins_suivis"),
        _make_regional_df("vaches_gestantes"),
    ])
    loader.load_fodder = MagicMock(return_value={  # type: ignore[method-assign]
        "tbn": _make_fodder_df("tbn"),
        "qrt": _make_fodder_df("qrt"),
    })
    return loader


# ---------------------------------------------------------------------------
# Tests — date parsing helpers
# ---------------------------------------------------------------------------


class TestParseFrenchDate:
    """Tests for _parse_french_date."""

    def test_french_word_month(self):
        ts = _parse_french_date(2015, "janvier")
        assert ts == pd.Timestamp("2015-01-01")

    def test_french_word_month_accented(self):
        ts = _parse_french_date(2015, "février")
        assert ts == pd.Timestamp("2015-02-01")

    def test_numeric_month_string(self):
        ts = _parse_french_date("2020", "7")
        assert ts == pd.Timestamp("2020-07-01")

    def test_float_year(self):
        ts = _parse_french_date(2010.0, "mars")
        assert ts == pd.Timestamp("2010-03-01")

    def test_unknown_month_returns_none(self):
        assert _parse_french_date(2015, "thermidor") is None

    def test_nan_year_returns_none(self):
        assert _parse_french_date(float("nan"), "janvier") is None

    def test_all_french_months_covered(self):
        """Every canonical French month name should parse without error."""
        canonical = [
            "janvier", "février", "mars", "avril", "mai", "juin",
            "juillet", "août", "septembre", "octobre", "novembre", "décembre",
        ]
        for i, name in enumerate(canonical, start=1):
            ts = _parse_french_date(2020, name)
            assert ts is not None, f"Month '{name}' failed"
            assert ts.month == i


class TestParseMslashDate:
    """Tests for _parse_mslash_date."""

    def test_standard_format(self):
        assert _parse_mslash_date("3/2015") == pd.Timestamp("2015-03-01")

    def test_day_is_one(self):
        ts = _parse_mslash_date("12/2020")
        assert ts.day == 1

    def test_invalid_string_returns_none(self):
        assert _parse_mslash_date("not-a-date") is None

    def test_missing_year_returns_none(self):
        assert _parse_mslash_date("3") is None

    def test_out_of_range_month_returns_none(self):
        assert _parse_mslash_date("13/2020") is None


# ---------------------------------------------------------------------------
# Tests — validation helpers
# ---------------------------------------------------------------------------


class TestValidateNoDuplicateDates:
    def test_raises_on_duplicates(self):
        idx = pd.DatetimeIndex(["2020-01-01", "2020-01-01", "2020-02-01"])
        df = pd.DataFrame({"nord": [1.0, 2.0, 3.0]}, index=idx)
        with pytest.raises(ValueError, match="duplicate dates"):
            _validate_no_duplicate_dates(df, "test_series")

    def test_passes_unique_dates(self):
        idx = pd.date_range("2020-01-01", periods=5, freq="MS")
        df = pd.DataFrame({"nord": range(5)}, index=idx)
        _validate_no_duplicate_dates(df, "test_series")  # should not raise


class TestValidatePricesPositive:
    def test_zero_replaced_with_nan(self):
        idx = pd.date_range("2020-01-01", periods=3, freq="MS")
        df = pd.DataFrame({"nord": [100.0, 0.0, 150.0]}, index=idx)
        _validate_prices_positive(df, "test_series")
        assert pd.isna(df.loc[df.index[1], "nord"])

    def test_negative_replaced_with_nan(self):
        idx = pd.date_range("2020-01-01", periods=3, freq="MS")
        df = pd.DataFrame({"nord": [100.0, -50.0, 150.0]}, index=idx)
        _validate_prices_positive(df, "test_series")
        assert pd.isna(df.loc[df.index[1], "nord"])

    def test_all_positive_unchanged(self):
        idx = pd.date_range("2020-01-01", periods=3, freq="MS")
        df = pd.DataFrame({"nord": [100.0, 200.0, 300.0]}, index=idx)
        _validate_prices_positive(df, "test_series")
        assert df["nord"].tolist() == [100.0, 200.0, 300.0]


# ---------------------------------------------------------------------------
# Tests — LivestockDataLoader.load_all()
# ---------------------------------------------------------------------------


class TestLoadAll:
    def test_correct_number_of_series(self, tmp_path):
        loader = _patched_loader(tmp_path)
        data = loader.load_all()
        assert len(data) == len(ALL_SERIES), (
            f"Expected {len(ALL_SERIES)} series, got {len(data)}: {list(data.keys())}"
        )

    def test_all_series_keys_present(self, tmp_path):
        loader = _patched_loader(tmp_path)
        data = loader.load_all()
        for name in ALL_SERIES:
            assert name in data, f"Series '{name}' missing from load_all() result"

    def test_date_range_starts_2008_01(self, tmp_path):
        loader = _patched_loader(tmp_path)
        data = loader.load_all()
        for name, df in data.items():
            first_date = df.index.min()
            assert first_date.year == 2008, (
                f"Series '{name}': expected start year 2008, got {first_date.year}"
            )
            assert first_date.month == 1, (
                f"Series '{name}': expected start month 1, got {first_date.month}"
            )

    def test_datetime_index(self, tmp_path):
        loader = _patched_loader(tmp_path)
        data = loader.load_all()
        for name, df in data.items():
            assert isinstance(df.index, pd.DatetimeIndex), (
                f"Series '{name}' does not have a DatetimeIndex"
            )

    def test_index_day_is_always_one(self, tmp_path):
        loader = _patched_loader(tmp_path)
        data = loader.load_all()
        for name, df in data.items():
            assert (df.index.day == 1).all(), (
                f"Series '{name}' has DatetimeIndex entries where day != 1"
            )

    def test_national_avg_no_nulls_for_complete_series(self, tmp_path):
        loader = _patched_loader(tmp_path)
        data = loader.load_all()
        for name, df in data.items():
            assert df["national_avg"].notna().all(), (
                f"Series '{name}' has NaN in national_avg"
            )

    def test_series_column_values(self, tmp_path):
        loader = _patched_loader(tmp_path)
        data = loader.load_all()
        for name, df in data.items():
            assert (df["series"] == name).all(), (
                f"'series' column value mismatch for '{name}'"
            )

    def test_unit_column_present(self, tmp_path):
        loader = _patched_loader(tmp_path)
        data = loader.load_all()
        for name, df in data.items():
            assert "unit" in df.columns, f"Series '{name}' missing 'unit' column"

    def test_livestock_unit_is_tnd_per_head(self, tmp_path):
        loader = _patched_loader(tmp_path)
        data = loader.load_all()
        _FODDER = {"tbn", "qrt"}
        livestock_series = [s for s in ALL_SERIES if s not in {"viandes_rouges"} | _FODDER]
        for name in livestock_series:
            assert data[name]["unit"].iloc[0] == "TND/head", (
                f"Series '{name}' unexpected unit: {data[name]['unit'].iloc[0]}"
            )

    def test_meat_unit_is_tnd_per_kg(self, tmp_path):
        loader = _patched_loader(tmp_path)
        data = loader.load_all()
        assert data["viandes_rouges"]["unit"].iloc[0] == "TND/kg"

    def test_missing_file_not_in_result(self, tmp_path):
        """When all real files are absent, load_all() should return empty dict."""
        loader = LivestockDataLoader(data_dir=tmp_path)  # tmp_path has no files
        data = loader.load_all()
        assert isinstance(data, dict)
        assert len(data) == 0


# ---------------------------------------------------------------------------
# Tests — LivestockDataLoader.load_livestock_panel()
# ---------------------------------------------------------------------------


class TestLoadLivestockPanel:
    def test_column_names(self, tmp_path):
        loader = _patched_loader(tmp_path)
        panel = loader.load_livestock_panel()
        assert list(panel.columns) == ["date", "series", "region", "price"]

    def test_excludes_viandes_rouges(self, tmp_path):
        loader = _patched_loader(tmp_path)
        panel = loader.load_livestock_panel()
        assert "viandes_rouges" not in panel["series"].unique()

    def test_includes_all_livestock_series(self, tmp_path):
        loader = _patched_loader(tmp_path)
        panel = loader.load_livestock_panel()
        expected = {s for s in ALL_SERIES if s != "viandes_rouges"}
        assert expected == set(panel["series"].unique())

    def test_region_values(self, tmp_path):
        loader = _patched_loader(tmp_path)
        panel = loader.load_livestock_panel()
        assert set(panel["region"].unique()).issubset(set(REGION_COLS))

    def test_no_null_prices(self, tmp_path):
        loader = _patched_loader(tmp_path)
        panel = loader.load_livestock_panel()
        assert panel["price"].notna().all()

    def test_sorted_by_date(self, tmp_path):
        loader = _patched_loader(tmp_path)
        panel = loader.load_livestock_panel()
        assert panel["date"].is_monotonic_increasing

    def test_empty_when_no_files(self, tmp_path):
        loader = LivestockDataLoader(data_dir=tmp_path)
        panel = loader.load_livestock_panel()
        assert panel.empty
        assert list(panel.columns) == ["date", "series", "region", "price"]


# ---------------------------------------------------------------------------
# Tests — LivestockDataLoader.load_meat_panel()
# ---------------------------------------------------------------------------


class TestLoadMeatPanel:
    def test_column_names(self, tmp_path):
        loader = _patched_loader(tmp_path)
        meat = loader.load_meat_panel()
        assert list(meat.columns) == ["date", "species", "price_per_kg"]

    def test_no_null_prices(self, tmp_path):
        loader = _patched_loader(tmp_path)
        meat = loader.load_meat_panel()
        assert meat["price_per_kg"].notna().all()

    def test_sorted_by_date(self, tmp_path):
        loader = _patched_loader(tmp_path)
        meat = loader.load_meat_panel()
        assert meat["date"].is_monotonic_increasing

    def test_expected_species(self, tmp_path):
        loader = _patched_loader(tmp_path)
        meat = loader.load_meat_panel()
        # All species from our synthetic DataFrame should appear
        for sp in ["taurillon_maigre", "taurillon_engraisse", "agneau", "antenais", "caprin"]:
            assert sp in meat["species"].values, f"Species '{sp}' not found in meat panel"

    def test_empty_when_no_meat_file(self, tmp_path):
        loader = LivestockDataLoader(data_dir=tmp_path)
        meat = loader.load_meat_panel()
        assert meat.empty
        assert list(meat.columns) == ["date", "species", "price_per_kg"]
