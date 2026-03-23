from __future__ import annotations


def compute_ndvi(nir: float, red: float) -> float:
    denom = nir + red
    if denom == 0.0:
        return 0.0
    return (nir - red) / denom


def compute_ndvi_grid(
    nir_band: list[list[float]],
    red_band: list[list[float]],
) -> list[list[float]]:
    return [
        [compute_ndvi(nir_band[r][c], red_band[r][c]) for c in range(len(nir_band[r]))]
        for r in range(len(nir_band))
    ]
