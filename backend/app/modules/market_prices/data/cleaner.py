"""TimeSeriesCleaner — outlier detection, treatment and gap-filling for price series.

Supported methods
-----------------
detect_outliers:
    'iqr'              — rolling IQR, flag values outside Q1−3×IQR … Q3+3×IQR
    'zscore'           — rolling z-score, flag |z| > 3.5
    'isolation_forest' — sklearn IsolationForest on the raw values

treat_outliers:
    'interpolate'         — set outliers to NaN then cubic-spline interpolate
    'clip'                — winsorise to rolling 1st / 99th percentile
    'nan_then_interpolate' — alias for 'interpolate' (explicit two-step name)

fill_missing:
    'linear'       — pd.Series.interpolate(method='linear')
    'cubic'        — pd.Series.interpolate(method='cubic')
    'seasonal'     — STL decomposition, fill gaps from trend + seasonal
    'forward_fill' — forward-fill then backward-fill for leading NaNs
"""
from __future__ import annotations

import logging

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# Accepted method literals (used in docstrings and error messages only)
_OUTLIER_METHODS = ("iqr", "zscore", "isolation_forest")
_TREAT_METHODS = ("interpolate", "clip", "nan_then_interpolate")
_FILL_METHODS = ("linear", "cubic", "seasonal", "forward_fill")


class TimeSeriesCleaner:
    """Clean individual price time series and full data dictionaries.

    All public methods operate on ``pd.Series`` objects with a
    ``DatetimeIndex``.  The class is stateless — every method is pure and
    returns a new Series / dict without mutating its inputs.

    Examples
    --------
    >>> cleaner = TimeSeriesCleaner()
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
        window: int = 24,
    ) -> pd.Series:
        """Return a boolean mask where *True* marks suspected outlier positions.

        Parameters
        ----------
        series : pd.Series
            Numeric price series with a ``DatetimeIndex``.  NaN values are
            ignored during window calculations and never marked as outliers.
        method : {'iqr', 'zscore', 'isolation_forest'}
            Detection algorithm:

            ``'iqr'``
                Rolling inter-quartile range over *window* observations.
                A value is flagged when it falls outside
                ``[Q1 − 3×IQR,  Q3 + 3×IQR]``.  Robust to trend and level
                shifts; recommended for livestock price series.

            ``'zscore'``
                Rolling z-score over *window* observations.  A value is
                flagged when ``|z| > 3.5``.  More sensitive than IQR in
                stationary series.

            ``'isolation_forest'``
                Scikit-learn :class:`~sklearn.ensemble.IsolationForest` fit
                on the non-NaN values of the whole series (no rolling window).
                Effective for finding point anomalies in non-linear series.
                Requires ``scikit-learn`` to be installed.

        window : int, default 24
            Rolling window size in months.  Used by ``'iqr'`` and
            ``'zscore'``; ignored by ``'isolation_forest'``.

        Returns
        -------
        pd.Series
            Boolean series with the same index as *series*.  ``True`` = outlier.
            NaN positions are always ``False``.

        Raises
        ------
        ValueError
            When *method* is not one of the supported values.
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

        elif method == "isolation_forest":
            from sklearn.ensemble import IsolationForest  # lazy import

            valid = s.dropna()
            if len(valid) < 10:
                logger.warning(
                    "IsolationForest requires ≥10 non-NaN observations; "
                    "only %d found — returning empty mask",
                    len(valid),
                )
                return mask

            clf = IsolationForest(contamination=0.05, random_state=42)
            labels = clf.fit_predict(valid.values.reshape(-1, 1))
            # IsolationForest returns -1 for anomalies, +1 for inliers
            outlier_idx = valid.index[labels == -1]
            mask.loc[outlier_idx] = True

        # NaN positions must never be flagged as outliers
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
    ) -> pd.Series:
        """Replace values flagged by *mask* and return the treated series.

        Parameters
        ----------
        series : pd.Series
            Original numeric series.
        mask : pd.Series
            Boolean mask produced by :meth:`detect_outliers`.  ``True``
            positions are treated.
        method : {'interpolate', 'clip', 'nan_then_interpolate'}
            Treatment strategy:

            ``'interpolate'`` / ``'nan_then_interpolate'``
                Set flagged positions to ``NaN``, then apply cubic spline
                interpolation across the gaps.  Equivalent strategies —
                ``'nan_then_interpolate'`` is provided as an explicit
                two-step alias.

            ``'clip'``
                Winsorise the whole series to the rolling 1st and 99th
                percentile (window = 36 months).  Extreme values are clipped
                to the nearest boundary rather than removed.

        Returns
        -------
        pd.Series
            Treated series with the same index as *series*.

        Raises
        ------
        ValueError
            When *method* is not one of the supported values.
        """
        if method not in _TREAT_METHODS:
            raise ValueError(f"method must be one of {_TREAT_METHODS}, got {method!r}")

        s = series.astype(float).copy()

        if method in ("interpolate", "nan_then_interpolate"):
            s[mask] = np.nan
            s = s.interpolate(method="cubic", limit_direction="both")
            # Edge NaNs that cubic cannot fill
            s = s.ffill().bfill()

        elif method == "clip":
            roll = s.rolling(36, min_periods=6, center=True)
            lower = roll.quantile(0.01)
            upper = roll.quantile(0.99)
            s = s.clip(lower=lower, upper=upper)

        return s

    # ------------------------------------------------------------------
    # Gap filling
    # ------------------------------------------------------------------

    def fill_missing(self, series: pd.Series, method: str = "linear") -> pd.Series:
        """Fill ``NaN`` values in *series* using the chosen interpolation strategy.

        Parameters
        ----------
        series : pd.Series
            Numeric series, possibly containing ``NaN`` gaps.
        method : {'linear', 'cubic', 'seasonal', 'forward_fill'}
            Fill strategy:

            ``'linear'``
                Linear interpolation between bracketing non-NaN values.
                Fast and suitable when gaps are short (1–3 months).

            ``'cubic'``
                Cubic spline interpolation.  Smoother than linear but can
                overshoot for large gaps (> 6 months).

            ``'seasonal'``
                STL (Seasonal-Trend decomposition using LOESS) decomposition.
                The trend and seasonal components estimated from the non-NaN
                observations are used to fill gaps.  Best for series with
                a strong annual seasonality (e.g. lamb prices around Eid).
                Requires ``statsmodels``.

            ``'forward_fill'``
                Carry the last valid observation forward; fill any leading
                NaNs by back-filling.

        Returns
        -------
        pd.Series
            Series with no ``NaN`` values (assuming the input contains at
            least two valid observations).

        Raises
        ------
        ValueError
            When *method* is not one of the supported values.
        """
        if method not in _FILL_METHODS:
            raise ValueError(f"method must be one of {_FILL_METHODS}, got {method!r}")

        s = series.astype(float).copy()

        if method == "linear":
            s = s.interpolate(method="linear", limit_direction="both")
            s = s.ffill().bfill()

        elif method == "cubic":
            s = s.interpolate(method="cubic", limit_direction="both")
            s = s.ffill().bfill()

        elif method == "seasonal":
            s = self._fill_seasonal(s)

        elif method == "forward_fill":
            s = s.ffill().bfill()

        return s

    # ------------------------------------------------------------------
    # Full pipeline
    # ------------------------------------------------------------------

    def clean_series(
        self,
        series: pd.Series,
        outlier_method: str = "iqr",
        fill_method: str = "cubic",
    ) -> pd.Series:
        """Apply the full cleaning pipeline to a single price series.

        Pipeline steps:

        1. **Detect** outliers with :meth:`detect_outliers` (default: IQR,
           24-month window).
        2. **Treat** outliers with :meth:`treat_outliers` (default: cubic
           interpolation).
        3. **Fill** any remaining ``NaN`` values with :meth:`fill_missing`
           (default: cubic).

        A debug-level log line is emitted reporting how many outliers were
        detected and treated.

        Parameters
        ----------
        series : pd.Series
            Raw numeric price series with ``DatetimeIndex``.
        outlier_method : {'iqr', 'zscore', 'isolation_forest'}, default 'iqr'
            Passed to :meth:`detect_outliers`.
        fill_method : {'linear', 'cubic', 'seasonal', 'forward_fill'}, default 'cubic'
            Passed to :meth:`fill_missing`.

        Returns
        -------
        pd.Series
            Cleaned series, same index as *series*, no ``NaN`` values.
        """
        mask = self.detect_outliers(series, method=outlier_method, window=24)
        n_outliers = int(mask.sum())

        treated = self.treat_outliers(series, mask, method="interpolate")
        n_remaining_nans = int(treated.isna().sum())
        filled = self.fill_missing(treated, method=fill_method)

        logger.debug(
            "clean_series '%s': %d outlier(s) detected and treated; "
            "%d NaN(s) filled by '%s'",
            getattr(series, "name", "<unnamed>"),
            n_outliers,
            n_remaining_nans,
            fill_method,
        )
        return filled

    def clean_all(
        self,
        data_dict: dict[str, pd.DataFrame],
        outlier_method: str = "iqr",
        fill_method: str = "cubic",
    ) -> dict[str, pd.DataFrame]:
        """Apply :meth:`clean_series` to the ``national_avg`` column of every DataFrame.

        Only the ``national_avg`` column is cleaned in-place; all other
        columns (region columns, ``series``, ``unit``) are copied unchanged.
        A summary log line is emitted for each series.

        Parameters
        ----------
        data_dict : dict[str, pd.DataFrame]
            Mapping returned by ``LivestockDataLoader.load_all()``.
        outlier_method : str, default 'iqr'
            Passed to :meth:`clean_series`.
        fill_method : str, default 'cubic'
            Passed to :meth:`clean_series`.

        Returns
        -------
        dict[str, pd.DataFrame]
            Same keys as *data_dict*.  Each DataFrame has a cleaned
            ``national_avg`` column; all other columns are unchanged.

        Notes
        -----
        The method logs a summary at ``INFO`` level for each series::

            Cleaned 'brebis_suitees': 3 outlier(s) treated, 1 NaN(s) filled.
        """
        cleaned: dict[str, pd.DataFrame] = {}

        for name, df in data_dict.items():
            df_clean = df.copy()

            if "national_avg" not in df_clean.columns:
                logger.warning("Series '%s' has no 'national_avg' column — skipped", name)
                cleaned[name] = df_clean
                continue

            raw_col = df_clean["national_avg"].copy()

            # Detect before treating so we can report counts
            mask = self.detect_outliers(raw_col, method=outlier_method, window=24)
            n_outliers = int(mask.sum())

            treated = self.treat_outliers(raw_col, mask, method="interpolate")
            n_nans = int(treated.isna().sum())

            df_clean["national_avg"] = self.fill_missing(treated, method=fill_method)

            logger.info(
                "Cleaned '%s': %d outlier(s) treated, %d NaN(s) filled.",
                name,
                n_outliers,
                n_nans,
            )
            cleaned[name] = df_clean

        return cleaned

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _fill_seasonal(self, s: pd.Series) -> pd.Series:
        """Fill NaN gaps using STL decomposition (trend + seasonal reconstruction).

        If ``statsmodels`` is not installed or the series is too short (< 24
        observations), falls back to cubic interpolation with a warning.

        Parameters
        ----------
        s : pd.Series
            Numeric series; may contain NaN gaps.

        Returns
        -------
        pd.Series
            Series with NaN positions replaced by ``trend + seasonal``
            estimates from STL.
        """
        try:
            from statsmodels.tsa.seasonal import STL  # lazy import
        except ImportError:
            logger.warning(
                "statsmodels not available — falling back to cubic interpolation for 'seasonal' fill"
            )
            return s.interpolate(method="cubic", limit_direction="both").ffill().bfill()

        if s.notna().sum() < 24:
            logger.warning(
                "Too few observations for STL (need ≥24, got %d) — "
                "falling back to cubic interpolation",
                s.notna().sum(),
            )
            return s.interpolate(method="cubic", limit_direction="both").ffill().bfill()

        # STL requires a complete series — pre-fill with linear interpolation
        # so it can estimate components; we then only *replace* the original NaNs.
        gap_mask = s.isna()
        s_prefilled = s.interpolate(method="linear", limit_direction="both").ffill().bfill()

        try:
            stl = STL(s_prefilled, period=12, robust=True)
            result = stl.fit()
            reconstructed = pd.Series(
                result.trend + result.seasonal, index=s.index
            )
            # Only overwrite positions that were originally NaN
            s_filled = s.copy()
            s_filled[gap_mask] = reconstructed[gap_mask]
            # Clip reconstructed values to be non-negative (prices can't go below 0)
            s_filled = s_filled.clip(lower=0)
            return s_filled
        except Exception as exc:
            logger.warning("STL decomposition failed (%s) — falling back to cubic", exc)
            return s.interpolate(method="cubic", limit_direction="both").ffill().bfill()
