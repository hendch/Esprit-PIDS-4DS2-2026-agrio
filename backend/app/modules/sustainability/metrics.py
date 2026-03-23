from __future__ import annotations


def water_footprint(total_liters: float, yield_kg: float) -> float:
    if yield_kg == 0.0:
        return 0.0
    return total_liters / yield_kg


def chemical_reduction_pct(baseline: float, current: float) -> float:
    if baseline == 0.0:
        return 0.0
    return ((baseline - current) / baseline) * 100.0
