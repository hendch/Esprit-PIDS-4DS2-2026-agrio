"""SARIMAForecaster — seasonal ARIMA for Tunisian livestock price forecasting.

The model always operates in **log space**: prices are log-transformed before
fitting and back-transformed (via ``exp``) before returning forecasts.  This
gives multiplicative prediction intervals that are more appropriate for
price data (errors scale with price level) and ensures forecasts are always
positive.

Log-space prediction intervals are converted back to price space via the
lognormal relationship:

    lower = exp(log_forecast - z * sigma_log)
    upper = exp(log_forecast + z * sigma_log)

This means the intervals are asymmetric in price space (wider on the upper
side), which correctly reflects right-skewed price uncertainty.

Usage
-----
>>> from app.modules.market_prices.models.sarima import SARIMAForecaster
>>> model = SARIMAForecaster(order=(1, 1, 1), seasonal_order=(1, 1, 1, 12))
>>> model.fit(price_series)
>>> forecast_df = model.predict(horizon=12, last_date=price_series.index[-1])

Auto-order selection
--------------------
>>> best = model.auto_select_order(price_series, max_p=2, max_q=2, max_P=1, max_Q=1)
>>> model2 = SARIMAForecaster(**best)
>>> model2.fit(price_series)
"""
from __future__ import annotations

import itertools
import logging
import warnings
from typing import Optional

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# z-scores for symmetric prediction intervals
_Z80 = 1.281551565545
_Z95 = 1.959963984540

_EPS = 1e-6  # log(0) guard


def _log(y: pd.Series) -> pd.Series:
    """Return log-transformed series with a small epsilon guard."""
    return np.log(y.astype(float).clip(lower=_EPS))


def _exp(s: pd.Series | np.ndarray) -> np.ndarray:
    """Return exp of a series/array, clipped to avoid overflow."""
    return np.exp(np.clip(np.asarray(s, dtype=float), -50, 50))


def _future_dates(last_date: pd.Timestamp, horizon: int) -> pd.DatetimeIndex:
    """Monthly DatetimeIndex starting the month after *last_date*."""
    return pd.date_range(
        start=last_date + pd.DateOffset(months=1),
        periods=horizon,
        freq="MS",
    )


class SARIMAForecaster:
    """Seasonal ARIMA forecaster with log-price transformation.

    Wraps ``statsmodels.tsa.statespace.sarimax.SARIMAX`` and provides the
    same ``fit`` / ``predict`` interface as the baseline forecasters.

    Parameters
    ----------
    order : tuple of int, default (1, 1, 1)
        Non-seasonal ARIMA order ``(p, d, q)``.
    seasonal_order : tuple of int, default (1, 1, 1, 12)
        Seasonal order ``(P, D, Q, s)`` where ``s=12`` for monthly data.
    exog_cols : list of str or None, default None
        Names of exogenous regressor columns.  When provided, ``fit`` expects
        a matching ``exog`` DataFrame and ``predict`` expects ``exog_future``.

    Attributes
    ----------
    result_ : SARIMAXResults
        Fitted statsmodels result object (set after :meth:`fit`).
    log_resid_std_ : float
        Standard deviation of log-space residuals (set after :meth:`fit`).
    _y_log : pd.Series
        Log-transformed training series (set after :meth:`fit`).
    """

    def __init__(
        self,
        order: tuple[int, int, int] = (1, 1, 1),
        seasonal_order: tuple[int, int, int, int] = (1, 1, 1, 12),
        exog_cols: Optional[list[str]] = None,
    ) -> None:
        self.order = order
        self.seasonal_order = seasonal_order
        self.exog_cols = exog_cols

        self._fitted: bool = False
        self.result_ = None
        self.log_resid_std_: float = 0.0
        self._y_log: pd.Series | None = None

    # ------------------------------------------------------------------
    # Private guard
    # ------------------------------------------------------------------

    def _check_fitted(self, method_name: str = "predict") -> None:
        """Raise ``ValueError`` if the model has not been fitted yet.

        Parameters
        ----------
        method_name : str
            Name of the calling method, used in the error message.
        """
        if not self._fitted:
            raise ValueError(
                f"SARIMAForecaster.fit() must be called before {method_name}()."
            )

    # ------------------------------------------------------------------
    # fit
    # ------------------------------------------------------------------

    def fit(
        self,
        y: pd.Series,
        exog: Optional[pd.DataFrame] = None,
    ) -> "SARIMAForecaster":
        """Fit a SARIMA model on log-transformed prices.

        The series is log-transformed before fitting so that:

        * Forecasts are always positive (after ``exp`` back-transform).
        * Prediction intervals are multiplicative and asymmetric in price
          space, which better captures right-skewed price uncertainty.

        After fitting, prints a diagnostic summary:

        .. code-block:: text

            ── SARIMA(1,1,1)(1,1,1,12) Fit Summary ──
            AIC        : 234.12
            BIC        : 251.87
            Ljung-Box p (lag 12): 0.43   ✓ residuals look white

        Parameters
        ----------
        y : pd.Series
            Monthly price series with ``DatetimeIndex``.  Must have ≥ 36
            non-NaN observations for a seasonal model to converge reliably.
        exog : pd.DataFrame or None
            Exogenous regressors aligned with *y*'s index.  Required when
            ``exog_cols`` was set in ``__init__``.

        Returns
        -------
        self

        Raises
        ------
        ValueError
            When *y* has fewer than 24 observations or contains NaN values
            after dropping them.
        ImportError
            When ``statsmodels`` is not installed.
        """
        try:
            from statsmodels.tsa.statespace.sarimax import SARIMAX
            from statsmodels.stats.diagnostic import acorr_ljungbox
        except ImportError as exc:
            raise ImportError(
                "statsmodels is required for SARIMAForecaster. "
                "Install it with: pip install statsmodels"
            ) from exc

        y = y.dropna().astype(float)
        if len(y) < 24:
            raise ValueError(
                f"SARIMAForecaster.fit() requires ≥ 24 observations, got {len(y)}."
            )
        if not isinstance(y.index, pd.DatetimeIndex):
            raise TypeError("y must have a DatetimeIndex.")

        # Log-transform
        self._y_log = _log(y)

        # Validate / align exog
        exog_aligned: Optional[pd.DataFrame] = None
        if exog is not None:
            if self.exog_cols:
                exog_aligned = exog[self.exog_cols].loc[self._y_log.index]
            else:
                exog_aligned = exog.loc[self._y_log.index]

        # Fit SARIMAX
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            model = SARIMAX(
                self._y_log,
                order=self.order,
                seasonal_order=self.seasonal_order,
                exog=exog_aligned,
                enforce_stationarity=False,
                enforce_invertibility=False,
            )
            self.result_ = model.fit(disp=False, maxiter=200)

        # Residual std in log space
        resid = self.result_.resid.dropna()
        self.log_resid_std_ = float(resid.std(ddof=1))

        # Ljung-Box test at lag 12
        lb_lag = min(12, max(5, len(resid) // 5))
        lb_result = acorr_ljungbox(resid, lags=[lb_lag], return_df=True)
        lb_pvalue = float(lb_result["lb_pvalue"].iloc[-1])
        lb_verdict = "OK residuals look white" if lb_pvalue > 0.05 else "WARN autocorrelation detected"

        p, d, q = self.order
        P, D, Q, s = self.seasonal_order
        summary = (
            f"\n-- SARIMA({p},{d},{q})({P},{D},{Q},{s}) Fit Summary --\n"
            f"  AIC        : {self.result_.aic:.2f}\n"
            f"  BIC        : {self.result_.bic:.2f}\n"
            f"  Ljung-Box p (lag {lb_lag}): {lb_pvalue:.4f}   {lb_verdict}\n"
            f"  Log-resid sigma: {self.log_resid_std_:.6f}\n"
            "-----------------------------------------"
        )
        print(summary)
        logger.info(summary)

        self._fitted = True
        return self

    # ------------------------------------------------------------------
    # predict
    # ------------------------------------------------------------------

    def predict(
        self,
        horizon: int,
        last_date: pd.Timestamp,
        exog_future: Optional[pd.DataFrame] = None,
    ) -> pd.DataFrame:
        """Generate *horizon*-step-ahead forecasts with prediction intervals.

        Forecasts are produced in log space and back-transformed via ``exp``.
        The prediction intervals use the lognormal relationship so they are
        asymmetric in price space (the upper bound is proportionally wider
        than the lower bound).

        Parameters
        ----------
        horizon : int
            Number of months to forecast (≥ 1).
        last_date : pd.Timestamp
            Date of the last known observation; forecasts start the following
            month.
        exog_future : pd.DataFrame or None
            Future exogenous regressors for the forecast horizon.  Must have
            *horizon* rows when ``exog_cols`` was specified.

        Returns
        -------
        pd.DataFrame
            Columns: ``date``, ``forecast``, ``lower_80``, ``upper_80``,
            ``lower_95``, ``upper_95``.  All price columns are in the
            original (non-log) scale.

        Raises
        ------
        ValueError
            If ``fit()`` has not been called, or *horizon* < 1.
        """
        self._check_fitted("predict")
        if horizon < 1:
            raise ValueError(f"horizon must be ≥ 1, got {horizon}")

        # Validate exog_future
        exog_f: Optional[pd.DataFrame] = None
        if exog_future is not None and self.exog_cols:
            exog_f = exog_future[self.exog_cols]

        # Get forecast object from statsmodels
        fc = self.result_.get_forecast(steps=horizon, exog=exog_f)
        log_mean = fc.predicted_mean.values   # point forecast in log space
        log_se = fc.se_mean.values            # std error in log space (statsmodels ≥ 0.14)

        # Back-transform point forecast (lognormal median = exp(mu))
        forecast = _exp(log_mean)

        # Lognormal prediction intervals in price space
        lower_80 = _exp(log_mean - _Z80 * log_se)
        upper_80 = _exp(log_mean + _Z80 * log_se)
        lower_95 = _exp(log_mean - _Z95 * log_se)
        upper_95 = _exp(log_mean + _Z95 * log_se)

        dates = _future_dates(last_date, horizon)

        return pd.DataFrame(
            {
                "date": dates,
                "forecast": forecast,
                "lower_80": lower_80,
                "upper_80": upper_80,
                "lower_95": lower_95,
                "upper_95": upper_95,
            }
        )

    # ------------------------------------------------------------------
    # auto_select_order
    # ------------------------------------------------------------------

    def auto_select_order(
        self,
        y: pd.Series,
        max_p: int = 3,
        max_q: int = 3,
        max_P: int = 2,
        max_Q: int = 2,
    ) -> dict:
        """Grid-search SARIMA orders and return the combination with the lowest AIC.

        Fixes ``d=1``, ``D=1``, ``s=12`` (first-difference + seasonal
        first-difference, monthly seasonality) and searches over all
        combinations of ``p ∈ [0, max_p]``, ``q ∈ [0, max_q]``,
        ``P ∈ [0, max_P]``, ``Q ∈ [0, max_Q]``.

        Each candidate is fitted on the log-transformed series.  Failed fits
        (non-convergence, singular matrices, etc.) are silently skipped.

        Prints a table of the top-5 candidates by AIC:

        .. code-block:: text

            ── Auto-Order Selection (top 5 by AIC) ──
            Rank  p  d  q  P  D  Q   s      AIC
               1  1  1  1  1  1  1  12   234.12
               2  2  1  1  1  1  1  12   235.87
               ...

        Parameters
        ----------
        y : pd.Series
            Monthly price series (will be log-transformed internally).
        max_p : int, default 3
            Maximum non-seasonal AR order.
        max_q : int, default 3
            Maximum non-seasonal MA order.
        max_P : int, default 2
            Maximum seasonal AR order.
        max_Q : int, default 2
            Maximum seasonal MA order.

        Returns
        -------
        dict
            ``{'order': (p, 1, q), 'seasonal_order': (P, 1, Q, 12)}`` for
            the best (lowest-AIC) candidate.  Can be unpacked directly into
            ``SARIMAForecaster(**best)``.

        Raises
        ------
        RuntimeError
            If no candidate converges successfully.
        """
        try:
            from statsmodels.tsa.statespace.sarimax import SARIMAX
        except ImportError as exc:
            raise ImportError("statsmodels required for auto_select_order.") from exc

        y_clean = y.dropna().astype(float)
        y_log = _log(y_clean)

        candidates: list[dict] = []
        total = (max_p + 1) * (max_q + 1) * (max_P + 1) * (max_Q + 1)
        print(f"\nAuto-order search: {total} candidate(s) …")

        for p, q, P, Q in itertools.product(
            range(max_p + 1),
            range(max_q + 1),
            range(max_P + 1),
            range(max_Q + 1),
        ):
            # Skip degenerate (0,1,0)(0,1,0,12) — just a differenced series
            if p == 0 and q == 0 and P == 0 and Q == 0:
                continue
            try:
                with warnings.catch_warnings():
                    warnings.simplefilter("ignore")
                    res = SARIMAX(
                        y_log,
                        order=(p, 1, q),
                        seasonal_order=(P, 1, Q, 12),
                        enforce_stationarity=False,
                        enforce_invertibility=False,
                    ).fit(disp=False, maxiter=150)
                if np.isfinite(res.aic):
                    candidates.append(
                        {
                            "p": p, "d": 1, "q": q,
                            "P": P, "D": 1, "Q": Q, "s": 12,
                            "aic": res.aic,
                            "bic": res.bic,
                        }
                    )
            except Exception:
                continue

        if not candidates:
            raise RuntimeError(
                "auto_select_order: no SARIMA candidate converged. "
                "Try a shorter series or smaller max_p/max_q."
            )

        candidates.sort(key=lambda x: x["aic"])
        top5 = candidates[:5]

        # Print top-5 table
        header = (
            "\n-- Auto-Order Selection (top 5 by AIC) --\n"
            f"  {'Rank':>4}  {'p':>2}  {'d':>2}  {'q':>2}  "
            f"{'P':>2}  {'D':>2}  {'Q':>2}  {'s':>3}  {'AIC':>10}  {'BIC':>10}"
        )
        print(header)
        for rank, c in enumerate(top5, start=1):
            print(
                f"  {rank:>4}  {c['p']:>2}  {c['d']:>2}  {c['q']:>2}  "
                f"{c['P']:>2}  {c['D']:>2}  {c['Q']:>2}  {c['s']:>3}  "
                f"{c['aic']:>10.2f}  {c['bic']:>10.2f}"
            )
        print("-----------------------------------------")

        best = candidates[0]
        return {
            "order": (best["p"], 1, best["q"]),
            "seasonal_order": (best["P"], 1, best["Q"], 12),
        }

    # ------------------------------------------------------------------
    # get_residuals
    # ------------------------------------------------------------------

    def get_residuals(self) -> pd.Series:
        """Return the in-sample residuals from the fitted model in log space.

        The residuals are ``log(y_t) − log(ŷ_t)`` — i.e., approximate
        percentage errors in price space.  They should be white noise if the
        model is well-specified (check with the Ljung-Box p-value printed
        during :meth:`fit`).

        Returns
        -------
        pd.Series
            Residual series with the same ``DatetimeIndex`` as the training
            data.  The first few values may be ``NaN`` due to the
            differencing order.

        Raises
        ------
        ValueError
            If ``fit()`` has not been called.
        """
        self._check_fitted("get_residuals")
        return self.result_.resid.rename("log_residuals")

    # ------------------------------------------------------------------
    # Dunder helpers
    # ------------------------------------------------------------------

    def __repr__(self) -> str:
        p, d, q = self.order
        P, D, Q, s = self.seasonal_order
        fitted_str = " [fitted]" if self._fitted else " [not fitted]"
        return f"SARIMAForecaster(({p},{d},{q})({P},{D},{Q},{s})){fitted_str}"
