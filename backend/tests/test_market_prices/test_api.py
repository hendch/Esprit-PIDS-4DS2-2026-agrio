"""Integration tests for the market-prices API endpoints.

Uses httpx.AsyncClient (``async_client`` fixture from conftest.py) wired to
the FastAPI app.  The database session is replaced by an AsyncMock so no
real PostgreSQL instance is required.  The ForecastPipeline and
LivestockDataLoader are patched per-test using unittest.mock.patch.

All tests are async; pytest runs them automatically because pyproject.toml
has ``asyncio_mode = "auto"``.

Run with:
    pytest tests/test_market_prices/test_api.py -v
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# ---------------------------------------------------------------------------
# Fixed pipeline result returned by the mock ForecastPipeline.run()
# ---------------------------------------------------------------------------

_FORECAST_DATES = [
    "2026-05-01", "2026-06-01", "2026-07-01", "2026-08-01",
    "2026-09-01", "2026-10-01", "2026-11-01", "2026-12-01",
    "2027-01-01", "2027-02-01", "2027-03-01", "2027-04-01",
]

_FIXED_PIPELINE_RESULT = {
    "series_name": "brebis_suitees",
    "generated_at": "2026-04-03T00:00:00+00:00",
    "model_used": "sarima",
    "horizon": 12,
    "forecast": [
        {
            "date": d,
            "forecast": 1200.0,
            "lower_80": 1100.0,
            "upper_80": 1300.0,
            "lower_95": 1050.0,
            "upper_95": 1350.0,
        }
        for d in _FORECAST_DATES
    ],
    "scenarios": [
        {
            "date": d,
            "p10": 1100.0,
            "p25": 1150.0,
            "p50": 1200.0,
            "p75": 1250.0,
            "p90": 1300.0,
            "mean": 1200.0,
        }
        for d in _FORECAST_DATES
    ],
    # history_rows is popped by the route before saving
    "history_rows": [],
}

# A minimal SeriesInfo-compatible dict for mocking LivestockDataLoader
_MOCK_LOADER_DATA = {
    "brebis_suitees": MagicMock(
        **{
            "get": MagicMock(return_value=None),
            "__contains__": MagicMock(return_value=True),
        }
    )
}

# ---------------------------------------------------------------------------
# Helper: patch both LivestockDataLoader.load_all and ForecastPipeline
# ---------------------------------------------------------------------------


def _make_mock_loader_series():
    """Return a minimal DataFrame-like mock satisfying the /series route."""
    import pandas as pd
    import numpy as np

    idx = pd.date_range("2020-01-01", periods=24, freq="MS")
    df = pd.DataFrame(
        {
            "national_avg": np.linspace(800, 900, 24),
            "nord": np.linspace(810, 910, 24),
            "sahel": np.linspace(790, 890, 24),
            "centre_et_sud": np.linspace(785, 885, 24),
            "series": "brebis_suitees",
            "unit": "TND/head",
        },
        index=idx,
    )
    return df


# ---------------------------------------------------------------------------
# GET /api/v1/market-prices/series
# ---------------------------------------------------------------------------


class TestGetSeries:
    async def test_returns_200(self, async_client):
        with patch(
            "app.api.v1.market_prices.routes.LivestockDataLoader"
        ) as MockLoader:
            MockLoader.return_value.load_all.return_value = {}
            response = await async_client.get("/api/v1/market-prices/series")
        assert response.status_code == 200

    async def test_returns_list(self, async_client):
        with patch(
            "app.api.v1.market_prices.routes.LivestockDataLoader"
        ) as MockLoader:
            MockLoader.return_value.load_all.return_value = {}
            response = await async_client.get("/api/v1/market-prices/series")
        assert isinstance(response.json(), list)

    async def test_empty_when_no_files(self, async_client):
        """With no data files, the route returns an empty list (not an error)."""
        with patch(
            "app.api.v1.market_prices.routes.LivestockDataLoader"
        ) as MockLoader:
            MockLoader.return_value.load_all.return_value = {}
            response = await async_client.get("/api/v1/market-prices/series")
        assert response.json() == []

    async def test_returns_series_info_when_data_present(self, async_client):
        mock_df = _make_mock_loader_series()
        with patch(
            "app.api.v1.market_prices.routes.LivestockDataLoader"
        ) as MockLoader:
            MockLoader.return_value.load_all.return_value = {
                "brebis_suitees": mock_df,
            }
            response = await async_client.get("/api/v1/market-prices/series")

        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        item = data[0]
        assert item["series_name"] == "brebis_suitees"
        assert "latest_price" in item
        assert "cagr_pct" in item
        assert "regions" in item

    async def test_response_schema_fields(self, async_client):
        mock_df = _make_mock_loader_series()
        with patch(
            "app.api.v1.market_prices.routes.LivestockDataLoader"
        ) as MockLoader:
            MockLoader.return_value.load_all.return_value = {
                "brebis_suitees": mock_df,
            }
            response = await async_client.get("/api/v1/market-prices/series")

        item = response.json()[0]
        for field in ("series_name", "description", "unit", "latest_date",
                      "latest_price", "cagr_pct", "regions"):
            assert field in item, f"Field '{field}' missing from SeriesInfo response"


# ---------------------------------------------------------------------------
# GET /api/v1/market-prices/series/{series_name}/history
# ---------------------------------------------------------------------------


class TestGetSeriesHistory:
    async def test_invalid_series_returns_404(self, async_client):
        response = await async_client.get(
            "/api/v1/market-prices/series/invalid_name/history"
        )
        assert response.status_code == 404

    async def test_404_body_mentions_series_name(self, async_client):
        response = await async_client.get(
            "/api/v1/market-prices/series/nonexistent_series/history"
        )
        assert "nonexistent_series" in response.json()["detail"]

    async def test_valid_series_empty_db_returns_200(self, async_client):
        # mock_db_session.execute returns scalar_one_or_none → None and
        # scalars().all() → [] by default from conftest
        response = await async_client.get(
            "/api/v1/market-prices/series/brebis_suitees/history"
        )
        assert response.status_code == 200

    async def test_valid_series_returns_list(self, async_client):
        response = await async_client.get(
            "/api/v1/market-prices/series/brebis_suitees/history"
        )
        assert isinstance(response.json(), list)

    async def test_bad_start_date_format_returns_422(self, async_client):
        response = await async_client.get(
            "/api/v1/market-prices/series/brebis_suitees/history",
            params={"start": "not-a-date"},
        )
        assert response.status_code == 422


# ---------------------------------------------------------------------------
# POST /api/v1/market-prices/forecast
# ---------------------------------------------------------------------------


class TestPostForecast:
    async def test_returns_200(self, async_client):
        with patch(
            "app.api.v1.market_prices.routes.ForecastPipeline"
        ) as MockPipeline:
            result = dict(_FIXED_PIPELINE_RESULT)
            result["history_rows"] = []
            MockPipeline.return_value.run.return_value = result
            response = await async_client.post(
                "/api/v1/market-prices/forecast",
                json={"series_name": "brebis_suitees"},
            )
        assert response.status_code == 200

    async def test_response_has_forecast_key(self, async_client):
        with patch(
            "app.api.v1.market_prices.routes.ForecastPipeline"
        ) as MockPipeline:
            result = dict(_FIXED_PIPELINE_RESULT)
            result["history_rows"] = []
            MockPipeline.return_value.run.return_value = result
            response = await async_client.post(
                "/api/v1/market-prices/forecast",
                json={"series_name": "brebis_suitees"},
            )
        assert "forecast" in response.json()

    async def test_response_schema_fields(self, async_client):
        with patch(
            "app.api.v1.market_prices.routes.ForecastPipeline"
        ) as MockPipeline:
            result = dict(_FIXED_PIPELINE_RESULT)
            result["history_rows"] = []
            MockPipeline.return_value.run.return_value = result
            response = await async_client.post(
                "/api/v1/market-prices/forecast",
                json={"series_name": "brebis_suitees"},
            )
        body = response.json()
        for field in ("series_name", "model_used", "horizon", "forecast", "scenarios"):
            assert field in body, f"Field '{field}' missing from ForecastResponse"

    async def test_forecast_is_list(self, async_client):
        with patch(
            "app.api.v1.market_prices.routes.ForecastPipeline"
        ) as MockPipeline:
            result = dict(_FIXED_PIPELINE_RESULT)
            result["history_rows"] = []
            MockPipeline.return_value.run.return_value = result
            response = await async_client.post(
                "/api/v1/market-prices/forecast",
                json={"series_name": "brebis_suitees"},
            )
        assert isinstance(response.json()["forecast"], list)

    async def test_forecast_length_matches_horizon(self, async_client):
        with patch(
            "app.api.v1.market_prices.routes.ForecastPipeline"
        ) as MockPipeline:
            result = dict(_FIXED_PIPELINE_RESULT)
            result["history_rows"] = []
            MockPipeline.return_value.run.return_value = result
            response = await async_client.post(
                "/api/v1/market-prices/forecast",
                json={"series_name": "brebis_suitees", "horizon": 12},
            )
        body = response.json()
        assert len(body["forecast"]) == body["horizon"]

    async def test_invalid_series_returns_404(self, async_client):
        response = await async_client.post(
            "/api/v1/market-prices/forecast",
            json={"series_name": "does_not_exist"},
        )
        assert response.status_code == 404

    async def test_pipeline_called_with_correct_series(self, async_client):
        with patch(
            "app.api.v1.market_prices.routes.ForecastPipeline"
        ) as MockPipeline:
            result = dict(_FIXED_PIPELINE_RESULT)
            result["history_rows"] = []
            MockPipeline.return_value.run.return_value = result
            await async_client.post(
                "/api/v1/market-prices/forecast",
                json={"series_name": "brebis_suitees", "horizon": 6},
            )
        MockPipeline.return_value.run.assert_called_once()
        call_kwargs = MockPipeline.return_value.run.call_args
        assert call_kwargs.kwargs.get("series_name") == "brebis_suitees" or \
               call_kwargs.args[0] == "brebis_suitees"

    async def test_cached_forecast_returned_without_running_pipeline(
        self, async_client, mock_db_session
    ):
        """If force_refresh=False and a cached forecast exists, pipeline is not called."""
        # Make the DB return a cached forecast record
        cached_record = MagicMock()
        cached_record.series_name = "brebis_suitees"
        cached_record.region = "national"
        cached_record.generated_at = datetime.now(tz=timezone.utc)
        cached_record.model_used = "sarima"
        cached_record.horizon = 12
        cached_record.result_json = json.dumps(
            {k: v for k, v in _FIXED_PIPELINE_RESULT.items() if k != "history_rows"}
        )
        mock_db_session.execute.return_value.scalar_one_or_none.return_value = (
            cached_record
        )

        with patch(
            "app.api.v1.market_prices.routes.ForecastPipeline"
        ) as MockPipeline:
            response = await async_client.post(
                "/api/v1/market-prices/forecast",
                json={"series_name": "brebis_suitees", "force_refresh": False},
            )
            MockPipeline.return_value.run.assert_not_called()

        assert response.status_code == 200


# ---------------------------------------------------------------------------
# POST /api/v1/market-prices/forecast/batch
# ---------------------------------------------------------------------------


class TestPostForecastBatch:
    async def test_returns_200(self, async_client):
        with patch(
            "app.api.v1.market_prices.routes.ForecastPipeline"
        ) as MockPipeline:
            MockPipeline.return_value.run.side_effect = RuntimeError("no data")
            response = await async_client.post(
                "/api/v1/market-prices/forecast/batch",
                json={"series": ["brebis_suitees"]},
            )
        assert response.status_code == 200

    async def test_returns_list(self, async_client):
        with patch(
            "app.api.v1.market_prices.routes.ForecastPipeline"
        ) as MockPipeline:
            MockPipeline.return_value.run.side_effect = RuntimeError("no data")
            response = await async_client.post(
                "/api/v1/market-prices/forecast/batch",
                json={"series": ["brebis_suitees", "vaches_suitees"]},
            )
        assert isinstance(response.json(), list)

    async def test_unknown_series_skipped(self, async_client):
        """Unknown series names are silently skipped; result list stays empty."""
        with patch(
            "app.api.v1.market_prices.routes.ForecastPipeline"
        ):
            response = await async_client.post(
                "/api/v1/market-prices/forecast/batch",
                json={"series": ["totally_fake_series"]},
            )
        assert response.status_code == 200
        assert response.json() == []

    async def test_successful_pipeline_appears_in_result(self, async_client):
        with patch(
            "app.api.v1.market_prices.routes.ForecastPipeline"
        ) as MockPipeline:
            result = dict(_FIXED_PIPELINE_RESULT)
            result["history_rows"] = []
            MockPipeline.return_value.run.return_value = result
            response = await async_client.post(
                "/api/v1/market-prices/forecast/batch",
                json={"series": ["brebis_suitees"]},
            )
        assert response.status_code == 200
        body = response.json()
        assert len(body) == 1
        assert body[0]["series_name"] == "brebis_suitees"

    async def test_failing_series_skipped_others_included(self, async_client):
        """A pipeline failure on one series must not abort the rest."""
        good_result = dict(_FIXED_PIPELINE_RESULT)
        good_result["history_rows"] = []

        def _side_effect(series_name, **kwargs):
            if series_name == "brebis_suitees":
                return good_result
            raise RuntimeError("simulated failure")

        with patch(
            "app.api.v1.market_prices.routes.ForecastPipeline"
        ) as MockPipeline:
            MockPipeline.return_value.run.side_effect = _side_effect
            response = await async_client.post(
                "/api/v1/market-prices/forecast/batch",
                json={"series": ["brebis_suitees", "vaches_suitees"]},
            )
        assert response.status_code == 200
        body = response.json()
        assert len(body) == 1
        assert body[0]["series_name"] == "brebis_suitees"

    async def test_empty_series_list_returns_empty_list(self, async_client):
        response = await async_client.post(
            "/api/v1/market-prices/forecast/batch",
            json={"series": []},
        )
        assert response.status_code == 200
        assert response.json() == []
