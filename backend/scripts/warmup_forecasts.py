"""Pre-populate the forecast cache for all series × region combinations.

Run from the backend/ directory:
    python scripts/warmup_forecasts.py

Total: 21 combinations (5 series × 4 regions + viandes_rouges × 1 national).
"""
import asyncio
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.modules.market_prices.pipeline import ForecastPipeline
from app.modules.market_prices.repository import MarketPriceRepository
from app.persistence.db import AsyncSessionLocal

SERIES_REGIONS: dict[str, list[str]] = {
    "brebis_suitees":   ["national", "nord", "sahel", "centre_et_sud"],
    "genisses_pleines": ["national", "nord", "sahel", "centre_et_sud"],
    "vaches_suitees":   ["national", "nord", "sahel", "centre_et_sud"],
    "viandes_rouges":   ["national"],
    "bovins_suivis":    ["national", "nord", "sahel", "centre_et_sud"],
    "vaches_gestantes": ["national", "nord", "sahel", "centre_et_sud"],
}

TOTAL = sum(len(v) for v in SERIES_REGIONS.values())


async def main() -> None:
    pipeline = ForecastPipeline()
    total_start = time.time()
    count = 0

    for series_name, regions in SERIES_REGIONS.items():
        for region in regions:
            count += 1
            label = f"{series_name}/{region}"
            print(f"[{count:>2}/{TOTAL}] {label:<40}", end=" ", flush=True)
            t = time.time()
            try:
                result = pipeline.run(series_name, region=region)
                elapsed = time.time() - t

                # Unsupported combination (should not happen with this map)
                if "error" in result:
                    print(f"SKIPPED: {result['error']}")
                    continue

                best = result["best_model_name"]
                mape = result["backtest_metrics"].get(best, {}).get("mape")
                mape_str = f"{mape:.1f}%" if isinstance(mape, float) else "N/A"
                warn_str = f" | {result['warnings']}" if result.get("warnings") else ""
                print(f"done in {elapsed:.1f}s | {best} | MAPE={mape_str}{warn_str}")

                history_rows = result.pop("history_rows", [])
                async with AsyncSessionLocal() as db:
                    repo = MarketPriceRepository(db)
                    await repo.save_forecast(
                        series_name=series_name,
                        horizon=result["horizon"],
                        model_used=result["model_used"],
                        result=result,
                        region=region,
                    )
                    if history_rows:
                        await repo.bulk_upsert_history(history_rows)

            except Exception as exc:
                elapsed = time.time() - t
                print(f"FAILED in {elapsed:.1f}s: {exc}")

    total = time.time() - total_start
    print(f"\nAll {TOTAL} combinations completed in {total:.1f}s")
    print("Forecasts are now cached in the database.")


if __name__ == "__main__":
    asyncio.run(main())
