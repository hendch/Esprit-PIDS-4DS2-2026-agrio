"""ForecastPipeline — end-to-end load → clean → forecast → scenarios for one series.

Usage
-----
>>> from app.modules.market_prices.pipeline import ForecastPipeline
>>> result = ForecastPipeline().run("brebis_suitees", horizon=12)
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from app.modules.market_prices.data.cleaner import TimeSeriesCleaner
from app.modules.market_prices.data.loader import ALL_SERIES, LivestockDataLoader
from app.modules.market_prices.models.baseline import SeasonalNaiveForecaster
from app.modules.market_prices.models.sarima import SARIMAForecaster

logger = logging.getLogger(__name__)

# Number of Monte Carlo draws for the scenario fan
_N_SCENARIOS = 500
_SCENARIO_PERCENTILES = [10, 25, 50, 75, 90]

# Fallback data directory: check the raw/ subfolder co-located with the module
_MODULE_RAW_DIR = Path(__file__).parent / "raw"


def _resolve_data_dir() -> Path:
    """Return the first data directory that actually exists on disk."""
    try:
        from app.settings import settings  # type: ignore[import]

        settings_dir = Path(settings.market_data_dir)
        if settings_dir.exists():
            return settings_dir
    except Exception:
        pass

    if _MODULE_RAW_DIR.exists():
        return _MODULE_RAW_DIR

    # Last resort: the conventional backend/data/... path
    return Path(__file__).parents[3] / "data" / "market_prices" / "raw"


class ForecastPipeline:
    """Orchestrate data loading, cleaning, forecasting and scenario generation.

    Parameters
    ----------
    data_dir : Path or None
        Override the raw data directory.  When ``None`` the directory is
        resolved automatically (settings → module-local raw/ → default).
    """

    def __init__(self, data_dir: Path | None = None) -> None:
        self._data_dir = data_dir or _resolve_data_dir()
        self._cleaner = TimeSeriesCleaner()

    def run(
        self,
        series_name: str,
        horizon: int = 12,
        model: str = "auto",
        region: str = "national",
    ) -> dict[str, Any]:
        """Load, clean, forecast and return a complete result dict.

        Parameters
        ----------
        series_name : str
            One of the six series in :data:`~app.modules.market_prices.data.loader.ALL_SERIES`.
        horizon : int, default 12
            Forecast horizon in months.
        model : str, default ``'auto'``
            ``'sarima'`` — always use SARIMA(1,1,1)(1,1,1,12).
            ``'seasonal_naive'`` — always use SeasonalNaiveForecaster.
            ``'auto'`` — try SARIMA; fall back to SeasonalNaive on failure.
        region : str, default ``'national'``
            ``'national'`` — forecast the national average (``national_avg`` column).
            ``'nord'``, ``'sahel'``, ``'centre_et_sud'`` — forecast the named region.
            Regional breakdown is not available for ``'viandes_rouges'``.

        Returns
        -------
        dict
            Keys: ``series_name``, ``region``, ``generated_at``, ``best_model_name``,
            ``model_used``, ``horizon``, ``backtest_metrics``, ``warnings``,
            ``forecast``, ``scenarios``, ``history_rows``.
            On unsupported region: ``{'error': str, 'region': region}``.

        Raises
        ------
        ValueError
            If *series_name* is not a valid series name, or *region* is not one of
            the four accepted values.
        RuntimeError
            If no data files are found for the series.
        """
        _VALID_REGIONS = {"national", "nord", "sahel", "centre_et_sud"}
        if series_name not in ALL_SERIES:
            raise ValueError(
                f"Unknown series '{series_name}'. Valid options: {list(ALL_SERIES)}"
            )
        if region not in _VALID_REGIONS:
            raise ValueError(
                f"Unknown region '{region}'. Valid options: {sorted(_VALID_REGIONS)}"
            )

        # viandes_rouges has no per-region breakdown in the source files
        if series_name == "viandes_rouges" and region != "national":
            return {
                "error": "viandes_rouges has no regional breakdown",
                "region": region,
            }

        # --- Load & clean ---
        loader = LivestockDataLoader(data_dir=self._data_dir)
        all_data = loader.load_all()

        if series_name not in all_data:
            raise RuntimeError(
                f"No data found for series '{series_name}' in {self._data_dir}. "
                "Ensure the raw Excel files are present."
            )

        df = all_data[series_name]

        # Select the right column — regional column may not exist for all series
        col = "national_avg" if region == "national" else region
        if col not in df.columns:
            return {
                "error": f"Series '{series_name}' has no data for region '{region}'",
                "region": region,
            }

        price_series = df[col].dropna().astype(float)
        price_series = self._cleaner.clean_series(price_series)

        if len(price_series) < 24:
            raise RuntimeError(
                f"Series '{series_name}' ({region}) has only {len(price_series)} "
                "observations after cleaning — need ≥ 24 for forecasting."
            )

        last_date = price_series.index[-1]

        # --- Backtest both models, collect warnings, pick best ---
        backtest_metrics, warnings = self._backtest_metrics(price_series)
        best_model_name = self._pick_best_model(backtest_metrics)

        # --- Fit forecaster (honour explicit model arg or use best) ---
        effective_model = model if model != "auto" else best_model_name
        forecast_df, model_used = self._fit_and_forecast(
            price_series, horizon, effective_model, last_date
        )

        # --- Monte Carlo scenarios ---
        scenarios = self._generate_scenarios(
            price_series, horizon, last_date, model_used
        )

        # --- Build history rows for bulk_upsert (only for national runs) ---
        history_rows = self._build_history_rows(df, series_name) if region == "national" else []

        result: dict[str, Any] = {
            "series_name": series_name,
            "region": region,
            "generated_at": datetime.now(tz=timezone.utc).isoformat(),
            "best_model_name": best_model_name,
            "model_used": model_used,
            "horizon": horizon,
            "backtest_metrics": backtest_metrics,
            "warnings": warnings,
            "forecast": forecast_df.to_dict(orient="records"),
            "scenarios": scenarios,
            "history_rows": history_rows,
        }
        return result

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _fit_and_forecast(
        self,
        series: pd.Series,
        horizon: int,
        model: str,
        last_date: pd.Timestamp,
    ) -> tuple[pd.DataFrame, str]:
        """Fit the requested model and return (forecast_df, model_name_used)."""
        if model in ("sarima", "auto"):
            try:
                forecaster = SARIMAForecaster(
                    order=(1, 1, 1), seasonal_order=(1, 1, 1, 12)
                )
                forecaster.fit(series)
                fc_df = forecaster.predict(horizon=horizon, last_date=last_date)
                # Convert date column to ISO string for JSON serialisation
                fc_df["date"] = fc_df["date"].dt.strftime("%Y-%m-%d")
                return fc_df, "sarima"
            except Exception as exc:
                if model == "sarima":
                    raise
                logger.warning(
                    "SARIMA failed for '%s' (%s) — falling back to seasonal_naive",
                    series.name,
                    exc,
                )

        # SeasonalNaive fallback / explicit choice
        forecaster = SeasonalNaiveForecaster()
        forecaster.fit(series)
        fc_df = forecaster.predict(horizon=horizon, last_date=last_date)
        fc_df["date"] = fc_df["date"].dt.strftime("%Y-%m-%d")
        return fc_df, "seasonal_naive"

    def _generate_scenarios(
        self,
        series: pd.Series,
        horizon: int,
        last_date: pd.Timestamp,
        model_used: str,
    ) -> list[dict[str, Any]]:
        """Generate Monte Carlo scenario fan by sampling from residual distribution.

        Uses the fitted SeasonalNaive to get per-month sigma, then draws
        ``_N_SCENARIOS`` paths and summarises at each horizon step.
        """
        try:
            forecaster = SeasonalNaiveForecaster()
            forecaster.fit(series)
            fc_df = forecaster.predict(horizon=horizon, last_date=last_date)
        except Exception:
            return []

        rng = np.random.default_rng(42)
        dates = pd.date_range(
            start=last_date + pd.DateOffset(months=1), periods=horizon, freq="MS"
        )

        scenarios: list[dict[str, Any]] = []
        for i, (dt, row) in enumerate(zip(dates, fc_df.itertuples())):
            sigma = (row.upper_95 - row.lower_95) / (2 * 1.96)
            draws = rng.normal(loc=row.forecast, scale=max(sigma, 0.01), size=_N_SCENARIOS)
            pcts = np.percentile(draws, _SCENARIO_PERCENTILES)
            scenarios.append(
                {
                    "date": dt.strftime("%Y-%m-%d"),
                    "p10": round(float(pcts[0]), 2),
                    "p25": round(float(pcts[1]), 2),
                    "p50": round(float(pcts[2]), 2),
                    "p75": round(float(pcts[3]), 2),
                    "p90": round(float(pcts[4]), 2),
                    "mean": round(float(draws.mean()), 2),
                }
            )
        return scenarios

    def _backtest_metrics(
        self,
        series: pd.Series,
        n_test: int = 12,
    ) -> tuple[dict[str, dict], list[str]]:
        """Hold-out backtest for SeasonalNaive and SARIMA.

        Reserves the last *n_test* months as a test set, fits each model on
        the remaining training data, computes MAPE and MASE on the test set.

        Returns
        -------
        tuple[dict, list]
            ``(metrics, warnings)`` where *metrics* maps model name →
            ``{'mape': float, 'mase': float, 'mae': float}`` and *warnings*
            is a list of human-readable strings for any failures.
        """
        pipeline_warnings: list[str] = []
        metrics: dict[str, dict] = {}

        # Shrink test window if series is short
        n_test = min(n_test, max(6, len(series) - 24))
        train = series.iloc[:-n_test]
        test = series.iloc[-n_test:]
        last_train_date = train.index[-1]

        # MASE denominator: mean absolute seasonal-naive error on training set
        seasonal_lag = 12
        if len(train) > seasonal_lag:
            naive_errors = (
                train.iloc[seasonal_lag:].values
                - train.iloc[:-seasonal_lag].values
            )
            mase_denom = float(np.mean(np.abs(naive_errors)))
        else:
            mase_denom = 1.0

        def _compute(forecasts: np.ndarray, actuals: np.ndarray) -> dict[str, Any]:
            mae = float(np.mean(np.abs(actuals - forecasts)))
            nonzero = actuals != 0
            mape = (
                float(np.mean(np.abs((actuals[nonzero] - forecasts[nonzero]) / actuals[nonzero])) * 100)
                if nonzero.any()
                else float("inf")
            )
            mase = mae / mase_denom if mase_denom > 0 else float("inf")
            return {
                "mape": round(mape, 2),
                "mase": round(mase, 4),
                "mae": round(mae, 2),
            }

        # --- SeasonalNaive ---
        try:
            sn = SeasonalNaiveForecaster()
            sn.fit(train)
            fc_df = sn.predict(horizon=n_test, last_date=last_train_date)
            metrics["seasonal_naive"] = _compute(fc_df["forecast"].values, test.values)
        except Exception as exc:
            pipeline_warnings.append(f"SeasonalNaive backtest failed: {exc}")
            metrics["seasonal_naive"] = {"mape": None, "mase": None, "mae": None}

        # --- SARIMA ---
        try:
            sarima = SARIMAForecaster(order=(1, 1, 1), seasonal_order=(1, 1, 1, 12))
            sarima.fit(train)
            fc_df = sarima.predict(horizon=n_test, last_date=last_train_date)
            metrics["sarima"] = _compute(fc_df["forecast"].values, test.values)
        except Exception as exc:
            pipeline_warnings.append(f"SARIMA backtest failed: {exc}")
            metrics["sarima"] = {"mape": None, "mase": None, "mae": None}

        return metrics, pipeline_warnings

    @staticmethod
    def _pick_best_model(backtest_metrics: dict[str, dict]) -> str:
        """Return the model name with the lowest MAPE (ignoring None values)."""
        best_name = "seasonal_naive"
        best_mape = float("inf")
        for name, m in backtest_metrics.items():
            mape = m.get("mape")
            if mape is not None and mape < best_mape:
                best_mape = mape
                best_name = name
        return best_name

    def _build_history_rows(
        self, df: pd.DataFrame, series_name: str
    ) -> list[dict[str, Any]]:
        """Convert wide DataFrame to list of dicts for bulk_upsert_history."""
        region_map = {
            "nord": "nord",
            "sahel": "sahel",
            "centre_et_sud": "centre_et_sud",
            "national_avg": "national",
        }
        rows: list[dict[str, Any]] = []
        for col, region in region_map.items():
            if col not in df.columns:
                continue
            for dt, price in df[col].dropna().items():
                rows.append(
                    {
                        "series_name": series_name,
                        "region": region,
                        "price_date": dt.date(),
                        "price": float(price),
                    }
                )
        return rows
