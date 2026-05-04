"""ProduceCleaner — outlier detection, treatment and gap-filling for weekly produce price series.

Tuned for weekly produce data with seasonal non-trading gaps (e.g. citrus
off-season).  The key difference from ``TimeSeriesCleaner`` is that seasonal
NaN blocks (longer than ``max_gap`` weeks) are deliberately preserved rather
than interpolated across.

Supported methods
-----------------
detect_outliers:
    'iqr'    — rolling IQR over *window* weeks, flag outside Q1−3×IQR … Q3+3×IQR
    'zscore' — rolling z-score, flag |z| > 3.5

treat_outliers:
    'interpolate' — set outliers to NaN then cubic-spline interpolate,
                    but only across gaps ≤ max_gap weeks.

fill_missing:
    'linear'       — linear interpolation, gaps ≤ max_gap weeks only
    'forward_fill' — forward-fill then backward-fill, gaps ≤ max_gap weeks only
"""
from __future__ import annotations

import logging

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

_OUTLIER_METHODS = ("iqr", "zscore")
_TREAT_METHODS = ("interpolate",)
_FILL_METHODS = ("linear", "forward_fill")


class ProduceCleaner:
    """Clean weekly produce price series, preserving seasonal NaN blocks.

    All public methods operate on ``pd.Series`` objects with a weekly
    ``DatetimeIndex``.  The class is stateless — every method returns a new
    Series without mutating its input.

    Examples
    --------
    >>> cleaner = ProduceCleaner()
    >>> cleaned = cleaner.clean_series(raw_series)
    >>> cleaned_dict = cleaner.clean_all(loader.load_all())
    """

    # ------------------------------------------------------------------
    # Outlier detection
    # ------------------------------------------------------------------

    def detect_outliers(
        self,
        series: pd.Series,
        method: str = "iqr",
        window: int = 12,
    ) -> pd.Series:
        """Return a boolean mask where *True* marks suspected outlier positions.

        Parameters
        ----------
        series : pd.Series
            Weekly numeric price series with a ``DatetimeIndex``.
            NaN values are ignored and never marked as outliers.
        method : {'iqr', 'zscore'}, default 'iqr'
            Detection algorithm.  ``'iqr'`` uses a rolling 12-week IQR
            (roughly 3 months); ``'zscore'`` uses rolling z-score > 3.5.
        window : int, default 12
            Rolling window in weeks.  Smaller than ``TimeSeriesCleaner``
            because weekly data resolves short-term spikes more clearly.

        Returns
        -------
        pd.Series
            Boolean series, same index as *series*.  NaN positions always ``False``.

        Raises
        ------
        ValueError
            If *method* is not supported.
        """
        if method not in _OUTLIER_METHODS:
            raise ValueError(f"method must be one of {_OUTLIER_METHODS}, got {method!r}")

        s = series.astype(float)
        mask = pd.Series(False, index=s.index, dtype=bool)
        min_periods = max(4, window // 4)

        if method == "iqr":
            roll = s.rolling(window, min_periods=min_periods, center=True)
            q1 = roll.quantile(0.25)
            q3 = roll.quantile(0.75)
            iqr = q3 - q1
            lower = q1 - 3.0 * iqr
            upper = q3 + 3.0 * iqr
            mask = (s < lower) | (s > upper)

        elif method == "zscore":
            roll = s.rolling(window, min_periods=min_periods, center=True)
            mu = roll.mean()
            sigma = roll.std(ddof=1)
            z = (s - mu) / sigma.where(sigma > 0, other=np.nan)
            mask = z.abs() > 3.5

        mask = mask.fillna(False) & s.notna()
        return mask

    # ------------------------------------------------------------------
    # Outlier treatment
    # ------------------------------------------------------------------

    def treat_outliers(
        self,
        series: pd.Series,
        mask: pd.Series,
        method: str = "interpolate",
        max_gap: int = 4,
    ) -> pd.Series:
        """Replace flagged outliers using cubic interpolation, gaps ≤ max_gap only.

        Parameters
        ----------
        series : pd.Series
            Original numeric series.
        mask : pd.Series
            Boolean mask from :meth:`detect_outliers`.
        method : {'interpolate'}, default 'interpolate'
            Currently only cubic spline interpolation is supported.
        max_gap : int, default 4
            Maximum consecutive NaN weeks to interpolate across.  Gaps larger
            than this (citrus off-season) are left as NaN.

        Returns
        -------
        pd.Series
            Treated series, same index as *series*.

        Raises
        ------
        ValueError
            If *method* is not supported.
        """
        if method not in _TREAT_METHODS:
            raise ValueError(f"method must be one of {_TREAT_METHODS}, got {method!r}")

        s = series.astype(float).copy()

        if method == "interpolate":
            s[mask] = np.nan
            s = s.interpolate(method="cubic", limit=max_gap, limit_direction="forward")

        return s

    # ------------------------------------------------------------------
    # Gap filling
    # ------------------------------------------------------------------

    def fill_missing(
        self,
        series: pd.Series,
        method: str = "linear",
        max_gap: int = 2,
    ) -> pd.Series:
        """Fill NaN gaps of at most *max_gap* consecutive weeks.

        Seasonal NaN blocks longer than *max_gap* weeks are intentionally
        left as NaN so downstream models can detect the off-season correctly.

        Parameters
        ----------
        series : pd.Series
            Numeric series, possibly containing NaN gaps.
        method : {'linear', 'forward_fill'}, default 'linear'
            Fill strategy.
        max_gap : int, default 2
            Maximum consecutive NaN weeks to fill.

        Returns
        -------
        pd.Series
            Series with short gaps filled; long seasonal gaps remain NaN.

        Raises
        ------
        ValueError
            If *method* is not supported.
        """
        if method not in _FILL_METHODS:
            raise ValueError(f"method must be one of {_FILL_METHODS}, got {method!r}")

        s = series.astype(float).copy()

        if method == "linear":
            s = s.interpolate(method="linear", limit=max_gap, limit_direction="forward")

        elif method == "forward_fill":
            s = s.ffill(limit=max_gap)

        return s

    # ------------------------------------------------------------------
    # Full pipeline
    # ------------------------------------------------------------------

    def clean_series(
        self,
        series: pd.Series,
        outlier_method: str = "iqr",
        fill_method: str = "linear",
    ) -> pd.Series:
        """Apply the full cleaning pipeline to a single weekly price series.

        Pipeline:
        1. Detect outliers (IQR, 12-week window).
        2. Treat outliers (cubic interpolation, max_gap=4 weeks).
        3. Fill remaining short gaps (linear, max_gap=2 weeks).
        Seasonal NaN blocks > 4 weeks survive all steps unchanged.

        Parameters
        ----------
        series : pd.Series
            Raw weekly price series with ``DatetimeIndex``.
        outlier_method : {'iqr', 'zscore'}, default 'iqr'
        fill_method : {'linear', 'forward_fill'}, default 'linear'

        Returns
        -------
        pd.Series
            Cleaned series.  Seasonal NaN blocks are preserved.
        """
        mask = self.detect_outliers(series, method=outlier_method, window=12)
        n_outliers = int(mask.sum())

        treated = self.treat_outliers(series, mask, method="interpolate", max_gap=4)
        n_remaining_nans = int(treated.isna().sum())
        filled = self.fill_missing(treated, method=fill_method, max_gap=2)

        logger.debug(
            "clean_series '%s': %d outlier(s) treated; %d NaN(s) after treatment, "
            "%d after fill (seasonal blocks preserved)",
            getattr(series, "name", "<unnamed>"),
            n_outliers,
            n_remaining_nans,
            int(filled.isna().sum()),
        )
        return filled

    def clean_all(
        self,
        data_dict: dict[str, pd.DataFrame],
        outlier_method: str = "iqr",
        fill_method: str = "linear",
    ) -> dict[str, pd.DataFrame]:
        """Apply :meth:`clean_series` to ``retail_mid`` of every DataFrame.

        Parameters
        ----------
        data_dict : dict[str, pd.DataFrame]
            Mapping returned by ``ProduceDataLoader.load_all()``.
        outlier_method : str, default 'iqr'
        fill_method : str, default 'linear'

        Returns
        -------
        dict[str, pd.DataFrame]
            Same keys as *data_dict*.  Each DataFrame has a cleaned
            ``retail_mid`` and ``wholesale_mid`` column; all other columns
            are unchanged.
        """
        cleaned: dict[str, pd.DataFrame] = {}

        for name, df in data_dict.items():
            df_clean = df.copy()

            for col in ("retail_mid", "wholesale_mid"):
                if col not in df_clean.columns:
                    logger.warning("Series '%s' has no '%s' column — skipped", name, col)
                    continue

                raw_col = df_clean[col].copy()
                mask = self.detect_outliers(raw_col, method=outlier_method, window=12)
                n_outliers = int(mask.sum())

                treated = self.treat_outliers(raw_col, mask, method="interpolate", max_gap=4)
                n_nans = int(treated.isna().sum())

                df_clean[col] = self.fill_missing(treated, method=fill_method, max_gap=2)

                logger.info(
                    "Cleaned '%s' [%s]: %d outlier(s) treated, %d NaN(s) after fill.",
                    name,
                    col,
                    n_outliers,
                    n_nans,
                )

            cleaned[name] = df_clean

        return cleaned
