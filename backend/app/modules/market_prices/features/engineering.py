"""FeatureEngineer — build a complete feature matrix for livestock price forecasting.

Usage
-----
>>> from app.modules.market_prices.features.engineering import FeatureEngineer
>>> from app.modules.market_prices.data.holidays import get_tunisian_holidays
>>>
>>> fe = FeatureEngineer()
>>> holidays = get_tunisian_holidays()
>>> X = fe.build_full_feature_set(price_df, target_col="national_avg", holidays_df=holidays)
>>> feature_names = get_feature_importance_names(X, target_col="national_avg")

Design notes
------------
- Every ``add_*`` method mutates *df* **in-place** (avoids repeated copies) and
  also returns *df* for convenient method-chaining.
- ``build_full_feature_set`` makes a copy before mutating so the caller's
  DataFrame is never modified.
- All methods are safe to call on a DataFrame that already contains some of
  the output columns (idempotent via column-overwrite).
"""
from __future__ import annotations

import logging
import math
from typing import Sequence

import numpy as np
import pandas as pd

from app.modules.market_prices.data.holidays import (
    EID_AL_ADHA_DATES,
    EID_AL_FITR_DATES,
    RAMADAN_START_DATES,
    get_days_to_eid,
    get_days_to_ramadan,
)

logger = logging.getLogger(__name__)

# Raw price columns and identifiers that must NOT appear in the feature list
_RAW_PRICE_COLS = frozenset(
    [
        "nord",
        "sahel",
        "centre_et_sud",
        "national_avg",
        "series",
        "unit",
        "date",
    ]
)

# All species columns produced by the meat loader
_MEAT_SPECIES_COLS = frozenset(
    [
        "taurillon_maigre",
        "taurillon_engraisse",
        "agneau",
        "antenais",
        "caprin",
    ]
)


class FeatureEngineer:
    """Build feature matrices for Tunisian livestock market-price forecasting.

    Every ``add_*`` method operates **in-place** on the supplied DataFrame and
    also returns it, enabling method chaining::

        fe = FeatureEngineer()
        df = (fe
              .add_calendar_features(df)
              .add_lag_features(df, "national_avg")
              .add_trend_features(df, "national_avg"))

    For the complete pipeline use :meth:`build_full_feature_set`.
    """

    # ------------------------------------------------------------------
    # Lag features
    # ------------------------------------------------------------------

    def add_lag_features(
        self,
        df: pd.DataFrame,
        target_col: str,
        lags: Sequence[int] = (1, 2, 3, 6, 9, 12, 24),
    ) -> pd.DataFrame:
        """Add lagged values of *target_col* as new columns.

        For each lag *n* a column ``{target_col}_lag_{n}`` is added containing
        the value of *target_col* shifted *n* periods (months) into the past.

        Parameters
        ----------
        df : pd.DataFrame
            Wide-format price DataFrame with a ``DatetimeIndex``.
        target_col : str
            Column to lag (e.g. ``'national_avg'``).
        lags : sequence of int, default (1, 2, 3, 6, 9, 12, 24)
            Lag periods in months.  Lag 12 captures the same month last year;
            lag 24 captures two years ago.

        Returns
        -------
        pd.DataFrame
            The same object with new lag columns added.

        Raises
        ------
        KeyError
            If *target_col* is not present in *df*.
        """
        if target_col not in df.columns:
            raise KeyError(f"Column '{target_col}' not found in DataFrame")

        for n in lags:
            df[f"{target_col}_lag_{n}"] = df[target_col].shift(n)

        logger.debug("add_lag_features: added %d lag column(s) for '%s'", len(lags), target_col)
        return df

    # ------------------------------------------------------------------
    # Rolling features
    # ------------------------------------------------------------------

    def add_rolling_features(
        self,
        df: pd.DataFrame,
        target_col: str,
        windows: Sequence[int] = (3, 6, 12),
        funcs: Sequence[str] = ("mean", "std", "min", "max"),
    ) -> pd.DataFrame:
        """Add rolling aggregate statistics plus momentum and acceleration.

        For each combination of *window* and *func* a column
        ``{target_col}_roll_{window}_{func}`` is added.

        Additional derived columns (computed from the 12-month window):

        ``rolling_cv``
            Coefficient of variation — rolling 12-month ``std / mean``.
            Captures relative price volatility.

        ``momentum``
            ``value − lag_12`` — year-over-year absolute change.

        ``acceleration``
            ``momentum − momentum.shift(1)`` — rate of change of momentum.

        Parameters
        ----------
        df : pd.DataFrame
            Wide-format price DataFrame with a ``DatetimeIndex``.
        target_col : str
            Column to aggregate.
        windows : sequence of int, default (3, 6, 12)
            Rolling window sizes in months.
        funcs : sequence of str, default ('mean', 'std', 'min', 'max')
            Aggregation functions; must be valid ``pd.Series.rolling`` method
            names.

        Returns
        -------
        pd.DataFrame
            The same object with new rolling columns added.
        """
        if target_col not in df.columns:
            raise KeyError(f"Column '{target_col}' not found in DataFrame")

        s = df[target_col].astype(float)
        n_added = 0

        for w in windows:
            roll = s.rolling(w, min_periods=1)
            for fn in funcs:
                col_name = f"{target_col}_roll_{w}_{fn}"
                df[col_name] = getattr(roll, fn)()
                n_added += 1

        # Coefficient of variation (12-month rolling)
        roll12 = s.rolling(12, min_periods=3)
        roll12_mean = roll12.mean()
        roll12_std = roll12.std()
        df["rolling_cv"] = roll12_std / roll12_mean.replace(0, np.nan)

        # Momentum: current value minus same month last year
        lag12 = s.shift(12)
        df["momentum"] = s - lag12

        # Acceleration: change in momentum from previous month
        df["acceleration"] = df["momentum"] - df["momentum"].shift(1)

        logger.debug(
            "add_rolling_features: added %d rolling + 3 derived column(s) for '%s'",
            n_added,
            target_col,
        )
        return df

    # ------------------------------------------------------------------
    # Calendar features
    # ------------------------------------------------------------------

    def add_calendar_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Add date-derived calendar features.

        All features are derived from the ``DatetimeIndex`` of *df*.

        Added columns
        -------------
        ``month``
            Integer month (1–12).
        ``quarter``
            Integer quarter (1–4).
        ``month_sin``, ``month_cos``
            Cyclical encoding of month: ``sin(2π·month/12)`` and
            ``cos(2π·month/12)``.  Ensures December and January are close in
            feature space.
        ``quarter_sin``, ``quarter_cos``
            Cyclical encoding of quarter.
        ``year``
            Calendar year (e.g. 2015).
        ``year_norm``
            ``year − 2008`` — a linear trend term anchored at the start of
            the dataset.
        ``is_q1``, ``is_q2``, ``is_q3``, ``is_q4``
            Binary quarter indicators (0/1).

        Parameters
        ----------
        df : pd.DataFrame
            DataFrame with a ``DatetimeIndex``.

        Returns
        -------
        pd.DataFrame
            The same object with calendar columns added.
        """
        if not isinstance(df.index, pd.DatetimeIndex):
            raise TypeError("DataFrame must have a DatetimeIndex")

        idx = df.index

        df["month"] = idx.month
        df["quarter"] = idx.quarter
        df["year"] = idx.year
        df["year_norm"] = idx.year - 2008

        # Cyclical month encoding
        df["month_sin"] = np.sin(2 * math.pi * idx.month / 12)
        df["month_cos"] = np.cos(2 * math.pi * idx.month / 12)

        # Cyclical quarter encoding
        df["quarter_sin"] = np.sin(2 * math.pi * idx.quarter / 4)
        df["quarter_cos"] = np.cos(2 * math.pi * idx.quarter / 4)

        # Binary quarter flags
        for q in (1, 2, 3, 4):
            df[f"is_q{q}"] = (idx.quarter == q).astype(int)

        logger.debug("add_calendar_features: added 13 calendar column(s)")
        return df

    # ------------------------------------------------------------------
    # Holiday features
    # ------------------------------------------------------------------

    def add_holiday_features(
        self,
        df: pd.DataFrame,
        holidays_df: pd.DataFrame,
    ) -> pd.DataFrame:
        """Add Islamic and national holiday proximity features.

        Uses vectorised distance calculations from
        :func:`~app.modules.market_prices.data.holidays.get_days_to_eid` and
        :func:`~app.modules.market_prices.data.holidays.get_days_to_ramadan`.

        Added columns
        -------------
        ``days_to_eid_adha``
            Signed days to the nearest Eid al-Adha (positive = upcoming,
            negative = past).  This is the most predictive calendar feature
            for lamb and sheep prices.
        ``days_to_ramadan``
            Signed days to the nearest Ramadan start.
        ``days_to_eid_fitr``
            Signed days to the nearest Eid al-Fitr.
        ``is_eid_adha_month``
            1 if the month contains an Eid al-Adha date, else 0.
        ``is_ramadan_month``
            1 if the month contains a Ramadan start date, else 0.
        ``is_pre_eid_month``
            1 if ``14 ≤ days_to_eid_adha ≤ 45`` — the peak pre-Eid buying
            window where livestock prices are most elevated.

        Parameters
        ----------
        df : pd.DataFrame
            DataFrame with a ``DatetimeIndex``.
        holidays_df : pd.DataFrame
            Output of :func:`~app.modules.market_prices.data.holidays.get_tunisian_holidays`.
            Must have columns ``date`` and ``holiday_name``.

        Returns
        -------
        pd.DataFrame
            The same object with holiday feature columns added.
        """
        if not isinstance(df.index, pd.DatetimeIndex):
            raise TypeError("DataFrame must have a DatetimeIndex")

        idx = df.index

        # --- Signed distances ---
        df["days_to_eid_adha"] = get_days_to_eid(idx).values
        df["days_to_ramadan"] = get_days_to_ramadan(idx).values

        # Eid al-Fitr distance (same pattern as Eid al-Adha)
        eid_fitr_ts = pd.to_datetime(EID_AL_FITR_DATES)
        fitr_deltas: list[int] = []
        for dt in idx:
            deltas = (eid_fitr_ts - dt).days
            future = deltas[deltas >= 0]
            fitr_deltas.append(int(future.min()) if len(future) > 0 else int(deltas.max()))
        df["days_to_eid_fitr"] = fitr_deltas

        # --- Binary month flags ---
        eid_adha_ts = pd.to_datetime(EID_AL_ADHA_DATES)
        ramadan_ts = pd.to_datetime(RAMADAN_START_DATES)

        eid_year_months = set(zip(eid_adha_ts.year, eid_adha_ts.month))
        ramadan_year_months = set(zip(ramadan_ts.year, ramadan_ts.month))

        df["is_eid_adha_month"] = [
            int((d.year, d.month) in eid_year_months) for d in idx
        ]
        df["is_ramadan_month"] = [
            int((d.year, d.month) in ramadan_year_months) for d in idx
        ]

        # Pre-Eid buying window: 14–45 days before Eid
        df["is_pre_eid_month"] = (
            (df["days_to_eid_adha"] >= 14) & (df["days_to_eid_adha"] <= 45)
        ).astype(int)

        logger.debug("add_holiday_features: added 9 holiday feature column(s)")
        return df

    # ------------------------------------------------------------------
    # Trend features
    # ------------------------------------------------------------------

    def add_trend_features(
        self,
        df: pd.DataFrame,
        target_col: str,
    ) -> pd.DataFrame:
        """Add log-transform and differencing features to capture price trends.

        These features help tree-based and linear models work with
        percentage-scale changes rather than absolute price levels, which
        vary widely across species and time.

        Added columns
        -------------
        ``log_price``
            ``log(target_col + ε)`` — log-transformed price.  Safe for zero
            or near-zero values via the small epsilon guard.
        ``log_diff_1``
            ``log_price − log_price.shift(1)`` — month-over-month log
            difference (≈ % change for small values).
        ``log_diff_12``
            ``log_price − log_price.shift(12)`` — year-over-year seasonal
            log difference.
        ``pct_change_1``
            Month-over-month percentage change (×100).
        ``pct_change_12``
            Year-over-year percentage change (×100).

        Parameters
        ----------
        df : pd.DataFrame
            DataFrame with a ``DatetimeIndex``.
        target_col : str
            Price column to transform.

        Returns
        -------
        pd.DataFrame
            The same object with trend columns added.
        """
        if target_col not in df.columns:
            raise KeyError(f"Column '{target_col}' not found in DataFrame")

        s = df[target_col].astype(float)
        eps = 1e-6  # guard against log(0)

        log_s = np.log(s + eps)
        df["log_price"] = log_s
        df["log_diff_1"] = log_s - log_s.shift(1)
        df["log_diff_12"] = log_s - log_s.shift(12)
        df["pct_change_1"] = s.pct_change(1) * 100
        df["pct_change_12"] = s.pct_change(12) * 100

        logger.debug("add_trend_features: added 5 trend column(s) for '%s'", target_col)
        return df

    # ------------------------------------------------------------------
    # Regional features
    # ------------------------------------------------------------------

    def add_regional_features(
        self,
        df: pd.DataFrame,
        region_cols: Sequence[str] = ("nord", "sahel", "centre_et_sud"),
    ) -> pd.DataFrame:
        """Add cross-regional spread and premium features.

        These features capture regional price dispersion, which reflects
        local supply shocks (e.g. drought in the Sahel) or transport-cost
        effects.

        Added columns
        -------------
        ``regional_spread``
            ``max(regions) − min(regions)`` — absolute price range across
            regions in the same month.
        ``regional_cv``
            ``std(regions) / mean(regions)`` — coefficient of variation
            across regions (relative dispersion).
        ``nord_premium``
            ``nord / national_avg − 1`` — how much more (or less) expensive
            the North region is relative to the national average.
        ``sahel_premium``
            Same for the Sahel region.
        ``sud_premium``
            Same for Centre & South (``centre_et_sud`` column).

        Parameters
        ----------
        df : pd.DataFrame
            DataFrame that must contain the columns listed in *region_cols*
            and a ``national_avg`` column.
        region_cols : sequence of str
            Regional price columns.  Defaults to the three standard Tunisian
            regions.

        Returns
        -------
        pd.DataFrame
            The same object with regional feature columns added.

        Notes
        -----
        Missing region columns are silently skipped so the method degrades
        gracefully for meat-price DataFrames that lack regional breakdowns.
        """
        available = [c for c in region_cols if c in df.columns]
        if not available:
            logger.debug("add_regional_features: no region columns found — skipped")
            return df

        region_data = df[available].astype(float)

        df["regional_spread"] = region_data.max(axis=1) - region_data.min(axis=1)
        row_mean = region_data.mean(axis=1)
        row_std = region_data.std(axis=1, ddof=1)
        df["regional_cv"] = row_std / row_mean.replace(0, np.nan)

        # Per-region premium against national average
        if "national_avg" in df.columns:
            nat = df["national_avg"].astype(float).replace(0, np.nan)
            premium_map = {
                "nord": "nord_premium",
                "sahel": "sahel_premium",
                "centre_et_sud": "sud_premium",
            }
            for src_col, out_col in premium_map.items():
                if src_col in df.columns:
                    df[out_col] = df[src_col].astype(float) / nat - 1.0

        logger.debug(
            "add_regional_features: added spread/cv + premium features for %d region(s)",
            len(available),
        )
        return df

    # ------------------------------------------------------------------
    # Full pipeline
    # ------------------------------------------------------------------

    def build_full_feature_set(
        self,
        df: pd.DataFrame,
        target_col: str,
        holidays_df: pd.DataFrame,
        lags: Sequence[int] = (1, 2, 3, 6, 9, 12, 24),
        windows: Sequence[int] = (3, 6, 12),
        rolling_funcs: Sequence[str] = ("mean", "std", "min", "max"),
    ) -> pd.DataFrame:
        """Build the complete feature matrix for forecasting.

        Calls all ``add_*`` methods in sequence on a copy of *df*, then drops
        any row that contains at least one ``NaN`` (introduced by lags and
        rolling windows requiring warm-up observations).

        Pipeline order
        --------------
        1. :meth:`add_calendar_features`
        2. :meth:`add_holiday_features`
        3. :meth:`add_lag_features`
        4. :meth:`add_rolling_features`
        5. :meth:`add_trend_features`
        6. :meth:`add_regional_features`
        7. Drop rows with any ``NaN``

        Parameters
        ----------
        df : pd.DataFrame
            Wide-format price DataFrame with ``DatetimeIndex``.  Must contain
            *target_col*.  **Not mutated** — a copy is used internally.
        target_col : str
            Primary price column (e.g. ``'national_avg'``).
        holidays_df : pd.DataFrame
            Output of :func:`~app.modules.market_prices.data.holidays.get_tunisian_holidays`.
        lags : sequence of int
            Passed to :meth:`add_lag_features`.
        windows : sequence of int
            Passed to :meth:`add_rolling_features`.
        rolling_funcs : sequence of str
            Passed to :meth:`add_rolling_features`.

        Returns
        -------
        pd.DataFrame
            Complete feature matrix.  All rows are free of ``NaN``.  The
            ``DatetimeIndex`` is preserved.

        Side effects
        ------------
        Prints a human-readable summary to stdout:

        .. code-block:: text

            ── Feature Engineering Summary ──────────────────────
            Features created : 58
            Rows dropped     : 24  (warm-up period for max lag)
            Usable date range: 2010-01-01 → 2024-06-01
            ─────────────────────────────────────────────────────
        """
        work = df.copy()
        n_rows_before = len(work)

        self.add_calendar_features(work)
        self.add_holiday_features(work, holidays_df)
        self.add_lag_features(work, target_col, lags=lags)
        self.add_rolling_features(work, target_col, windows=windows, funcs=rolling_funcs)
        self.add_trend_features(work, target_col)
        self.add_regional_features(work)

        # Drop warm-up rows that have NaN from lags / rolling
        work = work.dropna()
        n_rows_after = len(work)
        n_dropped = n_rows_before - n_rows_after

        # Count feature columns (exclude raw identifiers and the target itself)
        feature_cols = get_feature_importance_names(work, target_col)
        n_features = len(feature_cols)

        date_min = work.index.min().date() if len(work) > 0 else "N/A"
        date_max = work.index.max().date() if len(work) > 0 else "N/A"

        summary = (
            "\n── Feature Engineering Summary ──────────────────────\n"
            f"  Features created : {n_features}\n"
            f"  Rows dropped     : {n_dropped}  (lag / rolling warm-up)\n"
            f"  Usable date range: {date_min} → {date_max}\n"
            "─────────────────────────────────────────────────────"
        )
        print(summary)
        logger.info(summary)

        return work


# ---------------------------------------------------------------------------
# Module-level utility
# ---------------------------------------------------------------------------


def get_feature_importance_names(
    df: pd.DataFrame,
    target_col: str = "national_avg",
) -> list[str]:
    """Return feature column names suitable for passing to a ML model.

    Excludes the target column, all raw price columns (``nord``, ``sahel``,
    ``centre_et_sud``, ``national_avg``, ``series``, ``unit``), meat species
    columns, and any column named ``'date'``.

    Parameters
    ----------
    df : pd.DataFrame
        Feature-engineered DataFrame produced by
        :meth:`FeatureEngineer.build_full_feature_set`.
    target_col : str, default ``'national_avg'``
        The column being predicted; excluded from the feature list.

    Returns
    -------
    list[str]
        Sorted list of feature column names.

    Examples
    --------
    >>> names = get_feature_importance_names(X, target_col="national_avg")
    >>> model.fit(X[names], X["national_avg"])
    """
    exclude = _RAW_PRICE_COLS | _MEAT_SPECIES_COLS | {target_col}
    return sorted(c for c in df.columns if c not in exclude)
