from __future__ import annotations


def generate_zones(
    ndvi_grid: list[list[float]],
    num_zones: int = 3,
) -> list[dict]:
    flat = [v for row in ndvi_grid for v in row]
    if not flat:
        return []

    lo, hi = min(flat), max(flat)
    span = hi - lo
    if span == 0.0:
        return [
            {
                "zone_id": 1,
                "label": "uniform",
                "threshold_min": lo,
                "threshold_max": hi,
                "pixel_count": len(flat),
            }
        ]

    labels = {
        1: ["uniform"],
        2: ["low", "high"],
        3: ["low", "medium", "high"],
        4: ["low", "medium-low", "medium-high", "high"],
        5: ["very-low", "low", "medium", "high", "very-high"],
    }
    zone_labels = labels.get(num_zones, [f"zone-{i+1}" for i in range(num_zones)])

    step = span / num_zones
    zones: list[dict] = []
    for i in range(num_zones):
        t_min = lo + i * step
        t_max = lo + (i + 1) * step if i < num_zones - 1 else hi
        count = sum(1 for v in flat if t_min <= v <= t_max) if i == num_zones - 1 else sum(1 for v in flat if t_min <= v < t_max)
        zones.append(
            {
                "zone_id": i + 1,
                "label": zone_labels[i],
                "threshold_min": round(t_min, 6),
                "threshold_max": round(t_max, 6),
                "pixel_count": count,
            }
        )
    return zones
