"""Seed the daily_tasks table with the 5 gamification tasks.

Usage
-----
    cd backend
    python scripts/seed_daily_tasks.py
"""
from __future__ import annotations

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1]))

TASKS = [
    {
        "key": "check_market_prices",
        "label": "Check Market Prices",
        "description": "Open the Market Prices screen today",
        "coins_reward": 20,
        "icon": "📈",
    },
    {
        "key": "check_herd_stats",
        "label": "Check Your Herd",
        "description": "Open the Livestock screen to view herd statistics",
        "coins_reward": 20,
        "icon": "🐄",
    },
    {
        "key": "generate_forecast",
        "label": "Generate a Forecast",
        "description": "Generate an AI price forecast for any commodity",
        "coins_reward": 20,
        "icon": "🔮",
    },
    {
        "key": "post_or_comment",
        "label": "Engage in Community",
        "description": "Post or comment in the community today",
        "coins_reward": 20,
        "icon": "🌱",
    },
    {
        "key": "record_health_event",
        "label": "Record Animal Health",
        "description": "Record a health event for one of your animals",
        "coins_reward": 20,
        "icon": "🏥",
    },
]


async def main() -> None:
    from sqlalchemy import select
    from app.persistence.db import AsyncSessionLocal
    from app.modules.gamification.models import DailyTask  # noqa: F401 — registers mapping
    from app.persistence.base_model import Base
    from app.persistence.db import async_engine

    # Ensure the table exists
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        for task_data in TASKS:
            existing = await db.execute(
                select(DailyTask).where(DailyTask.key == task_data["key"])
            )
            if existing.scalar_one_or_none() is not None:
                print(f"  skip (exists): {task_data['key']}")
                continue
            db.add(DailyTask(**task_data))
            print(f"  inserted: {task_data['key']}")
        await db.commit()
    print("Seed complete.")


if __name__ == "__main__":
    asyncio.run(main())
