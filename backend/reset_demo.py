import asyncio
from app.persistence.db import AsyncSessionLocal
from sqlalchemy import text

async def reset():
    async with AsyncSessionLocal() as db:
        await db.execute(text('DELETE FROM price_alerts'))
        await db.execute(text('UPDATE vaccination_reminders SET last_reminded_at = NULL'))
        await db.commit()
        print('ready')

asyncio.run(reset())
