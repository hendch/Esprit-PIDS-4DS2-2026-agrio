"""
Monthly refresh script — run this whenever new price data arrives.

Usage:
  python scripts/refresh_all_prices.py              # refresh everything
  python scripts/refresh_all_prices.py --only market  # only livestock
  python scripts/refresh_all_prices.py --only produce # only fruits/veg
  python scripts/refresh_all_prices.py --skip-warmup  # seed only, no retraining
"""

import sys
import time
import argparse
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))


# ---------------------------------------------------------------------------
# Step functions
# ---------------------------------------------------------------------------


def run_market_seed():
    print("=" * 50)
    print("STEP 1/4 — Seeding livestock market prices")
    print("=" * 50)
    t = time.time()

    from collections import defaultdict

    from sqlalchemy import create_engine
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    from sqlalchemy.orm import Session

    from app.modules.market_prices.data.loader import ALL_SERIES, LivestockDataLoader
    from app.modules.market_prices.db_models import MarketPriceHistory
    from app.persistence.base_model import Base
    from app.settings import settings

    def _sync_url(u: str) -> str:
        return u.replace("postgresql+asyncpg://", "postgresql+psycopg2://", 1)

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
                rows.append({
                    "series_name": series_name,
                    "region": region,
                    "price_date": dt.date() if hasattr(dt, "date") else dt,
                    "price": float(price),
                })
        return rows

    engine = create_engine(_sync_url(settings.database_url), echo=False)
    Base.metadata.create_all(engine, checkfirst=True)

    loader = LivestockDataLoader()
    all_data = loader.load_all()

    if not all_data:
        print("  WARNING: No market data files found — skipping seed")
        print(f"Done in {time.time()-t:.1f}s\n")
        return

    grand_total = 0
    with Session(engine) as session:
        for series_name in ALL_SERIES:
            df = all_data.get(series_name)
            if df is None:
                print(f"  SKIP  {series_name} — file not found")
                continue
            rows = _build_rows(df, series_name)
            if not rows:
                print(f"  SKIP  {series_name} — no numeric rows")
                continue
            stmt = pg_insert(MarketPriceHistory).values(rows)
            stmt = stmt.on_conflict_do_update(
                constraint="uq_series_region_date",
                set_={"price": stmt.excluded.price},
            )
            session.execute(stmt)
            session.commit()
            by_region: dict[str, int] = defaultdict(int)
            for r in rows:
                by_region[r["region"]] += 1
            for region, count in sorted(by_region.items()):
                grand_total += count
                print(f"  OK    {series_name:<22}  {region:<16}  {count:>4} rows")

    print(f"\n  Grand total: {grand_total} rows upserted into market_price_history")
    print(f"Done in {time.time()-t:.1f}s\n")


def run_market_warmup():
    print("=" * 50)
    print("STEP 2/4 — Retraining livestock forecast models")
    print("=" * 50)
    t = time.time()

    from app.modules.market_prices.pipeline import ForecastPipeline

    SERIES = [
        "brebis_suitees", "genisses_pleines", "vaches_suitees",
        "viandes_rouges", "bovins_suivis", "vaches_gestantes",
    ]
    pipeline = ForecastPipeline()
    for i, series in enumerate(SERIES, 1):
        print(f"  {i}/6 {series}...", end=" ", flush=True)
        st = time.time()
        try:
            result = pipeline.run(series_name=series, horizon=12, model="auto")
            best = result.get("best_model_name", result.get("model_used", "?"))
            bm = result.get("backtest_metrics", {})
            mape = bm.get(best, {}).get("mape", "N/A") if isinstance(bm, dict) else "N/A"
            mape_s = f"{mape:.1f}%" if isinstance(mape, float) else str(mape)
            print(f"done {time.time()-st:.1f}s | {best} | MAPE={mape_s}")
        except Exception as exc:
            import traceback
            print(f"FAILED")
            traceback.print_exc()

    print(f"Done in {time.time()-t:.1f}s\n")


def run_produce_seed():
    print("=" * 50)
    print("STEP 3/4 — Seeding produce prices")
    print("=" * 50)
    t = time.time()

    from sqlalchemy import create_engine
    from sqlalchemy.dialects.postgresql import insert as pg_insert
    from sqlalchemy.orm import Session

    from app.modules.produce_prices.data.loader import ALL_PRODUCTS, ProduceDataLoader, _PRODUCT_CATEGORY
    from app.modules.produce_prices.db_models import ProducePriceHistory
    from app.persistence.base_model import Base
    from app.settings import settings

    def _sync_url(u: str) -> str:
        return u.replace("postgresql+asyncpg://", "postgresql+psycopg2://", 1)

    engine = create_engine(_sync_url(settings.database_url), echo=False)
    Base.metadata.create_all(engine, checkfirst=True)

    loader = ProduceDataLoader()
    all_data = loader.load_all()

    if not all_data:
        print("  WARNING: No produce data files found — skipping seed")
        print(f"Done in {time.time()-t:.1f}s\n")
        return

    grand_total = 0
    with Session(engine) as session:
        for product in ALL_PRODUCTS:
            df = all_data.get(product)
            if df is None:
                print(f"  SKIP  {product:<22} — not loaded")
                continue

            records: list[dict] = []
            category = _PRODUCT_CATEGORY[product]
            for dt, row in df.iterrows():
                retail_mid = row.get("retail_mid")
                wholesale_mid = row.get("wholesale_mid")
                if retail_mid != retail_mid or wholesale_mid != wholesale_mid:
                    continue
                records.append({
                    "product": product,
                    "category": category,
                    "price_date": dt.date() if hasattr(dt, "date") else dt,
                    "retail_mid": float(retail_mid),
                    "wholesale_mid": float(wholesale_mid),
                    "qte": float(row["qte"]) if row.get("qte") == row.get("qte") else None,
                    "unit": "millimes/kg",
                })

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
            grand_total += n
            print(f"  OK    {product:<22} {category:<8} {n} rows")

    print(f"\n  Grand total: {grand_total} rows upserted into produce_price_history")
    print(f"Done in {time.time()-t:.1f}s\n")


def run_produce_warmup():
    print("=" * 50)
    print("STEP 4/4 — Retraining produce forecast models")
    print("=" * 50)
    t = time.time()

    from app.modules.produce_prices.pipeline import ProducePricePipeline

    PRODUCTS = [
        "clementine", "maltaise", "thomson", "pommes",
        "oignon", "piment_doux", "piment_piquant", "pomme_de_terre",
    ]
    pipeline = ProducePricePipeline()
    for i, product in enumerate(PRODUCTS, 1):
        print(f"  {i}/8 {product}...", end=" ", flush=True)
        st = time.time()
        try:
            result = pipeline.run(product)
            best = result["best_model_name"]
            mape = result["backtest_metrics"].get(best, {}).get("mape", "N/A")
            mape_s = f"{mape:.1f}%" if isinstance(mape, float) else str(mape)
            print(f"done {time.time()-st:.1f}s | {best} | MAPE={mape_s}")
        except Exception as exc:
            import traceback
            print(f"FAILED")
            traceback.print_exc()

    print(f"Done in {time.time()-t:.1f}s\n")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def main():
    parser = argparse.ArgumentParser(description="Refresh all price forecast data")
    parser.add_argument(
        "--only", choices=["market", "produce"],
        help="Refresh only one feature",
    )
    parser.add_argument(
        "--skip-warmup", action="store_true",
        help="Seed data only, skip model retraining",
    )
    args = parser.parse_args()

    total_start = time.time()
    import datetime
    print(f"\nAgrio Price Refresh — {datetime.datetime.now().strftime('%Y-%m-%d %H:%M')}\n")

    run_market = args.only in (None, "market")
    run_produce = args.only in (None, "produce")

    if run_market:
        run_market_seed()
        if not args.skip_warmup:
            run_market_warmup()

    if run_produce:
        run_produce_seed()
        if not args.skip_warmup:
            run_produce_warmup()

    total = time.time() - total_start
    print("=" * 50)
    print(f"ALL DONE in {total:.0f}s ({total/60:.1f} min)")
    print("=" * 50)
    print("\nNext run: when new monthly/weekly data files arrive,")
    print("copy them to data/market_prices/raw/ and data/produce_prices/raw/")
    print("then run: python scripts/refresh_all_prices.py")


if __name__ == "__main__":
    main()
