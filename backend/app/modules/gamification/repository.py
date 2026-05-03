from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.auth.models import User
from app.modules.gamification.models import (
    CoinTransaction,
    CoinWallet,
    DailyTask,
    DailyTaskCompletion,
)

_TZ_TUNIS = timezone(timedelta(hours=1))


def _today_tunis() -> date:
    return datetime.now(_TZ_TUNIS).date()


async def get_or_create_wallet(db: AsyncSession, user_id: uuid.UUID) -> CoinWallet:
    result = await db.execute(select(CoinWallet).where(CoinWallet.user_id == user_id))
    wallet = result.scalar_one_or_none()
    if wallet is None:
        wallet = CoinWallet(user_id=user_id)
        db.add(wallet)
        await db.commit()
        await db.refresh(wallet)
    return wallet


async def add_coins(
    db: AsyncSession, user_id: uuid.UUID, amount: int, reason: str, description: str
) -> CoinWallet:
    wallet = await get_or_create_wallet(db, user_id)
    wallet.balance += amount
    wallet.total_earned += amount
    db.add(CoinTransaction(user_id=user_id, amount=amount, reason=reason, description=description))
    await db.commit()
    await db.refresh(wallet)
    return wallet


async def get_wallet(db: AsyncSession, user_id: uuid.UUID) -> CoinWallet | None:
    result = await db.execute(select(CoinWallet).where(CoinWallet.user_id == user_id))
    return result.scalar_one_or_none()


async def get_transactions(
    db: AsyncSession, user_id: uuid.UUID, limit: int = 20
) -> list[CoinTransaction]:
    result = await db.execute(
        select(CoinTransaction)
        .where(CoinTransaction.user_id == user_id)
        .order_by(CoinTransaction.created_at.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


async def get_daily_tasks(db: AsyncSession) -> list[DailyTask]:
    result = await db.execute(select(DailyTask))
    return list(result.scalars().all())


async def get_completed_tasks_today(db: AsyncSession, user_id: uuid.UUID) -> list[str]:
    today = _today_tunis()
    result = await db.execute(
        select(DailyTaskCompletion.task_key).where(
            DailyTaskCompletion.user_id == user_id,
            DailyTaskCompletion.completed_date == today,
        )
    )
    return list(result.scalars().all())


async def complete_task(db: AsyncSession, user_id: uuid.UUID, task_key: str) -> dict:
    task_result = await db.execute(select(DailyTask).where(DailyTask.key == task_key))
    task = task_result.scalar_one_or_none()
    if task is None:
        raise ValueError(f"Unknown task key: {task_key}")

    today = _today_tunis()
    existing = await db.execute(
        select(DailyTaskCompletion).where(
            DailyTaskCompletion.user_id == user_id,
            DailyTaskCompletion.task_key == task_key,
            DailyTaskCompletion.completed_date == today,
        )
    )
    if existing.scalar_one_or_none() is not None:
        raise ValueError("already_completed")

    wallet = await get_or_create_wallet(db, user_id)
    wallet.balance += task.coins_reward
    wallet.total_earned += task.coins_reward

    db.add(DailyTaskCompletion(user_id=user_id, task_key=task_key, completed_date=today))
    db.add(CoinTransaction(
        user_id=user_id,
        amount=task.coins_reward,
        reason="daily_task",
        description=f"Completed task: {task.label}",
    ))
    await db.commit()
    await db.refresh(wallet)
    return {"task_key": task_key, "coins_earned": task.coins_reward, "new_balance": wallet.balance}


async def record_login_streak(db: AsyncSession, user_id: uuid.UUID) -> dict:
    wallet = await get_or_create_wallet(db, user_id)
    today = _today_tunis()

    if wallet.last_login_date == today:
        return {
            "already_logged": True,
            "streak": wallet.login_streak,
            "coins_earned": 0,
            "new_balance": wallet.balance,
        }

    yesterday = today - timedelta(days=1)
    wallet.login_streak = wallet.login_streak + 1 if wallet.last_login_date == yesterday else 1
    wallet.last_login_date = today
    wallet.balance += 10
    wallet.total_earned += 10

    db.add(CoinTransaction(
        user_id=user_id,
        amount=10,
        reason="daily_login",
        description="Daily login reward",
    ))
    await db.commit()
    await db.refresh(wallet)
    return {
        "streak": wallet.login_streak,
        "coins_earned": 10,
        "new_balance": wallet.balance,
        "already_logged": False,
    }


async def get_leaderboard(db: AsyncSession, limit: int = 50) -> list[dict]:
    result = await db.execute(
        select(
            CoinWallet,
            User.display_name,
            User.avatar_url,
            User.is_verified_farmer,
        )
        .join(User, CoinWallet.user_id == User.id)
        .where(User.is_verified_farmer == True)  # noqa: E712
        .order_by(CoinWallet.total_earned.desc())
        .limit(limit)
    )
    rows = result.all()
    return [
        {
            "rank": i + 1,
            "user_id": str(row.CoinWallet.user_id),
            "display_name": row.display_name,
            "avatar_url": row.avatar_url,
            "total_earned": row.CoinWallet.total_earned,
            "login_streak": row.CoinWallet.login_streak,
            "is_verified_farmer": row.is_verified_farmer,
        }
        for i, row in enumerate(rows)
    ]
