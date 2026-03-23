from __future__ import annotations


def mm_to_liters(mm: float, area_m2: float) -> float:
    """Convert millimetres of precipitation/irrigation over an area to litres."""
    return mm * area_m2


def hectares_to_m2(ha: float) -> float:
    return ha * 10_000.0


def m2_to_hectares(m2: float) -> float:
    return m2 / 10_000.0
