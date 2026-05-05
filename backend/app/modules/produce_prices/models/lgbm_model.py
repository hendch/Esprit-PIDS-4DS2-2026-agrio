"""LGBMProduceModel — LightGBM wrapper for weekly produce price forecasting.

Uses lag and rolling features built by ``ProduceFeatureEngineer`` to train
a gradient-boosted tree regressor.  Prediction intervals are constructed via
quantile regression (alpha=0.10, 0.20, 0.80, 0.90).

Falls back gracefully when LightGBM is not installed.

Usage
-----
>>> model = LGBMProduceModel()
>>> model.fit(df, target_col="retail_mid", product="clementine")
>>> forecast_df = model.predict(horizon=12, last_date=df.index[-1], df=df)
"""
from __future__ import annotations

import logging

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# Feature lags to use for multi-step forecasting
_LAG_FEATURES = ["lag_1w", "lag_2w", "lag_4w", "lag_8w", "lag_13w", "lag_26w", "lag_52w"]
_CALENDAR_FEATURES = [
    "week_of_year", "month", "quarter", "week_sin", "week_cos",
    "month_sin", "month_cos", "in_season",
]
_ROLLING_FEATURES = [
    "roll_mean_4w", "roll_mean_8w", "roll_mean_13w", "roll_mean_26w",
    "roll_std_4w", "roll_std_8w",
]
_ALL_FEATURES = _LAG_FEATURES + _CALENDAR_FEATURES + _ROLLING_FEATURES


class LGBMProduceModel:
    """LightGBM regressor with quantile-based prediction intervals.

    Parameters
    ----------
    n_estimators : int, default 300
    learning_rate : float, default 0.05
    num_leaves : int, default 31
    """

    def __init__(
        self,
        n_estimators: int = 300,
        learning_rate: float = 0.05,
        num_leaves: int = 31,
    ) -> None:
        self.n_estimators = n_estimators
        self.learning_rate = learning_rate
        self.num_leaves = num_leaves
        self._models: dict[str, object] = {}  # keyed by alpha string
        self._feature_cols: list[str] = []
        self._fitted = False

    def fit(
        self,
        df: pd.DataFrame,
        target_col: str = "retail_mid",
        product: str | None = None,
    ) -> "LGBMProduceModel":
        """Fit the model on a feature-engineered weekly DataFrame.

        Parameters
        ----------
        df : pd.DataFrame
            Output of ``ProduceFeatureEngineer.build_full_feature_set()``.
        target_col : str, default 'retail_mid'
        product : str or None
            Used to build seasonal features if not already present.

        Returns
        -------
        self
        """
        try:
            import lightgbm as lgb  # lazy import
        except ImportError:
            logger.warning("LightGBM not installed. pip install lightgbm")
            return self

        from app.modules.produce_prices.features.engineering import ProduceFeatureEngineer

        # Build features if not already present
        if "lag_1w" not in df.columns:
            fe = ProduceFeatureEngineer()
            df = fe.build_full_feature_set(df, target_col=target_col, product=product)

        available = [c for c in _ALL_FEATURES if c in df.columns]
        self._feature_cols = available

        train = df[available + [target_col]].dropna()
        X = train[available].values
        y = train[target_col].values

        alphas = {"q10": 0.10, "q20": 0.20, "q80": 0.80, "q90": 0.90, "mean": None}

        for key, alpha in alphas.items():
            if alpha is None:
                params = dict(
                    objective="regression",
                    n_estimators=self.n_estimators,
                    learning_rate=self.learning_rate,
                    num_leaves=self.num_leaves,
                    verbose=-1,
                )
            else:
                params = dict(
                    objective="quantile",
                    alpha=alpha,
                    n_estimators=self.n_estimators,
                    learning_rate=self.learning_rate,
                    num_leaves=self.num_leaves,
                    verbose=-1,
                )
            model = lgb.LGBMRegressor(**params)
            model.fit(X, y)
            self._models[key] = model

        self._fitted = True
        logger.debug("LGBMProduceModel fitted on %d rows, %d features.", len(X), len(available))
        return self

    def predict(
        self,
        horizon: int,
        last_date: pd.Timestamp,
        df: pd.DataFrame,
        target_col: str = "retail_mid",
    ) -> pd.DataFrame:
        """Recursive multi-step forecast for *horizon* weeks.

        Parameters
        ----------
        horizon : int
        last_date : pd.Timestamp
        df : pd.DataFrame
            Historical DataFrame (with features) used as context for lags.
        target_col : str

        Returns
        -------
        pd.DataFrame
            Columns: ``date``, ``forecast``, ``lower_80``, ``upper_80``,
            ``lower_95``, ``upper_95``.
        """
        if not self._fitted:
            raise RuntimeError("LGBMProduceModel not fitted. Call fit() first.")

        from app.modules.produce_prices.features.engineering import ProduceFeatureEngineer

        future_dates = pd.date_range(
            start=last_date + pd.DateOffset(weeks=1),
            periods=horizon,
            freq="W-MON",
        )

        # Build a history buffer to compute rolling/lag features recursively
        history = df[target_col].copy()
        fe = ProduceFeatureEngineer()

        forecasts = []
        q10_preds, q20_preds, q80_preds, q90_preds = [], [], [], []

        for dt in future_dates:
            # Build a single-row DataFrame for this future date
            all_data = pd.concat([history, pd.Series([np.nan], index=[dt])])
            tmp = pd.DataFrame({target_col: all_data})
            tmp.index = pd.DatetimeIndex(tmp.index)
            fe.add_lag_features(tmp, target_col)
            fe.add_rolling_features(tmp, target_col)
            fe.add_calendar_features(tmp)
            fe.add_seasonal_indicators(tmp, "unknown")  # approximate

            row = tmp.loc[[dt]]
            available = [c for c in self._feature_cols if c in row.columns]
            X_pred = row[available].fillna(0).values

            yhat = float(self._models["mean"].predict(X_pred)[0])
            forecasts.append(max(yhat, 0.0))
            q10_preds.append(max(float(self._models["q10"].predict(X_pred)[0]), 0.0))
            q20_preds.append(max(float(self._models["q20"].predict(X_pred)[0]), 0.0))
            q80_preds.append(max(float(self._models["q80"].predict(X_pred)[0]), 0.0))
            q90_preds.append(max(float(self._models["q90"].predict(X_pred)[0]), 0.0))

            # Append this forecast to history for next lag computation
            history = pd.concat([history, pd.Series([yhat], index=[dt])])

        return pd.DataFrame({
            "date": future_dates,
            "forecast": forecasts,
            "lower_80": q20_preds,
            "upper_80": q80_preds,
            "lower_95": q10_preds,
            "upper_95": q90_preds,
        })
