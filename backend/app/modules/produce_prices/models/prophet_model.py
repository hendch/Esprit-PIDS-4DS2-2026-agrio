"""ProphetProduceModel — Facebook Prophet wrapper for weekly produce price forecasting.

Wraps ``prophet.Prophet`` with weekly seasonality for Tunisian produce prices.
Falls back gracefully when Prophet is not installed.

Usage
-----
>>> model = ProphetProduceModel()
>>> model.fit(price_series)
>>> df = model.predict(horizon=12, last_date=price_series.index[-1])
"""
from __future__ import annotations

import logging

import pandas as pd

logger = logging.getLogger(__name__)


class ProphetProduceModel:
    """Prophet model for weekly produce price forecasting.

    Parameters
    ----------
    yearly_seasonality : bool or int, default True
        Enable yearly seasonality.
    weekly_seasonality : bool, default False
        Weekly seasonality is generally not meaningful for already-weekly data.
    changepoint_prior_scale : float, default 0.05
        Flexibility of the trend changepoints.  Lower = smoother trend.
    seasonality_mode : {'additive', 'multiplicative'}, default 'multiplicative'
        Multiplicative better captures produce price scaling with season.
    log_transform : bool, default True
        Fit Prophet on log(y) to ensure non-negative forecasts.
    """

    def __init__(
        self,
        yearly_seasonality: bool | int = True,
        weekly_seasonality: bool = False,
        changepoint_prior_scale: float = 0.05,
        seasonality_mode: str = "multiplicative",
        log_transform: bool = True,
    ) -> None:
        self.yearly_seasonality = yearly_seasonality
        self.weekly_seasonality = weekly_seasonality
        self.changepoint_prior_scale = changepoint_prior_scale
        self.seasonality_mode = seasonality_mode
        self.log_transform = log_transform
        self._model = None
        self._fitted = False

    def fit(self, y: pd.Series, product: str | None = None) -> "ProphetProduceModel":
        """Fit Prophet on the weekly price series.

        Parameters
        ----------
        y : pd.Series
            Weekly price series with a ``DatetimeIndex``.
        product : str or None
            Product key (unused internally, accepted for interface compatibility).

        Returns
        -------
        self
        """
        try:
            from prophet import Prophet  # lazy import
        except ImportError:
            logger.warning(
                "Prophet is not installed. Install it with: pip install prophet"
            )
            self._fitted = False
            return self

        y_valid = y.dropna().astype(float)
        if len(y_valid) < 52:
            raise ValueError(
                "ProphetProduceModel.fit() requires at least 52 non-NaN observations."
            )

        if self.log_transform:
            import numpy as np
            values = pd.Series(
                np.log(y_valid.values.clip(min=1e-9)), index=y_valid.index
            )
        else:
            values = y_valid

        df_train = pd.DataFrame({
            "ds": values.index,
            "y": values.values,
        }).reset_index(drop=True)

        self._model = Prophet(
            yearly_seasonality=self.yearly_seasonality,
            weekly_seasonality=self.weekly_seasonality,
            changepoint_prior_scale=self.changepoint_prior_scale,
            seasonality_mode=self.seasonality_mode,
        )
        self._model.fit(df_train)
        self._fitted = True
        logger.debug("ProphetProduceModel fitted on %d observations.", len(y_valid))
        return self

    def predict(self, horizon: int, last_date: pd.Timestamp) -> pd.DataFrame:
        """Generate forecasts for *horizon* weeks ahead.

        Parameters
        ----------
        horizon : int
            Number of weekly steps.
        last_date : pd.Timestamp
            Last observed date.

        Returns
        -------
        pd.DataFrame
            Columns: ``date``, ``forecast``, ``lower_80``, ``upper_80``,
            ``lower_95``, ``upper_95``.
        """
        if not self._fitted or self._model is None:
            raise RuntimeError(
                "ProphetProduceModel is not fitted. Call fit() first."
            )
        if horizon < 1:
            raise ValueError(f"horizon must be ≥ 1, got {horizon}")

        import numpy as np

        future_dates = pd.date_range(
            start=last_date + pd.DateOffset(weeks=1),
            periods=horizon,
            freq="W-MON",
        )
        future_df = pd.DataFrame({"ds": future_dates})

        raw = self._model.predict(future_df)

        yhat = raw["yhat"].values
        yhat_lower = raw["yhat_lower"].values
        yhat_upper = raw["yhat_upper"].values

        if self.log_transform:
            yhat = np.exp(yhat)
            yhat_lower = np.exp(yhat_lower)
            yhat_upper = np.exp(yhat_upper)

        # Prophet gives 80% interval by default; approximate 95% by widening
        mid = yhat
        half_80 = (yhat_upper - yhat_lower) / 2.0
        half_95 = half_80 * (1.959963984540 / 1.281551565545)

        return pd.DataFrame({
            "date": future_dates,
            "forecast": np.maximum(mid, 0.0),
            "lower_80": np.maximum(mid - half_80, 0.0),
            "upper_80": np.maximum(mid + half_80, 0.0),
            "lower_95": np.maximum(mid - half_95, 0.0),
            "upper_95": np.maximum(mid + half_95, 0.0),
        })
