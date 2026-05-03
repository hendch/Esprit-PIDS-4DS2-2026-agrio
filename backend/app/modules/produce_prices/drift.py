"""ProducePriceDriftDetector — statistical drift detection for produce price series.

Monitors distribution shifts between a reference window and the most recent
window of observations.  Triggers a retrain flag when drift is detected.

Methods
-------
``page_hinkley``  — Page-Hinkley cumulative sum test (detects mean shift)
``ks_test``       — Kolmogorov-Smirnov two-sample test (detects distribution shift)
``detect``        — Run both tests and return a combined verdict

Usage
-----
>>> detector = ProducePriceDriftDetector(reference_weeks=52, test_weeks=8)
>>> result = detector.detect(series)
>>> if result["drift_detected"]:
...     pipeline.run()  # retrain
"""
from __future__ import annotations

import logging

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)


class ProducePriceDriftDetector:
    """Detect distribution drift in weekly produce price series.

    Parameters
    ----------
    reference_weeks : int, default 52
        Number of weeks used to build the reference (historical) distribution.
    test_weeks : int, default 8
        Number of the most recent weeks to compare against the reference.
    ph_delta : float, default 0.005
        Page-Hinkley sensitivity parameter.  Smaller = more sensitive.
    ph_lambda : float, default 50.0
        Page-Hinkley threshold.  Increase to reduce false positives.
    ks_alpha : float, default 0.05
        KS test significance level.
    """

    def __init__(
        self,
        reference_weeks: int = 52,
        test_weeks: int = 8,
        ph_delta: float = 0.005,
        ph_lambda: float = 50.0,
        ks_alpha: float = 0.05,
    ) -> None:
        self.reference_weeks = reference_weeks
        self.test_weeks = test_weeks
        self.ph_delta = ph_delta
        self.ph_lambda = ph_lambda
        self.ks_alpha = ks_alpha

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def detect(self, series: pd.Series) -> dict:
        """Run drift detection and return a combined verdict.

        Parameters
        ----------
        series : pd.Series
            Weekly price series with a ``DatetimeIndex``.  NaN values (off-season)
            are excluded before computing statistics.

        Returns
        -------
        dict with keys:
            ``drift_detected``   — bool, True if either test flags drift
            ``page_hinkley``     — dict with keys ``statistic``, ``threshold``, ``drift``
            ``ks_test``          — dict with keys ``statistic``, ``p_value``, ``drift``
            ``reference_mean``   — float
            ``test_mean``        — float
            ``pct_change``       — float, (test_mean - ref_mean) / ref_mean * 100
        """
        s = series.dropna().astype(float)
        n = len(s)

        min_required = self.reference_weeks + self.test_weeks
        if n < min_required:
            logger.info(
                "Not enough data for drift detection: %d observations, need ≥ %d",
                n,
                min_required,
            )
            return {
                "drift_detected": False,
                "page_hinkley": {"statistic": float("nan"), "threshold": self.ph_lambda, "drift": False},
                "ks_test": {"statistic": float("nan"), "p_value": float("nan"), "drift": False},
                "reference_mean": float("nan"),
                "test_mean": float("nan"),
                "pct_change": float("nan"),
            }

        reference = s.iloc[-(self.reference_weeks + self.test_weeks): -self.test_weeks]
        test = s.iloc[-self.test_weeks:]

        ref_mean = float(reference.mean())
        test_mean = float(test.mean())
        pct_change = (test_mean - ref_mean) / ref_mean * 100 if ref_mean != 0 else float("nan")

        ph_result = self._page_hinkley(reference.values, test.values)
        ks_result = self._ks_test(reference.values, test.values)

        drift_detected = ph_result["drift"] or ks_result["drift"]

        if drift_detected:
            logger.warning(
                "Drift detected: ref_mean=%.0f, test_mean=%.0f (%.1f%%); "
                "PH=%s, KS=%s",
                ref_mean,
                test_mean,
                pct_change,
                ph_result["drift"],
                ks_result["drift"],
            )
        else:
            logger.debug(
                "No drift: ref_mean=%.0f, test_mean=%.0f (%.1f%%)",
                ref_mean,
                test_mean,
                pct_change,
            )

        return {
            "drift_detected": drift_detected,
            "page_hinkley": ph_result,
            "ks_test": ks_result,
            "reference_mean": ref_mean,
            "test_mean": test_mean,
            "pct_change": pct_change,
        }

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _page_hinkley(
        self, reference: np.ndarray, test: np.ndarray
    ) -> dict:
        """Page-Hinkley test for mean shift detection."""
        ref_mean = float(np.mean(reference))
        cumsum = 0.0
        min_cumsum = 0.0

        for x in test:
            cumsum += (x - ref_mean - self.ph_delta)
            min_cumsum = min(min_cumsum, cumsum)

        ph_stat = cumsum - min_cumsum
        drift = ph_stat > self.ph_lambda

        return {
            "statistic": float(ph_stat),
            "threshold": self.ph_lambda,
            "drift": bool(drift),
        }

    def _ks_test(
        self, reference: np.ndarray, test: np.ndarray
    ) -> dict:
        """Two-sample Kolmogorov-Smirnov test."""
        try:
            from scipy import stats  # lazy import
            ks_stat, p_value = stats.ks_2samp(reference, test)
            drift = bool(p_value < self.ks_alpha)
            return {
                "statistic": float(ks_stat),
                "p_value": float(p_value),
                "drift": drift,
            }
        except ImportError:
            logger.warning("scipy not available — KS test skipped.")
            return {
                "statistic": float("nan"),
                "p_value": float("nan"),
                "drift": False,
            }
