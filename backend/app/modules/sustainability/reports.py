from __future__ import annotations

import uuid


async def generate_sustainability_report(
    farm_id: uuid.UUID,
    period: str,
) -> dict:
    # TODO: aggregate real sustainability data from farm metrics
    return {
        "farm_id": str(farm_id),
        "period": period,
        "water_footprint_l_per_kg": None,
        "chemical_reduction_pct": None,
        "generated": False,
    }
