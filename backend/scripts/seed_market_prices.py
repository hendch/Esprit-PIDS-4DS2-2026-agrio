"""Seed the market_price_history table from the raw Excel source files.

Usage
-----
    cd backend
    python scripts/seed_market_prices.py

The script resolves the data directory in the same order as ForecastPipeline:
  1. AGRIO_MARKET_DATA_DIR env var / settings.market_data_dir
  2. app/modules/market_prices/raw/   (module-local fallback)
  3. data/market_prices/raw/          (conventional backend path)

Requires psycopg2-binary (sync driver).  All other deps are already in
pyproject.toml.  If psycopg2 is not installed, run:
    pip install psycopg2-binary
"""
from __future__ import annotations

import sys
from pathlib import Path

# Make the backend package importable when run as `python scripts/...`
sys.path.insert(0, str(Path(__file__).parents[1]))

from collections import defaultdict
from datetime import date

from sqlalchemy import create_engine, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.modules.market_prices.data.loader import ALL_SERIES, LivestockDataLoader
from app.modules.market_prices.db_models import MarketPriceHistory
from app.persistence.base_model import Base
from app.settings import settings

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_MODULE_RAW_DIR = Path(__file__).parents[1] / "app" / "modules" / "market_prices" / "raw"


def _resolve_data_dir() -> Path:
    """Mirror ForecastPipeline._resolve_data_dir() for the sync script."""
    d = Path(settings.market_data_dir)
    if d.exists():
        return d
    if _MODULE_RAW_DIR.exists():
        return _MODULE_RAW_DIR
    return Path(__file__).parents[1] / "data" / "market_prices" / "raw"


def _sync_url(async_url: str) -> str:
    """Convert asyncpg URL to a sync psycopg2 URL."""
    return async_url.replace("postgresql+asyncpg://", "postgresql+psycopg2://", 1)


def _build_rows(df, series_name: str) -> list[dict]:
    region_map = {
        "national_avg": "national",
        "nord": "nord",
        "sahel": "sahel",
        "centre_et_sud": "centre_et_sud",
    }
    rows: list[dict] = []
    for col, region in region_map.items():
        if col not in df.columns:
            continue
        for dt, price in df[col].dropna().items():
            rows.append(
                {
                    "series_name": series_name,
                    "region": region,
                    "price_date": dt.date() if hasattr(dt, "date") else dt,
                    "price": float(price),
                }
            )
    return rows


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    data_dir = _resolve_data_dir()
    print(f"Data directory : {data_dir}")
    if not data_dir.exists():
        print(
            "ERROR: Data directory does not exist.\n"
            f"  Expected: {data_dir}\n"
            "  Place the 6 source Excel files there and try again."
        )
        sys.exit(1)

    sync_url = _sync_url(settings.database_url)
    engine = create_engine(sync_url, echo=False)

    # Ensure tables exist (idempotent)
    Base.metadata.create_all(engine, checkfirst=True)

    loader = LivestockDataLoader(data_dir=data_dir)
    all_data = loader.load_all()

    if not all_data:
        print("ERROR: No series were loaded. Check that the Excel files are present.")
        sys.exit(1)

    totals: dict[str, int] = defaultdict(int)

    with Session(engine) as session:
        for series_name in ALL_SERIES:
            df = all_data.get(series_name)
            if df is None:
                print(f"  SKIP  {series_name} — file not found")
                continue

            rows = _build_rows(df, series_name)
            if not rows:
                print(f"  SKIP  {series_name} — no numeric rows extracted")
                continue

            # Upsert in one statement per series
            stmt = pg_insert(MarketPriceHistory).values(rows)
            stmt = stmt.on_conflict_do_update(
                constraint="uq_series_region_date",
                set_={"price": stmt.excluded.price},
            )
            session.execute(stmt)
            session.commit()

            # Tally per region
            by_region: dict[str, int] = defaultdict(int)
            for r in rows:
                by_region[r["region"]] += 1

            for region, count in sorted(by_region.items()):
                totals[series_name] += count
                print(f"  OK    {series_name:<22}  {region:<16}  {count:>4} rows")

    print()
    print("Summary")
    print("-------")
    grand_total = 0
    for series_name in ALL_SERIES:
        n = totals.get(series_name, 0)
        grand_total += n
        status = f"{n:>5} rows" if n else "  NOT LOADED"
        print(f"  {series_name:<30}  {status}")

    print(f"\n  Grand total: {grand_total} rows upserted into market_price_history")


if __name__ == "__main__":
    main()
