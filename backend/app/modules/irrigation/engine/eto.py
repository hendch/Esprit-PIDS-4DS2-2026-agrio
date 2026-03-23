from __future__ import annotations


def compute_eto(
    t_min: float,
    t_max: float,
    humidity: float,
    wind_speed: float,
    solar_radiation: float,
) -> float:
    """Simplified Penman-Monteith (FAO-56) via the Hargreaves equation.

    Returns reference evapotranspiration ET0 in mm/day.
    """
    t_mean = (t_min + t_max) / 2.0
    return 0.0023 * (t_mean + 17.8) * (t_max - t_min) ** 0.5 * solar_radiation
