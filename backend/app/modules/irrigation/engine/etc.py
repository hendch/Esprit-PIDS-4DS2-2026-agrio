from __future__ import annotations

from app.modules.irrigation.engine.kc_tables import KC_TABLE


def compute_etc(eto: float, kc: float) -> float:
    return eto * kc


def get_etc_for_field(eto: float, crop_type: str, growth_stage: str) -> float:
    crop = KC_TABLE.get(crop_type)
    if crop is None:
        raise ValueError(f"Unknown crop type: {crop_type}")
    kc = crop.get(growth_stage)
    if kc is None:
        raise ValueError(
            f"Unknown growth stage '{growth_stage}' for crop '{crop_type}'"
        )
    return compute_etc(eto, kc)
