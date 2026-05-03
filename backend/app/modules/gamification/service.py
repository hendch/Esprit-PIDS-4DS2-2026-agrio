from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.gamification import repository


class GamificationService:
    COIN_REWARDS = {
        "daily_login": 10,
        "comment_posted": 5,
        "post_liked": 2,
        "daily_task": 20,
    }

    async def award_daily_login(
        self, db: AsyncSession, user_id: str, is_verified_farmer: bool
    ) -> dict | None:
        if not is_verified_farmer:
            return None
        import uuid
        return await repository.record_login_streak(db, uuid.UUID(user_id))

    async def award_comment(
        self, db: AsyncSession, user_id: str, is_verified_farmer: bool
    ) -> dict | None:
        if not is_verified_farmer:
            return None
        import uuid
        wallet = await repository.add_coins(
            db, uuid.UUID(user_id), 5, "comment_posted", "Earned for posting a comment"
        )
        return {"coins_earned": 5, "new_balance": wallet.balance}

    async def award_post_liked(
        self, db: AsyncSession, post_owner_id: str, is_verified_farmer: bool
    ) -> dict | None:
        if not is_verified_farmer:
            return None
        import uuid
        wallet = await repository.add_coins(
            db, uuid.UUID(post_owner_id), 2, "post_liked", "Someone liked your post"
        )
        return {"coins_earned": 2, "new_balance": wallet.balance}

    async def complete_daily_task(
        self, db: AsyncSession, user_id: str, task_key: str, is_verified_farmer: bool
    ) -> dict | None:
        if not is_verified_farmer:
            return None
        import uuid
        return await repository.complete_task(db, uuid.UUID(user_id), task_key)

    async def get_dashboard(self, db: AsyncSession, user_id: str) -> dict:
        import uuid
        uid = uuid.UUID(user_id)
        wallet = await repository.get_or_create_wallet(db, uid)
        tasks = await repository.get_daily_tasks(db)
        completed_today = await repository.get_completed_tasks_today(db, uid)
        transactions = await repository.get_transactions(db, uid, limit=10)

        tz_tunis = timezone(timedelta(hours=1))
        now_tunis = datetime.now(tz_tunis)
        tomorrow_8am = now_tunis.replace(hour=8, minute=0, second=0, microsecond=0)
        if now_tunis.hour >= 8:
            tomorrow_8am = tomorrow_8am + timedelta(days=1)
        seconds_until_reset = int((tomorrow_8am - now_tunis).total_seconds())

        return {
            "balance": wallet.balance,
            "total_earned": wallet.total_earned,
            "login_streak": wallet.login_streak,
            "seconds_until_reset": seconds_until_reset,
            "tasks": [
                {
                    "key": t.key,
                    "label": t.label,
                    "description": t.description,
                    "coins_reward": t.coins_reward,
                    "icon": t.icon,
                    "completed": t.key in completed_today,
                }
                for t in tasks
            ],
            "recent_transactions": [
                {
                    "amount": tx.amount,
                    "reason": tx.reason,
                    "description": tx.description,
                    "created_at": tx.created_at.isoformat(),
                }
                for tx in transactions
            ],
        }
