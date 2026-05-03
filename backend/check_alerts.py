import asyncio
from app.persistence.db import AsyncSessionLocal
from sqlalchemy import text

async def check():
    async with AsyncSessionLocal() as db:
        result = await db.execute(text('SELECT series_name, condition, threshold, last_triggered_at FROM price_alerts'))
        for r in result.fetchall():
            print(f'series={r[0]}  threshold={r[2]}  last_fired={r[3]}')

asyncio.run(check())
