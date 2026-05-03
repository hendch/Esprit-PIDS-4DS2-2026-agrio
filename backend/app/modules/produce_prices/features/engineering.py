"""ProduceFeatureEngineer — feature matrix for weekly produce price forecasting.

Builds lag, rolling, calendar, and seasonal features from weekly produce price
DataFrames.  Adapted from ``market_prices/features/engineering.py`` for weekly
(W-MON) data and citrus/vegetable seasonality patterns.

Usage
-----
>>> from app.modules.produce_prices.features.engineering import ProduceFeatureEngineer
>>> fe = ProduceFeatureEngineer()
>>> X = fe.build_full_feature_set(df, target_col="retail_mid")
"""
from __future__ import annotations

import logging
from typing import Sequence

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# Columns that should not appear in the feature matrix
_NON_FEATURE_COLS = frozenset(
    ["retail_mid", "wholesale_mid", "qte", "product", "category", "unit", "date"]
)


class ProduceFeatureEngineer:
    """Build feature matrices for Tunisian produce price forecasting.

    Every ``add_*`` method mutates *df* **in-place** and returns it for method
    chaining.  Use :meth:`build_full_feature_set` for the complete pipeline.

    Attributes
    ----------
    feature_cols_ : list[str]
        Engineered feature column names set after :meth:`build_full_feature_set`
        is called.
    """

    feature_cols_: list[str]

    # ------------------------------------------------------------------
    # Lag features
    # ------------------------------------------------------------------

    def add_lag_features(
        self,
        df: pd.DataFrame,
        target_col: str,
        lags: Sequence[int] | None = None,
    ) -> pd.DataFrame:
        """Add lagged values of *target_col* as features.

        Parameters
        ----------
        df : pd.DataFrame
            Weekly DataFrame with a ``DatetimeIndex``.
        target_col : str
            Column to lag (e.g. ``'retail_mid'``).
        lags : sequence of int, default [1, 2, 4, 8, 13, 26, 52]
            Lag values in weeks.

        Returns
        -------
        pd.DataFrame (mutated in-place)
        """
        if lags is None:
            lags = [1, 2, 4, 8, 13, 26, 52]

        for lag in lags:
            df[f"lag_{lag}w"] = df[target_col].shift(lag)

        return df

    # ------------------------------------------------------------------
    # Rolling window features
    # ------------------------------------------------------------------

    def add_rolling_features(
        self,
        df: pd.DataFrame,
        target_col: str,
        windows: Sequence[int] | None = None,
    ) -> pd.DataFrame:
        """Add rolling mean and std of *target_col*.

        Parameters
        ----------
        df : pd.DataFrame
        target_col : str
        windows : sequence of int, default [4, 8, 13, 26]
            Rolling window sizes in weeks.

        Returns
        -------
        pd.DataFrame (mutated in-place)
        """
        if windows is None:
            windows = [4, 8, 13, 26]

        for w in windows:
            roll = df[target_col].rolling(w, min_periods=max(2, w // 4))
            df[f"roll_mean_{w}w"] = roll.mean()
            df[f"roll_std_{w}w"] = roll.std(ddof=1)

        return df

    # ------------------------------------------------------------------
    # Calendar features
    # ------------------------------------------------------------------

    def add_calendar_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Add calendar-based features: week-of-year, month, quarter, year.

        Parameters
        ----------
        df : pd.DataFrame
            Must have a ``DatetimeIndex``.

        Returns
        -------
        pd.DataFrame (mutated in-place)
        """
        idx = df.index

        df["week_of_year"] = idx.isocalendar().week.astype(int)
        df["month"] = idx.month
        df["quarter"] = idx.quarter
        df["year"] = idx.year

        # Cyclical encoding of week-of-year (avoids ordinal jump from 52→1)
        df["week_sin"] = np.sin(2 * np.pi * df["week_of_year"] / 52)
        df["week_cos"] = np.cos(2 * np.pi * df["week_of_year"] / 52)

        # Cyclical encoding of month
        df["month_sin"] = np.sin(2 * np.pi * df["month"] / 12)
        df["month_cos"] = np.cos(2 * np.pi * df["month"] / 12)

        return df

    # ------------------------------------------------------------------
    # Seasonal indicators
    # ------------------------------------------------------------------

    def add_seasonal_indicators(self, df: pd.DataFrame, product: str) -> pd.DataFrame:
        """Add binary season indicators for citrus and vegetable products.

        For citrus fruits (clementine, maltaise, thomson): season is Oct–May.
        For pommes: available year-round (no binary indicator needed).
        For vegetables: season indicators based on known harvest periods.

        Parameters
        ----------
        df : pd.DataFrame
        product : str
            Internal product key (e.g. ``'clementine'``, ``'oignon'``).

        Returns
        -------
        pd.DataFrame (mutated in-place)
        """
        month = df.index.month

        citrus_products = {"clementine", "maltaise", "thomson"}
        if product in citrus_products:
            # Season: October (10) through May (5)
            df["in_season"] = ((month >= 10) | (month <= 5)).astype(int)

        elif product == "oignon":
            # Harvest: June–September
            df["in_season"] = ((month >= 6) & (month <= 9)).astype(int)

        elif product in ("piment_doux", "piment_piquant"):
            # Summer/autumn harvest: July–November
            df["in_season"] = ((month >= 7) & (month <= 11)).astype(int)

        elif product == "pomme_de_terre":
            # Spring and autumn harvests
            df["in_season"] = (
                ((month >= 3) & (month <= 5)) | ((month >= 9) & (month <= 11))
            ).astype(int)

        else:
            df["in_season"] = 1  # assume year-round

        return df

    # ------------------------------------------------------------------
    # Trend features
    # ------------------------------------------------------------------

    def add_trend_features(
        self,
        df: pd.DataFrame,
        target_col: str,
    ) -> pd.DataFrame:
        """Add week-over-week and year-over-year change features.

        Parameters
        ----------
        df : pd.DataFrame
        target_col : str

        Returns
        -------
        pd.DataFrame (mutated in-place)
        """
        df["wow_change"] = df[target_col].diff(1)
        df["yoy_change"] = df[target_col].diff(52)
        df["wow_pct"] = df[target_col].pct_change(1)
        df["yoy_pct"] = df[target_col].pct_change(52)
        return df

    # ------------------------------------------------------------------
    # Full pipeline
    # ------------------------------------------------------------------

    def build_full_feature_set(
        self,
        df: pd.DataFrame,
        target_col: str = "retail_mid",
        product: str | None = None,
    ) -> pd.DataFrame:
        """Build the complete feature matrix from a weekly produce DataFrame.

        Makes a copy of *df* before mutating, so the caller's DataFrame is
        unchanged.

        Parameters
        ----------
        df : pd.DataFrame
            Weekly produce DataFrame from ``ProduceDataLoader``.
        target_col : str, default 'retail_mid'
        product : str or None
            Product key for seasonal indicators.  If None, no season indicator
            is added.

        Returns
        -------
        pd.DataFrame
            Feature matrix (copy).  Raw price and metadata columns are
            retained alongside engineered features.
        """
        out = df.copy()

        self.add_lag_features(out, target_col)
        self.add_rolling_features(out, target_col)
        self.add_calendar_features(out)
        self.add_trend_features(out, target_col)

        if product is not None:
            self.add_seasonal_indicators(out, product)

        self.feature_cols_ = [c for c in out.columns if c not in _NON_FEATURE_COLS]

        logger.debug(
            "build_full_feature_set: %d rows × %d columns (%d features) for product='%s'",
            len(out),
            out.shape[1],
            len(self.feature_cols_),
            product,
        )
        return out

    def get_feature_names(self, df: pd.DataFrame) -> list[str]:
        """Return list of engineered feature column names (excludes raw price cols).

        Parameters
        ----------
        df : pd.DataFrame
            Output of :meth:`build_full_feature_set`.

        Returns
        -------
        list[str]
        """
        return [c for c in df.columns if c not in _NON_FEATURE_COLS]
