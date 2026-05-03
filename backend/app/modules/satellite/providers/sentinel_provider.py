from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import httpx

from app.modules.satellite.providers.interface import SatelliteProvider
from app.settings import settings


class SentinelProvider(SatelliteProvider):
    def __init__(self) -> None:
        self._client_id = settings.cdse_client_id
        self._client_secret = (
            settings.cdse_client_secret.get_secret_value()
            if settings.cdse_client_secret is not None
            else None
        )
        self._token_url = getattr(
            settings,
            "cdse_token_url",
            "https://identity.dataspace.copernicus.eu/auth/realms/CDSE/protocol/openid-connect/token",
        )
        self._statistics_url = getattr(
            settings,
            "cdse_statistics_url",
            "https://sh.dataspace.copernicus.eu/statistics/v1",
        )

    async def _get_access_token(self) -> str:
        if not self._client_id or not self._client_secret:
            raise RuntimeError(
                "Missing CDSE OAuth credentials. Set AGRIO_CDSE_CLIENT_ID and AGRIO_CDSE_CLIENT_SECRET."
            )

        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                self._token_url,
                data={
                    "grant_type": "client_credentials",
                    "client_id": self._client_id,
                    "client_secret": self._client_secret,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            response.raise_for_status()
            payload = response.json()

        access_token = payload.get("access_token")
        if not access_token:
            raise RuntimeError("CDSE token response did not include an access token.")

        return access_token

    @staticmethod
    def _to_iso(dt: datetime) -> str:
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")

    @staticmethod
    def _evalscript() -> str:
        return """
//VERSION=3
function setup() {
  return {
    input: [{
      bands: ["B04", "B08", "dataMask"]
    }],
    output: [
      {
        id: "ndvi",
        bands: 1,
        sampleType: "FLOAT32"
      },
      {
        id: "dataMask",
        bands: 1
      }
    ]
  };
}

function evaluatePixel(sample) {
  const denom = sample.B08 + sample.B04;
  const ndvi = denom === 0 ? 0 : (sample.B08 - sample.B04) / denom;

  return {
    ndvi: [ndvi],
    dataMask: [sample.dataMask]
  };
}
""".strip()

    async def fetch_imagery(self, boundary: dict, date_range: tuple) -> dict:
        start_dt, end_dt = date_range
        token = await self._get_access_token()

        body = {
            "input": {
                "bounds": {
                    "geometry": boundary,
                    "properties": {
                        "crs": "http://www.opengis.net/def/crs/EPSG/0/4326"
                    },
                },
                "data": [
                    {
                        "type": "sentinel-2-l2a",
                        "dataFilter": {
                            "mosaickingOrder": "leastCC",
                        },
                    }
                ],
            },
            "aggregation": {
                "timeRange": {
                    "from": self._to_iso(start_dt),
                    "to": self._to_iso(end_dt),
                },
                "aggregationInterval": {
                    "of": "P1D",
                },
                "evalscript": self._evalscript(),
                # IMPORTANT:
                # With EPSG:4326 (lat/lon), resolution must be in degrees, not meters.
                # 0.0001 degrees is roughly around ~10-11 meters in latitude.
                "resx": 0.0001,
                "resy": 0.0001,
            },
        }

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                self._statistics_url,
                json=body,
                headers={
                    "Authorization": f"Bearer {token}",
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                },
            )

        if response.status_code >= 400:
            raise RuntimeError(
                f"CDSE statistics request failed with {response.status_code}: {response.text}"
            )

        payload = response.json()

        data = payload.get("data", [])
        if not data:
            raise RuntimeError(
                "No Sentinel-2 statistical data returned for this field and time range."
            )

        latest_valid: dict[str, Any] | None = None

        for item in data:
            try:
                stats = item["outputs"]["ndvi"]["bands"]["B0"]["stats"]
            except KeyError:
                continue

            sample_count = stats.get("sampleCount", 0)
            no_data_count = stats.get("noDataCount", 0)
            mean_val = stats.get("mean")

            if sample_count and sample_count > no_data_count and mean_val is not None:
                latest_valid = item

        if latest_valid is None:
            raise RuntimeError(
                "No valid NDVI observation was found for this field in the requested date range."
            )

        stats = latest_valid["outputs"]["ndvi"]["bands"]["B0"]["stats"]
        captured_at = latest_valid["interval"]["to"]

        return {
            "type": "ndvi_stats",
            "provider": "sentinel-2",
            "captured_at": captured_at,
            "mean_ndvi": float(stats["mean"]),
            "min_ndvi": float(stats["min"]),
            "max_ndvi": float(stats["max"]),
            "sample_count": int(stats.get("sampleCount", 0)),
            "no_data_count": int(stats.get("noDataCount", 0)),
        }