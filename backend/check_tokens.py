import asyncio
from app.persistence.db import AsyncSessionLocal
from sqlalchemy import text

async def check():
    async with AsyncSessionLocal() as db:
        result = await db.execute(text('SELECT token, platform FROM device_push_tokens'))
        for r in result.fetchall():
            print(f'token={r[0]}  platform={r[1]}')

asyncio.run(check())
