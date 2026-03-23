from __future__ import annotations


def st_contains(geom_a: str, geom_b: str) -> str:
    return f"ST_Contains({geom_a}, {geom_b})"


def st_area(geom: str) -> str:
    return f"ST_Area({geom}::geography)"
