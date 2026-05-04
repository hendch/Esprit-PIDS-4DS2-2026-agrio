"""Tests for LivestockDataLoader using real synthetic source files.

The ``data_dir`` fixture (defined in conftest.py) writes 6 minimal Excel /
HTML-XLS files to a temporary directory so no real government data files
are required to run these tests.

Run with:
    pytest tests/test_market_prices/test_loader.py -v
"""
from __future__ import annotations

import pandas as pd
import pytest

from app.modules.market_prices.data.loader import ALL_SERIES, LivestockDataLoader


# ---------------------------------------------------------------------------
# load_all()
# ---------------------------------------------------------------------------


class TestLoadAll:
    def test_returns_dict(self, data_dir):
        loader = LivestockDataLoader(data_dir=data_dir)
        result = loader.load_all()
        assert isinstance(result, dict)

    def test_returns_all_six_series(self, data_dir):
        loader = LivestockDataLoader(data_dir=data_dir)
        result = loader.load_all()
        assert len(result) == len(ALL_SERIES), (
            f"Expected {len(ALL_SERIES)} series, got {len(result)}: {list(result.keys())}"
        )

    def test_all_series_names_present(self, data_dir):
        loader = LivestockDataLoader(data_dir=data_dir)
        result = loader.load_all()
        for name in ALL_SERIES:
            assert name in result, f"Series '{name}' missing from load_all()"

    def test_each_series_has_datetime_index(self, data_dir):
        loader = LivestockDataLoader(data_dir=data_dir)
        result = loader.load_all()
        for name, df in result.items():
            assert isinstance(df.index, pd.DatetimeIndex), (
                f"Series '{name}' index is {type(df.index).__name__}, expected DatetimeIndex"
            )

    def test_datetime_index_day_is_one(self, data_dir):
        loader = LivestockDataLoader(data_dir=data_dir)
        result = loader.load_all()
        for name, df in result.items():
            assert (df.index.day == 1).all(), (
                f"Series '{name}' has dates where day != 1"
            )

    def test_national_avg_column_present(self, data_dir):
        loader = LivestockDataLoader(data_dir=data_dir)
        result = loader.load_all()
        for name, df in result.items():
            assert "national_avg" in df.columns, (
                f"Series '{name}' is missing 'national_avg' column"
            )

    def test_national_avg_no_nan(self, data_dir):
        """For our complete synthetic files national_avg must have zero NaN."""
        loader = LivestockDataLoader(data_dir=data_dir)
        result = loader.load_all()
        for name, df in result.items():
            nan_count = df["national_avg"].isna().sum()
            assert nan_count == 0, (
                f"Series '{name}' has {nan_count} NaN(s) in national_avg"
            )

    def test_national_avg_positive(self, data_dir):
        loader = LivestockDataLoader(data_dir=data_dir)
        result = loader.load_all()
        for name, df in result.items():
            assert (df["national_avg"] > 0).all(), (
                f"Series '{name}' has non-positive national_avg values"
            )

    def test_series_column_matches_key(self, data_dir):
        loader = LivestockDataLoader(data_dir=data_dir)
        result = loader.load_all()
        for name, df in result.items():
            assert (df["series"] == name).all(), (
                f"'series' column value mismatch for '{name}'"
            )

    def test_unit_column_present(self, data_dir):
        loader = LivestockDataLoader(data_dir=data_dir)
        result = loader.load_all()
        for name, df in result.items():
            assert "unit" in df.columns, f"Series '{name}' missing 'unit' column"

    def test_regional_series_have_three_rows(self, data_dir):
        """Our synthetic files each have exactly 3 data rows."""
        loader = LivestockDataLoader(data_dir=data_dir)
        result = loader.load_all()
        for name in ("brebis_suitees", "genisses_pleines", "vaches_suitees"):
            assert len(result[name]) == 3, (
                f"Expected 3 rows for '{name}', got {len(result[name])}"
            )

    def test_empty_dir_returns_empty_dict(self, tmp_path):
        """With no source files present, load_all() must return an empty dict."""
        loader = LivestockDataLoader(data_dir=tmp_path)
        result = loader.load_all()
        assert result == {}

    def test_index_is_sorted_ascending(self, data_dir):
        loader = LivestockDataLoader(data_dir=data_dir)
        result = loader.load_all()
        for name, df in result.items():
            assert df.index.is_monotonic_increasing, (
                f"Series '{name}' index is not sorted ascending"
            )


# ---------------------------------------------------------------------------
# load_meat_panel()
# ---------------------------------------------------------------------------


class TestLoadMeatPanel:
    def test_returns_dataframe(self, data_dir):
        loader = LivestockDataLoader(data_dir=data_dir)
        meat = loader.load_meat_panel()
        assert isinstance(meat, pd.DataFrame)

    def test_has_species_column(self, data_dir):
        loader = LivestockDataLoader(data_dir=data_dir)
        meat = loader.load_meat_panel()
        assert "species" in meat.columns, (
            f"load_meat_panel() missing 'species' column; got {list(meat.columns)}"
        )

    def test_has_price_per_kg_column(self, data_dir):
        loader = LivestockDataLoader(data_dir=data_dir)
        meat = loader.load_meat_panel()
        assert "price_per_kg" in meat.columns

    def test_has_date_column(self, data_dir):
        loader = LivestockDataLoader(data_dir=data_dir)
        meat = loader.load_meat_panel()
        assert "date" in meat.columns

    def test_exact_columns(self, data_dir):
        loader = LivestockDataLoader(data_dir=data_dir)
        meat = loader.load_meat_panel()
        assert list(meat.columns) == ["date", "species", "price_per_kg"]

    def test_no_null_prices(self, data_dir):
        loader = LivestockDataLoader(data_dir=data_dir)
        meat = loader.load_meat_panel()
        assert meat["price_per_kg"].notna().all()

    def test_expected_species_present(self, data_dir):
        loader = LivestockDataLoader(data_dir=data_dir)
        meat = loader.load_meat_panel()
        expected = {"taurillon_maigre", "taurillon_engraisse", "agneau", "antenais", "caprin"}
        actual = set(meat["species"].unique())
        assert expected == actual, f"Species mismatch: expected {expected}, got {actual}"

    def test_sorted_by_date(self, data_dir):
        loader = LivestockDataLoader(data_dir=data_dir)
        meat = loader.load_meat_panel()
        assert meat["date"].is_monotonic_increasing

    def test_row_count(self, data_dir):
        """3 months × 5 species = 15 rows."""
        loader = LivestockDataLoader(data_dir=data_dir)
        meat = loader.load_meat_panel()
        assert len(meat) == 15, f"Expected 15 rows, got {len(meat)}"

    def test_empty_when_no_meat_file(self, tmp_path):
        loader = LivestockDataLoader(data_dir=tmp_path)
        meat = loader.load_meat_panel()
        assert meat.empty
        assert list(meat.columns) == ["date", "species", "price_per_kg"]


# ---------------------------------------------------------------------------
# load_livestock_panel()
# ---------------------------------------------------------------------------


class TestLoadLivestockPanel:
    def test_exact_columns(self, data_dir):
        loader = LivestockDataLoader(data_dir=data_dir)
        panel = loader.load_livestock_panel()
        assert list(panel.columns) == ["date", "series", "region", "price"]

    def test_excludes_viandes_rouges(self, data_dir):
        loader = LivestockDataLoader(data_dir=data_dir)
        panel = loader.load_livestock_panel()
        assert "viandes_rouges" not in panel["series"].unique()

    def test_includes_all_livestock_series(self, data_dir):
        loader = LivestockDataLoader(data_dir=data_dir)
        panel = loader.load_livestock_panel()
        expected = {s for s in ALL_SERIES if s != "viandes_rouges"}
        assert expected == set(panel["series"].unique())

    def test_no_null_prices(self, data_dir):
        loader = LivestockDataLoader(data_dir=data_dir)
        panel = loader.load_livestock_panel()
        assert panel["price"].notna().all()

    def test_sorted_by_date(self, data_dir):
        loader = LivestockDataLoader(data_dir=data_dir)
        panel = loader.load_livestock_panel()
        assert panel["date"].is_monotonic_increasing
