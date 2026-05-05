"""Seed the produce_price_history table from fruits.csv and legumes.csv.

Usage
-----
    cd backend
    python scripts/seed_produce_prices.py

The script reads all 8 produce products from the CSV files and upserts their
weekly price series into the produce_price_history table.

Requires psycopg2-binary (sync driver).  If not installed:
    pip install psycopg2-binary
"""
from __future__ import annotations

import sys
from pathlib import Path

# Make the backend package importable when run as `python scripts/...`
sys.path.insert(0, str(Path(__file__).parents[1]))

from sqlalchemy import create_engine
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.orm import Session

from app.modules.produce_prices.data.loader import ALL_PRODUCTS, ProduceDataLoader, _PRODUCT_CATEGORY
from app.modules.produce_prices.db_models import ProducePriceHistory
from app.persistence.base_model import Base
from app.settings import settings


def _sync_url(async_url: str) -> str:
    """Convert asyncpg URL to a psycopg2 URL."""
    return async_url.replace("postgresql+asyncpg://", "postgresql+psycopg2://", 1)


def _build_records(df, product: str) -> list[dict]:
    """Build upsert-ready row dicts from a weekly produce DataFrame."""
    category = _PRODUCT_CATEGORY[product]
    records: list[dict] = []

    for dt, row in df.iterrows():
        retail_mid = row.get("retail_mid")
        wholesale_mid = row.get("wholesale_mid")

        # Skip NaN rows (seasonal off-season)
        if retail_mid != retail_mid or wholesale_mid != wholesale_mid:  # NaN check
            continue

        records.append(
            {
                "product": product,
                "category": category,
                "price_date": dt.date() if hasattr(dt, "date") else dt,
                "retail_mid": float(retail_mid),
                "wholesale_mid": float(wholesale_mid),
                "qte": float(row["qte"]) if row.get("qte") == row.get("qte") else None,
                "unit": "millimes/kg",
            }
        )

    return records


def main() -> None:
    sync_url = _sync_url(settings.database_url)
    engine = create_engine(sync_url, echo=False)

    # Ensure tables exist (idempotent)
    Base.metadata.create_all(engine, checkfirst=True)

    loader = ProduceDataLoader()
    all_data = loader.load_all()

    if not all_data:
        print("ERROR: No produce data loaded. Ensure fruits.csv and legumes.csv are present.")
        sys.exit(1)

    grand_total = 0

    with Session(engine) as session:
        for product in ALL_PRODUCTS:
            df = all_data.get(product)
            if df is None:
                print(f"  SKIP  {product:<22} — not loaded")
                continue

            records = _build_records(df, product)
            if not records:
                print(f"  SKIP  {product:<22} — no non-NaN rows")
                continue

            stmt = pg_insert(ProducePriceHistory).values(records)
            stmt = stmt.on_conflict_do_update(
                constraint="uq_produce_product_date",
                set_={
                    "retail_mid": stmt.excluded.retail_mid,
                    "wholesale_mid": stmt.excluded.wholesale_mid,
                    "qte": stmt.excluded.qte,
                },
            )
            session.execute(stmt)
            session.commit()

            n = len(records)
            category = _PRODUCT_CATEGORY[product]
            grand_total += n
            print(f"  OK    {product:<22} {category:<8} {n} rows")

    print()
    print(f"Grand total: {grand_total} rows upserted into produce_price_history")


if __name__ == "__main__":
    main()
