from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import Date, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.persistence.base_model import Base, TimestampMixin


class CoinWallet(Base, TimestampMixin):
    __tablename__ = "coin_wallets"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), unique=True, index=True)
    balance: Mapped[int] = mapped_column(Integer, default=0)
    total_earned: Mapped[int] = mapped_column(Integer, default=0)
    login_streak: Mapped[int] = mapped_column(Integer, default=0)
    last_login_date: Mapped[date | None] = mapped_column(Date, nullable=True)


class CoinTransaction(Base, TimestampMixin):
    __tablename__ = "coin_transactions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    amount: Mapped[int] = mapped_column(Integer)
    reason: Mapped[str] = mapped_column(String)
    description: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(default=datetime.utcnow)


class DailyTask(Base, TimestampMixin):
    __tablename__ = "daily_tasks"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    key: Mapped[str] = mapped_column(String, index=True)
    label: Mapped[str] = mapped_column(String)
    description: Mapped[str] = mapped_column(String)
    coins_reward: Mapped[int] = mapped_column(Integer, default=20)
    icon: Mapped[str] = mapped_column(String)


class DailyTaskCompletion(Base, TimestampMixin):
    __tablename__ = "daily_task_completions"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    task_key: Mapped[str] = mapped_column(String, index=True)
    completed_date: Mapped[date] = mapped_column(Date, index=True)

    __table_args__ = (UniqueConstraint("user_id", "task_key", "completed_date"),)
