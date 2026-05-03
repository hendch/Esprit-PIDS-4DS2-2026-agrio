"""ProducePricePipeline — end-to-end forecasting pipeline for produce prices.

Orchestrates: load → clean → backtest all models → select best → forecast.

``run(product)`` returns a complete result dict with forecast, scenarios,
backtest metrics, and warnings.

Usage
-----
>>> pipeline = ProducePricePipeline()
>>> result = pipeline.run("pomme_de_terre")
>>> print(result["best_model_name"])
>>> print(result["forecast"][0])
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# Minimum non-null weeks required to attempt any model
_MIN_WEEKS = 53
# Weeks held out for final validation / backtest
_BACKTEST_HORIZON = 12


class ProducePricePipeline:
    """End-to-end pipeline: load → clean → backtest → select best → forecast.

    Parameters
    ----------
    data_dir : str or Path or None
        Passed directly to ``ProduceDataLoader``.
    horizon : int, default 12
        Forecast horizon in weeks.
    """

    def __init__(
        self,
        data_dir: str | Path | None = None,
        horizon: int = 12,
    ) -> None:
        self.data_dir = data_dir
        self.horizon = horizon

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def run(self, product: str) -> dict[str, Any]:
        """Run the full pipeline for *product* and return a result dict.

        Parameters
        ----------
        product : str
            Internal product key (e.g. ``'pomme_de_terre'``).

        Returns
        -------
        dict with keys:
            ``best_model_name``  — str: ``'seasonal_naive'``, ``'prophet'``, or ``'lgbm'``
            ``forecast``         — list[dict]: 12 rows with ``date``, ``forecast``,
                                   ``lower_80``, ``upper_80``, ``lower_95``, ``upper_95``
            ``scenarios``        — list[dict]: 12 rows with ``date``, ``optimistic``,
                                   ``baseline``, ``pessimistic``
            ``backtest_metrics`` — dict[model_name → {mae, rmse, mape, smape, mase}]
            ``warnings``         — list[str]
        """
        from app.modules.produce_prices.data.loader import ProduceDataLoader, _PRODUCT_CATEGORY
        from app.modules.produce_prices.data.cleaner import ProduceCleaner
        from app.modules.produce_prices.models.baseline import SeasonalNaiveForecaster
        from app.modules.produce_prices.models.conformal import ProduceConformalPredictor
        from app.modules.produce_prices.evaluation import metrics as M
        from app.modules.produce_prices.evaluation.backtester import ProduceBacktester

        warnings: list[str] = []

        # 1. Load data
        loader = ProduceDataLoader(data_dir=self.data_dir)
        raw_data = loader.load_all()
        if product not in raw_data:
            raise ValueError(f"Product '{product}' not found in loaded data.")

        df_raw = raw_data[product]

        # 2. Clean
        cleaner = ProduceCleaner()
        series_cleaned = cleaner.clean_series(df_raw["retail_mid"])
        series = series_cleaned.dropna()

        n_total = len(df_raw)
        n_nonnull = len(series)
        if n_nonnull < _MIN_WEEKS:
            warnings.append(
                f"Only {n_nonnull} non-NaN weeks available (need ≥ {_MIN_WEEKS}). "
                "Forecast may be unreliable."
            )

        if n_nonnull < _MIN_WEEKS:
            raise ValueError(
                f"Insufficient data for '{product}': {n_nonnull} non-NaN weeks."
            )

        nan_pct = (n_total - n_nonnull) / n_total * 100
        if nan_pct > 50:
            warnings.append(
                f"{nan_pct:.0f}% of weeks are seasonal gaps (off-season). "
                "Citrus products are only traded Oct–May."
            )

        # 3. Backtest all models
        backtester = ProduceBacktester(
            horizon=_BACKTEST_HORIZON,
            step=4,
            min_train=max(_MIN_WEEKS, n_nonnull // 2),
        )

        backtest_metrics: dict[str, dict] = {}

        # --- Seasonal Naive ---
        try:
            bt_naive = backtester.run(series, SeasonalNaiveForecaster())
            if bt_naive["folds"]:
                sm = bt_naive["summary"]
                # Compute MASE averaged across folds
                mase_vals = []
                for fold in bt_naive["folds"]:
                    train_fold = series[series.index < fold["test_start"]]
                    mase_val = M.mase(
                        fold["actual"].values,
                        fold["forecast_df"]["forecast"].values[: len(fold["actual"])],
                        train_fold.values,
                        seasonal_period=52,
                    )
                    mase_vals.append(mase_val)
                sm["mase"] = float(np.nanmean(mase_vals)) if mase_vals else float("nan")
                backtest_metrics["seasonal_naive"] = sm
        except Exception as exc:
            logger.warning("Seasonal naive backtest failed for '%s': %s", product, exc)
            warnings.append(f"seasonal_naive backtest failed: {exc}")

        # --- Prophet ---
        try:
            from app.modules.produce_prices.models.prophet_model import ProphetProduceModel

            class _ProphetWrapper:
                """Adapter so Prophet fits ProduceBacktester's _Forecaster protocol."""
                def __init__(self) -> None:
                    self._m = ProphetProduceModel()

                def fit(self, y: pd.Series) -> "_ProphetWrapper":
                    self._m.fit(y)
                    return self

                def predict(self, horizon: int, last_date: pd.Timestamp) -> pd.DataFrame:
                    return self._m.predict(horizon, last_date)

            bt_prophet = backtester.run(series, _ProphetWrapper())
            if bt_prophet["folds"]:
                sm = bt_prophet["summary"]
                mase_vals = []
                for fold in bt_prophet["folds"]:
                    train_fold = series[series.index < fold["test_start"]]
                    mase_val = M.mase(
                        fold["actual"].values,
                        fold["forecast_df"]["forecast"].values[: len(fold["actual"])],
                        train_fold.values,
                        seasonal_period=52,
                    )
                    mase_vals.append(mase_val)
                sm["mase"] = float(np.nanmean(mase_vals)) if mase_vals else float("nan")
                backtest_metrics["prophet"] = sm
        except Exception as exc:
            logger.warning("Prophet backtest failed for '%s': %s", product, exc)
            warnings.append(f"prophet backtest failed: {exc}")

        # --- LGBM (optional) ---
        try:
            import lightgbm  # noqa: F401
            from app.modules.produce_prices.models.lgbm_model import LGBMProduceModel

            class _LGBMWrapper:
                """Adapter for LGBM; needs feature-engineered DF at predict time."""
                def __init__(self) -> None:
                    from app.modules.produce_prices.features.engineering import ProduceFeatureEngineer
                    self._lgbm = LGBMProduceModel()
                    self._fe = ProduceFeatureEngineer()
                    self._product = product
                    self._df_feat: pd.DataFrame | None = None

                def fit(self, y: pd.Series) -> "_LGBMWrapper":
                    tmp = pd.DataFrame({"retail_mid": y})
                    self._df_feat = self._fe.build_full_feature_set(tmp, "retail_mid", self._product)
                    self._lgbm.fit(self._df_feat, target_col="retail_mid", product=self._product)
                    return self

                def predict(self, horizon: int, last_date: pd.Timestamp) -> pd.DataFrame:
                    assert self._df_feat is not None
                    return self._lgbm.predict(horizon, last_date, self._df_feat, "retail_mid")

            bt_lgbm = backtester.run(series, _LGBMWrapper())
            if bt_lgbm["folds"]:
                sm = bt_lgbm["summary"]
                mase_vals = []
                for fold in bt_lgbm["folds"]:
                    train_fold = series[series.index < fold["test_start"]]
                    mase_val = M.mase(
                        fold["actual"].values,
                        fold["forecast_df"]["forecast"].values[: len(fold["actual"])],
                        train_fold.values,
                        seasonal_period=52,
                    )
                    mase_vals.append(mase_val)
                sm["mase"] = float(np.nanmean(mase_vals)) if mase_vals else float("nan")
                backtest_metrics["lgbm"] = sm
        except ImportError:
            warnings.append("lgbm not available (pip install lightgbm to enable)")
        except Exception as exc:
            logger.warning("LGBM backtest failed for '%s': %s", product, exc)
            warnings.append(f"lgbm backtest failed: {exc}")

        if not backtest_metrics:
            raise RuntimeError(f"All models failed for product '{product}'.")

        # 4. Select best model by MAPE (lower is better)
        best_model_name = min(
            backtest_metrics,
            key=lambda k: backtest_metrics[k].get("mape", float("inf")),
        )

        # 5. Fit best model on full series and generate forecast
        last_date = series.index[-1]
        forecast_df = self._fit_and_forecast(
            best_model_name, series, product, last_date
        )

        # 6. Add conformal intervals on top (if enough data)
        if len(series) >= 53:
            try:
                cp = ProduceConformalPredictor()
                cp.fit(series)
                cp_df = cp.predict_with_intervals(self.horizon, last_date)
                # Override interval columns with conformal bands
                for col in ("lower_80", "upper_80", "lower_95", "upper_95"):
                    if col in cp_df.columns:
                        forecast_df[col] = cp_df[col].values
            except Exception as exc:
                logger.warning("Conformal calibration failed for '%s': %s", product, exc)

        # Clip lower bounds at zero
        for col in ("lower_80", "lower_95"):
            if col in forecast_df.columns:
                forecast_df[col] = forecast_df[col].clip(lower=0)

        # 7. Build output structures
        forecast_list = _df_to_records(forecast_df)

        scenarios_list = [
            {
                "date": row["date"],
                "optimistic": row.get("upper_95", row["forecast"]),
                "baseline": row["forecast"],
                "pessimistic": row.get("lower_95", row["forecast"]),
            }
            for row in forecast_list
        ]

        return {
            "best_model_name": best_model_name,
            "forecast": forecast_list,
            "scenarios": scenarios_list,
            "backtest_metrics": backtest_metrics,
            "warnings": warnings,
        }

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _fit_and_forecast(
        self,
        model_name: str,
        series: pd.Series,
        product: str,
        last_date: pd.Timestamp,
    ) -> pd.DataFrame:
        """Fit the named model on *series* and return a forecast DataFrame."""
        from app.modules.produce_prices.models.baseline import SeasonalNaiveForecaster

        if model_name == "seasonal_naive":
            model = SeasonalNaiveForecaster()
            model.fit(series)
            return model.predict(self.horizon, last_date)

        if model_name == "prophet":
            from app.modules.produce_prices.models.prophet_model import ProphetProduceModel
            model = ProphetProduceModel()
            model.fit(series, product)
            return model.predict(self.horizon, last_date)

        if model_name == "lgbm":
            from app.modules.produce_prices.models.lgbm_model import LGBMProduceModel
            from app.modules.produce_prices.features.engineering import ProduceFeatureEngineer
            fe = ProduceFeatureEngineer()
            df_feat = fe.build_full_feature_set(
                pd.DataFrame({"retail_mid": series}), "retail_mid", product
            )
            lgbm = LGBMProduceModel()
            lgbm.fit(df_feat, target_col="retail_mid", product=product)
            return lgbm.predict(self.horizon, last_date, df_feat, "retail_mid")

        # Fallback
        logger.warning("Unknown model '%s', falling back to seasonal_naive.", model_name)
        model = SeasonalNaiveForecaster()
        model.fit(series)
        return model.predict(self.horizon, last_date)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _df_to_records(df: pd.DataFrame) -> list[dict]:
    """Convert a forecast DataFrame to a list of serialisable dicts."""
    records = []
    for _, row in df.iterrows():
        rec: dict[str, Any] = {}
        for col, val in row.items():
            if isinstance(val, pd.Timestamp):
                rec[col] = val.strftime("%Y-%m-%d")
            elif hasattr(val, "strftime"):
                rec[col] = val.strftime("%Y-%m-%d")
            elif isinstance(val, (np.integer, np.floating)):
                rec[col] = float(val)
            else:
                rec[col] = val
        records.append(rec)
    return records
