from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.livestock.models import Animal, HealthEvent
from app.modules.livestock.repository import LivestockRepository

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

VALID_ANIMAL_TYPES = [
    "bovin", "vache", "genisse", "ovin", "agneau", "taurillon", "caprin",
]

VALID_STATUSES = ["active", "sold", "deceased"]

VALID_EVENT_TYPES = [
    "vaccination", "treatment", "checkup", "injury", "illness", "other",
]

_TYPE_TO_SERIES: dict[str, str] = {
    "bovin":     "bovins_suivis",
    "vache":     "vaches_suitees",
    "genisse":   "genisses_pleines",
    "ovin":      "brebis_suitees",
    "agneau":    "viandes_rouges",
    "taurillon": "viandes_rouges",
    "caprin":    "viandes_rouges",
}

# viandes_rouges quotes TND/kg live weight — multiply by typical slaughter weight to get TND/head
SLAUGHTER_WEIGHT_KG: dict[str, int] = {
    "agneau":    32,
    "taurillon": 280,
    "caprin":    25,
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _age_months(birth_date: date | None) -> int | None:
    if birth_date is None:
        return None
    today = date.today()
    return (today.year - birth_date.year) * 12 + (today.month - birth_date.month)


def _animal_to_dict(animal: Animal) -> dict:
    return {
        "id": str(animal.id),
        "farm_id": str(animal.farm_id),
        "name": animal.name,
        "animal_type": animal.animal_type,
        "breed": animal.breed,
        "birth_date": animal.birth_date.isoformat() if animal.birth_date else None,
        "tag_id": animal.tag_id,
        "status": animal.status,
        "purchase_price": animal.purchase_price,
        "purchase_date": animal.purchase_date.isoformat() if animal.purchase_date else None,
        "age_months": _age_months(animal.birth_date),
        "market_series": _TYPE_TO_SERIES.get(animal.animal_type),
        "created_at": animal.created_at.isoformat() if animal.created_at else None,
        "updated_at": animal.updated_at.isoformat() if animal.updated_at else None,
    }


def _event_to_dict(event: HealthEvent) -> dict:
    return {
        "id": str(event.id),
        "animal_id": str(event.animal_id),
        "event_type": event.event_type,
        "description": event.description,
        "event_date": event.event_date.isoformat(),
        "created_at": event.created_at.isoformat() if event.created_at else None,
    }


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------

class LivestockService:

    @staticmethod
    async def list_animals(db: AsyncSession, farm_id: uuid.UUID) -> list[dict]:
        repo = LivestockRepository(db)
        animals = await repo.get_animals(farm_id)
        return [_animal_to_dict(a) for a in animals]

    @staticmethod
    async def get_animal_detail(
        db: AsyncSession, animal_id: uuid.UUID, farm_id: uuid.UUID
    ) -> dict | None:
        repo = LivestockRepository(db)
        animal = await repo.get_animal(animal_id, farm_id)
        if animal is None:
            return None
        events = await repo.get_health_events(animal_id)
        result = _animal_to_dict(animal)
        result["health_events"] = [_event_to_dict(e) for e in events]
        return result

    @staticmethod
    async def create_animal(
        db: AsyncSession, farm_id: uuid.UUID, data: dict
    ) -> dict:
        animal_type = data.get("animal_type", "")
        if animal_type not in VALID_ANIMAL_TYPES:
            raise ValueError(
                f"Invalid animal_type '{animal_type}'. "
                f"Valid options: {VALID_ANIMAL_TYPES}"
            )
        status = data.get("status", "active")
        if status not in VALID_STATUSES:
            raise ValueError(
                f"Invalid status '{status}'. Valid options: {VALID_STATUSES}"
            )
        repo = LivestockRepository(db)
        animal = await repo.create_animal(farm_id, data)
        return _animal_to_dict(animal)

    @staticmethod
    async def update_animal(
        db: AsyncSession, animal_id: uuid.UUID, farm_id: uuid.UUID, data: dict
    ) -> dict | None:
        if "animal_type" in data and data["animal_type"] not in VALID_ANIMAL_TYPES:
            raise ValueError(
                f"Invalid animal_type '{data['animal_type']}'. "
                f"Valid options: {VALID_ANIMAL_TYPES}"
            )
        if "status" in data and data["status"] not in VALID_STATUSES:
            raise ValueError(
                f"Invalid status '{data['status']}'. Valid options: {VALID_STATUSES}"
            )
        repo = LivestockRepository(db)
        animal = await repo.update_animal(animal_id, farm_id, data)
        return _animal_to_dict(animal) if animal else None

    @staticmethod
    async def delete_animal(
        db: AsyncSession, animal_id: uuid.UUID, farm_id: uuid.UUID
    ) -> bool:
        repo = LivestockRepository(db)
        return await repo.delete_animal(animal_id, farm_id)

    @staticmethod
    async def add_health_event(
        db: AsyncSession,
        animal_id: uuid.UUID,
        farm_id: uuid.UUID,
        data: dict,
    ) -> dict:
        repo = LivestockRepository(db)
        animal = await repo.get_animal(animal_id, farm_id)
        if animal is None:
            raise LookupError(f"Animal '{animal_id}' not found in farm '{farm_id}'")
        event_type = data.get("event_type", "")
        if event_type not in VALID_EVENT_TYPES:
            raise ValueError(
                f"Invalid event_type '{event_type}'. "
                f"Valid options: {VALID_EVENT_TYPES}"
            )
        event = await repo.create_health_event(animal_id, data)

        if data.get("event_type") == "vaccination":
            from app.modules.notification.repository import resolve_vaccination_reminder
            await resolve_vaccination_reminder(db, animal_id)

        return _event_to_dict(event)

    @staticmethod
    async def get_health_events(
        db: AsyncSession, animal_id: uuid.UUID, farm_id: uuid.UUID
    ) -> list[dict]:
        repo = LivestockRepository(db)
        # Verify ownership
        animal = await repo.get_animal(animal_id, farm_id)
        if animal is None:
            raise LookupError(f"Animal '{animal_id}' not found in farm '{farm_id}'")
        events = await repo.get_health_events(animal_id)
        return [_event_to_dict(e) for e in events]

    @staticmethod
    async def delete_health_event(
        db: AsyncSession,
        event_id: uuid.UUID,
        animal_id: uuid.UUID,
        farm_id: uuid.UUID,
    ) -> bool:
        repo = LivestockRepository(db)
        # Verify animal ownership
        animal = await repo.get_animal(animal_id, farm_id)
        if animal is None:
            raise LookupError(f"Animal '{animal_id}' not found in farm '{farm_id}'")
        return await repo.delete_health_event(event_id, animal_id)

    @staticmethod
    async def calculate_pnl(
        db: AsyncSession, animal_id: uuid.UUID, farm_id: uuid.UUID
    ) -> dict | None:
        from sqlalchemy import select
        from app.modules.market_prices.db_models import MarketPriceHistory

        repo = LivestockRepository(db)
        animal = await repo.get_animal(animal_id, farm_id)
        if animal is None:
            return None

        series_name = _TYPE_TO_SERIES.get(animal.animal_type)

        bales_map = {
            "bovin": 8, "vache": 8, "genisse": 8, "taurillon": 8,
            "ovin": 3, "agneau": 3, "caprin": 2,
        }
        monthly_bales = bales_map.get(animal.animal_type, 4)

        # Fetch latest national market price (current estimated value)
        market_price = None
        if series_name:
            result = await db.execute(
                select(MarketPriceHistory)
                .where(MarketPriceHistory.series_name == series_name)
                .where(MarketPriceHistory.region == "national")
                .order_by(MarketPriceHistory.price_date.desc())
                .limit(1)
            )
            row = result.scalar_one_or_none()
            if row:
                market_price = row.price

        # For animals sold by weight, convert TND/kg → TND/head
        slaughter_weight = SLAUGHTER_WEIGHT_KG.get(animal.animal_type)
        price_per_kg: float | None = None
        if slaughter_weight and market_price is not None:
            price_per_kg = market_price
            market_price = market_price * slaughter_weight

        # Fetch latest straw (tbn) price for feed cost
        tbn_price = None
        result = await db.execute(
            select(MarketPriceHistory)
            .where(MarketPriceHistory.series_name == "tbn")
            .where(MarketPriceHistory.region == "national")
            .order_by(MarketPriceHistory.price_date.desc())
            .limit(1)
        )
        row = result.scalar_one_or_none()
        if row:
            tbn_price = row.price

        # Resolve purchase price: manual entry takes priority
        purchase_price: float | None = animal.purchase_price
        purchase_price_source: str | None = "manual" if purchase_price is not None else None

        # Fall back to historical market price on the purchase date
        if purchase_price is None and animal.purchase_date and series_name:
            result = await db.execute(
                select(MarketPriceHistory)
                .where(MarketPriceHistory.series_name == series_name)
                .where(MarketPriceHistory.region == "national")
                .where(MarketPriceHistory.price_date <= animal.purchase_date)
                .order_by(MarketPriceHistory.price_date.desc())
                .limit(1)
            )
            row = result.scalar_one_or_none()
            if row:
                purchase_price = row.price
                purchase_price_source = "estimated_from_date"
            # Historical viandes_rouges is also TND/kg — apply same conversion
            if purchase_price is not None and slaughter_weight:
                purchase_price = purchase_price * slaughter_weight

        # Feed cost covers the period the farmer has owned the animal,
        # not its full biological age. Use purchase_date first, birth_date as fallback.
        reference_date = animal.purchase_date or animal.birth_date
        ownership_months = None
        if reference_date:
            today = date.today()
            ownership_months = (today.year - reference_date.year) * 12 + \
                               (today.month - reference_date.month)

        monthly_feed_cost = (tbn_price or 0) * monthly_bales
        total_feed_cost = monthly_feed_cost * (ownership_months or 0)

        # Milk revenue — only for dairy animals
        DAIRY_TYPES = {"vache", "genisse"}
        MILK_PRICE_TND = 1.54       # guaranteed min + transport allowance (TND/litre)
        LITRES_PER_MONTH = 365      # 12 L/day × ~30.4 days, Tunisia industry average

        is_dairy = animal.animal_type in DAIRY_TYPES
        milk_revenue_per_month = None
        total_milk_revenue = None
        if is_dairy and ownership_months:
            milk_revenue_per_month = round(LITRES_PER_MONTH * MILK_PRICE_TND, 2)
            total_milk_revenue = round(milk_revenue_per_month * ownership_months, 2)

        # Offspring revenue — ovin produces lambs, caprin produces kids.
        # Prices are fixed from dataset: agneau 29.1 TND/kg, caprin 24.5 TND/kg.
        _OFFSPRING_CFG = {
            "ovin":   {"price": 29.1, "weight": 32, "per_year": 1.5},
            "caprin": {"price": 24.5, "weight": 25, "per_year": 1.5},
        }
        has_offspring_revenue = animal.animal_type in _OFFSPRING_CFG
        offspring_price_per_kg = None
        offspring_weight_kg = None
        offspring_per_year = None
        offspring_revenue_per_year = None
        total_offspring_revenue = None
        if has_offspring_revenue and ownership_months:
            cfg = _OFFSPRING_CFG[animal.animal_type]
            offspring_price_per_kg = cfg["price"]
            offspring_weight_kg    = cfg["weight"]
            offspring_per_year     = cfg["per_year"]
            value_per_offspring    = offspring_price_per_kg * offspring_weight_kg
            offspring_revenue_per_year = round(value_per_offspring * offspring_per_year, 2)
            ownership_years        = ownership_months / 12
            total_offspring_revenue = round(offspring_revenue_per_year * ownership_years, 2)

        gross_pnl = None
        net_pnl = None
        if market_price is not None and purchase_price is not None:
            gross_pnl = market_price - purchase_price
            net_pnl = (
                market_price
                - purchase_price
                - (total_feed_cost or 0)
                + (total_milk_revenue or 0)
                + (total_offspring_revenue or 0)
            )

        return {
            "animal_id": str(animal.id),
            "animal_name": animal.name,
            "animal_type": animal.animal_type,
            "purchase_price": purchase_price,
            "purchase_date": animal.purchase_date.isoformat() if animal.purchase_date else None,
            "purchase_price_source": purchase_price_source,
            "estimated_value": round(market_price, 2) if market_price is not None else None,
            "market_series": series_name,
            "unit": "TND/head",
            "slaughter_weight_kg": slaughter_weight,
            "price_per_kg": round(price_per_kg, 2) if price_per_kg is not None else None,
            "ownership_months": ownership_months,
            "monthly_bales": monthly_bales,
            "tbn_price_per_bale": tbn_price,
            "monthly_feed_cost": round(monthly_feed_cost, 2) if tbn_price else None,
            "total_feed_cost": round(total_feed_cost, 2) if tbn_price and ownership_months else None,
            "is_dairy": is_dairy,
            "milk_price_per_litre": MILK_PRICE_TND if is_dairy else None,
            "litres_per_month": LITRES_PER_MONTH if is_dairy else None,
            "milk_revenue_per_month": milk_revenue_per_month,
            "total_milk_revenue": total_milk_revenue,
            "has_offspring_revenue": has_offspring_revenue,
            "offspring_price_per_kg": offspring_price_per_kg,
            "offspring_weight_kg": offspring_weight_kg,
            "offspring_per_year": offspring_per_year,
            "offspring_revenue_per_year": offspring_revenue_per_year,
            "total_offspring_revenue": total_offspring_revenue,
            "gross_pnl": round(gross_pnl, 2) if gross_pnl is not None else None,
            "net_pnl": round(net_pnl, 2) if net_pnl is not None else None,
            "currency": "TND",
        }

    @staticmethod
    async def get_herd_stats(db: AsyncSession, farm_id: uuid.UUID) -> dict:
        from datetime import date
        from sqlalchemy import select
        from app.modules.market_prices.db_models import MarketPriceHistory

        repo = LivestockRepository(db)
        animals = await repo.get_animals(farm_id, skip=0, limit=1000)

        if not animals:
            return {
                "total_animals": 0,
                "total_herd_value": 0,
                "avg_age_months": None,
                "due_vaccination": 0,
                "by_type": {},
                "by_status": {},
            }

        unique_series = set(
            _TYPE_TO_SERIES[a.animal_type]
            for a in animals
            if a.animal_type in _TYPE_TO_SERIES
        )

        series_prices: dict[str, float] = {}
        for series_name in unique_series:
            result = await db.execute(
                select(MarketPriceHistory)
                .where(MarketPriceHistory.series_name == series_name)
                .where(MarketPriceHistory.region == "national")
                .order_by(MarketPriceHistory.price_date.desc())
                .limit(1)
            )
            row = result.scalar_one_or_none()
            if row:
                series_prices[series_name] = row.price

        total_herd_value = 0.0
        for animal in animals:
            series = _TYPE_TO_SERIES.get(animal.animal_type)
            if series and series in series_prices:
                total_herd_value += series_prices[series]

        today = date.today()
        ages = []
        for a in animals:
            if a.birth_date:
                age = (today.year - a.birth_date.year) * 12 + (today.month - a.birth_date.month)
                ages.append(age)
        avg_age_months = round(sum(ages) / len(ages)) if ages else None

        due_vaccination = 0
        for animal in animals:
            events = await repo.get_health_events(animal.id)
            vaccinations = [e for e in events if e.event_type == "vaccination"]
            if not vaccinations:
                due_vaccination += 1
            else:
                last_vax = max(vaccinations, key=lambda e: e.event_date)
                months_since = (
                    (today.year - last_vax.event_date.year) * 12
                    + (today.month - last_vax.event_date.month)
                )
                if months_since >= 12:
                    due_vaccination += 1

        by_type: dict[str, int] = {}
        by_status: dict[str, int] = {}
        for a in animals:
            by_type[a.animal_type] = by_type.get(a.animal_type, 0) + 1
            by_status[a.status] = by_status.get(a.status, 0) + 1

        return {
            "total_animals": len(animals),
            "total_herd_value": round(total_herd_value, 0),
            "avg_age_months": avg_age_months,
            "due_vaccination": due_vaccination,
            "by_type": by_type,
            "by_status": by_status,
        }

    @staticmethod
    async def get_market_price(
        db: AsyncSession, animal_type: str
    ) -> dict | None:
        from sqlalchemy import select
        from app.modules.market_prices.db_models import MarketPriceHistory

        series_name = _TYPE_TO_SERIES.get(animal_type)
        if series_name is None:
            return None

        stmt = (
            select(MarketPriceHistory)
            .where(
                MarketPriceHistory.series_name == series_name,
                MarketPriceHistory.region == "national",
            )
            .order_by(MarketPriceHistory.price_date.desc())
            .limit(13)  # fetch last 13 months to compute CAGR
        )
        result = await db.execute(stmt)
        rows = list(result.scalars().all())
        if not rows:
            return None

        latest_price = rows[0].price
        unit_map = {
            "bovins_suivis":   "TND/head",
            "vaches_suitees":  "TND/head",
            "genisses_pleines":"TND/head",
            "brebis_suitees":  "TND/head",
            "viandes_rouges":  "TND/kg",
        }
        unit = unit_map.get(series_name, "TND")

        # Simple CAGR over available range
        cagr_pct = 0.0
        if len(rows) >= 13:
            price_12m_ago = rows[12].price
            if price_12m_ago > 0:
                cagr_pct = round((latest_price / price_12m_ago - 1) * 100, 2)

        return {
            "series_name": series_name,
            "latest_price": round(latest_price, 2),
            "unit": unit,
            "cagr_pct": cagr_pct,
            "market_series": series_name,
        }
