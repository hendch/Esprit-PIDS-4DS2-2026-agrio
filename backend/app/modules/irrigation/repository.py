from __future__ import annotations

from datetime import UTC, date, datetime, time

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.irrigation.models import AppSetting, IrrigationEvent, IrrigationSchedule


class IrrigationRepository:
    """PostgreSQL-backed irrigation store."""

    def __init__(self, session: AsyncSession) -> None:
        self._session = session

    async def log_event(
        self,
        moisture: float,
        amount: float,
        duration: int,
        next_date: str,
        crop: str,
        weather: str,
    ) -> None:
        evt = IrrigationEvent(
            timestamp=datetime.now(UTC),
            moisture_level=moisture,
            water_amount=amount,
            duration=duration,
            next_irrigation=next_date,
            crop_type=crop,
            weather_conditions=weather,
        )
        self._session.add(evt)
        await self._session.commit()

    async def get_history(self, limit: int = 10) -> list[dict]:
        stmt = select(IrrigationEvent).order_by(IrrigationEvent.timestamp.desc()).limit(limit)
        result = await self._session.execute(stmt)
        rows = result.scalars().all()
        return [
            {
                "id": str(r.id),
                "timestamp": r.timestamp.isoformat(),
                "moisture_level": r.moisture_level,
                "water_amount": r.water_amount,
                "duration": r.duration,
                "next_irrigation": r.next_irrigation,
                "crop_type": r.crop_type,
                "weather_conditions": r.weather_conditions,
            }
            for r in rows
        ]

    async def get_today_water_usage(self) -> float:
        today = date.today()
        start = datetime.combine(today, time.min, tzinfo=UTC)
        end = datetime.combine(today, time.max, tzinfo=UTC)
        stmt = select(func.coalesce(func.sum(IrrigationEvent.water_amount), 0.0)).where(
            IrrigationEvent.timestamp.between(start, end)
        )
        result = await self._session.execute(stmt)
        return float(result.scalar_one() or 0.0)

    async def get_water_usage_history(self, limit: int = 7) -> dict:
        day = func.date(IrrigationEvent.timestamp)
        stmt = (
            select(day.label("date"), func.sum(IrrigationEvent.water_amount).label("total_amount"))
            .group_by(day)
            .order_by(day.desc())
            .limit(limit)
        )
        result = await self._session.execute(stmt)
        rows = result.all()

        history = [
            {
                "date": (r.date.isoformat() if hasattr(r.date, "isoformat") else str(r.date)),
                "total_amount": float(r.total_amount or 0.0),
            }
            for r in rows
        ]

        total_baseline = len(history) * 10.0
        actual_total = sum(h["total_amount"] for h in history)
        water_saved_pct = 0.0
        if total_baseline > 0:
            water_saved_pct = max(0.0, ((total_baseline - actual_total) / total_baseline) * 100)

        return {"history": history, "water_saved_pct": water_saved_pct}

    async def add_schedule(
        self,
        field_id: str,
        target_date: str,
        start_time: str,
        duration_minutes: int,
        water_volume: float,
        user_id: str,
    ) -> str:
        """Create new irrigation schedule with better error handling."""
        try:
            print(f"DEBUG add_schedule called: {field_id=} {target_date=} {start_time=} {duration_minutes=} {water_volume=}")
            sched = IrrigationSchedule(
            field_id=field_id,
            target_date=date.fromisoformat(target_date),
            start_time=str(start_time) if not isinstance(start_time, str) else start_time,  
            duration_minutes=duration_minutes,
            water_volume=water_volume,
            status="pending",
            user_id=user_id,
        )
            self._session.add(sched)
            await self._session.commit()
            await self._session.refresh(sched)
            return str(sched.id)
        except Exception as e:
            await self._session.rollback()
            raise Exception(f"Failed to create schedule: {str(e)}") from e

    async def get_schedules(self, limit: int = 10) -> list[dict]:
        stmt = select(IrrigationSchedule).order_by(IrrigationSchedule.created_at.desc()).limit(limit)
        result = await self._session.execute(stmt)
        rows = result.scalars().all()
        return [
            {
                "id": str(r.id),
                "field_id": r.field_id,
                "target_date": r.target_date.isoformat(),
                "start_time": r.start_time,
                "duration_minutes": r.duration_minutes,
                "water_volume": r.water_volume,
                "status": r.status,
            }
            for r in rows
        ]

    async def get_autonomous_state(self) -> bool:
        row = await self._session.get(AppSetting, "autonomous")
        if row is None:
            self._session.add(AppSetting(key="autonomous", value="false"))
            await self._session.commit()
            return False
        return row.value.lower() == "true"

    async def set_autonomous_state(self, is_autonomous: bool) -> None:
        val = "true" if is_autonomous else "false"
        row = await self._session.get(AppSetting, "autonomous")
        if row is None:
            row = AppSetting(key="autonomous", value=val)
            self._session.add(row)
        else:
            row.value = val
        await self._session.commit()