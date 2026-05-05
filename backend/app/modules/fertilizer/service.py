from __future__ import annotations

import json
import re
from functools import cached_property
from pathlib import Path
from typing import Any

import joblib
import pandas as pd

from app.api.v1.fertilizer.schemas import FertilizerRecommendationRequest
from app.modules.farms.models import Field
from app.settings import settings


DEFAULT_FEATURES = [
    "crop",
    "soil_type",
    "texture",
    "drainage",
    "ph",
    "total_nitrogen",
    "organic_carbon",
    "ndvi",
    "target_yield_t_ha",
    "area_ha",
    "fertility_level",
]

CROP_BASE_NEEDS_KG_HA = {
    "wheat": {"N": 90.0, "P": 45.0, "K": 35.0},
    "barley": {"N": 70.0, "P": 35.0, "K": 30.0},
    "tomato": {"N": 140.0, "P": 60.0, "K": 160.0},
    "potato": {"N": 120.0, "P": 70.0, "K": 180.0},
    "olive": {"N": 60.0, "P": 25.0, "K": 70.0},
}

CROP_GROUP_BASE_NEEDS_KG_HA = {
    "cereal": {"N": 90.0, "P": 40.0, "K": 35.0},
    "pulse": {"N": 45.0, "P": 35.0, "K": 30.0},
    "oilseed": {"N": 80.0, "P": 40.0, "K": 60.0},
    "fruit_tree": {"N": 75.0, "P": 35.0, "K": 95.0},
    "nut_orchard": {"N": 65.0, "P": 30.0, "K": 75.0},
    "citrus": {"N": 120.0, "P": 50.0, "K": 120.0},
    "vine": {"N": 80.0, "P": 35.0, "K": 100.0},
    "fruiting_vegetable": {"N": 130.0, "P": 60.0, "K": 150.0},
    "leafy_vegetable": {"N": 100.0, "P": 45.0, "K": 120.0},
    "root_vegetable": {"N": 110.0, "P": 60.0, "K": 140.0},
    "cucurbit": {"N": 110.0, "P": 55.0, "K": 140.0},
    "industrial": {"N": 90.0, "P": 45.0, "K": 80.0},
    "aromatic": {"N": 60.0, "P": 30.0, "K": 50.0},
    "forage": {"N": 60.0, "P": 35.0, "K": 45.0},
}


CROP_ALIASES = {
    "tomatoes": "tomato",
    "potatoes": "potato",
    "olives": "olive",
    "cereals": "wheat",
}

CROP_GROUPS = {
    "wheat": "cereal",
    "barley": "cereal",
    "cereals": "cereal",
    "oats": "cereal",
    "sorghum": "cereal",
    "triticale": "cereal",
    "beans": "pulse",
    "broad_beans_and_horse_beans": "pulse",
    "chick_peas": "pulse",
    "lentils": "pulse",
    "peas": "pulse",
    "other_beans": "pulse",
    "other_pulses": "pulse",
    "vetches": "forage",
    "tomato": "fruiting_vegetable",
    "tomatoes": "fruiting_vegetable",
    "chillies_and_peppers": "fruiting_vegetable",
    "eggplants_aubergines": "fruiting_vegetable",
    "other_vegetables_fresh": "fruiting_vegetable",
    "potato": "root_vegetable",
    "potatoes": "root_vegetable",
    "carrots_and_turnips": "root_vegetable",
    "onions_and_shallots": "root_vegetable",
    "green_garlic": "root_vegetable",
    "sugar_beet": "root_vegetable",
    "cabbages": "leafy_vegetable",
    "cauliflowers_and_broccoli": "leafy_vegetable",
    "lettuce_and_chicory": "leafy_vegetable",
    "spinach": "leafy_vegetable",
    "artichokes": "leafy_vegetable",
    "cantaloupes_and_other_melons": "cucurbit",
    "cucumbers_and_gherkins": "cucurbit",
    "pumpkins_squash_and_gourds": "cucurbit",
    "watermelons": "cucurbit",
    "olive": "fruit_tree",
    "olives": "fruit_tree",
    "apples": "fruit_tree",
    "apricots": "fruit_tree",
    "avocados": "fruit_tree",
    "cherries": "fruit_tree",
    "dates": "fruit_tree",
    "figs": "fruit_tree",
    "kiwi_fruit": "fruit_tree",
    "peaches_and_nectarines": "fruit_tree",
    "pears": "fruit_tree",
    "plums_and_sloes": "fruit_tree",
    "quinces": "fruit_tree",
    "other_fruits": "fruit_tree",
    "other_stone_fruits": "fruit_tree",
    "other_tropical_fruits": "fruit_tree",
    "other_berries_and_fruits": "fruit_tree",
    "grapes": "vine",
    "oranges": "citrus",
    "lemons_and_limes": "citrus",
    "pomelos_and_grapefruits": "citrus",
    "tangerines_mandarins_clementines": "citrus",
    "other_citrus_fruit": "citrus",
    "almonds": "nut_orchard",
    "hazelnuts": "nut_orchard",
    "pistachios": "nut_orchard",
    "locust_beans_carobs": "nut_orchard",
    "other_nuts_excluding_wild_edible_nuts_and_groundnuts": "nut_orchard",
    "linseed": "oilseed",
    "rape_or_colza_seed": "oilseed",
    "sunflower_seed": "oilseed",
    "seed_cotton_unginned": "industrial",
    "unmanufactured_tobacco": "industrial",
    "pyrethrum_dried_flowers": "industrial",
    "spices_mixed": "aromatic",
    "other_stimulant_spice_and_aromatic_crops": "aromatic",
}


def _resolve_backend_path(path: str) -> Path:
    candidate = Path(path)
    if candidate.is_absolute():
        return candidate
    return Path(__file__).resolve().parents[3] / candidate


def _fertility_level(ndvi: float) -> str:
    if ndvi < 0.3:
        return "low"
    if ndvi < 0.6:
        return "medium"
    return "high"


def _parse_npk_formula(formula: str) -> tuple[float, float, float]:
    match = re.search(r"(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)", formula)
    if not match:
        if formula.lower() == "urea":
            return 46.0, 0.0, 0.0
        return 15.0, 15.0, 15.0
    return tuple(float(part) for part in match.groups())


def _fertilizer_crop_key(value: str | None) -> str:
    crop = (value or "wheat").strip().lower()
    return CROP_ALIASES.get(crop, crop)


def _crop_group(crop: str) -> str:
    return CROP_GROUPS.get(crop, "cereal")


class FertilizerRecommendationService:
    @cached_property
    def _model_artifact(self) -> Any:
        model_path = _resolve_backend_path(settings.fertilizer_model_path)
        if not model_path.exists():
            raise FileNotFoundError(
                f"Fertilizer model not found at {model_path}. "
                "Place fertilizer_recommendation_rf.joblib there or set "
                "AGRIO_FERTILIZER_MODEL_PATH."
            )
        return joblib.load(model_path)

    @cached_property
    def _model(self) -> Any:
        if isinstance(self._model_artifact, dict):
            model = self._model_artifact.get("model") or self._model_artifact.get("estimator")
            if model is None:
                raise ValueError("Fertilizer model artifact must contain a 'model' key.")
            return model
        return self._model_artifact

    @cached_property
    def _feature_names(self) -> list[str]:
        if isinstance(self._model_artifact, dict):
            artifact_features = (
                self._model_artifact.get("features")
                or self._model_artifact.get("feature_names")
            )
            if isinstance(artifact_features, list):
                return [str(feature) for feature in artifact_features]

        model_features = getattr(self._model, "feature_names_in_", None)
        if model_features is not None:
            return [str(feature) for feature in model_features]

        schema_path = _resolve_backend_path(settings.fertilizer_feature_schema_path)
        if not schema_path.exists():
            return DEFAULT_FEATURES

        with schema_path.open("r", encoding="utf-8") as schema_file:
            schema = json.load(schema_file)

        if isinstance(schema, list):
            return [str(feature) for feature in schema]
        if isinstance(schema, dict):
            features = schema.get("features") or schema.get("feature_names")
            if isinstance(features, list):
                return [str(feature) for feature in features]

        return DEFAULT_FEATURES

    def recommend(self, field: Field, body: FertilizerRecommendationRequest) -> dict[str, Any]:
        crop = _fertilizer_crop_key(body.crop or field.crop_type)
        crop_group = _crop_group(crop)
        area_ha = float(field.area_ha or 1.0)
        features = self._build_features(field, body, crop, crop_group, area_ha)
        prediction_frame = pd.DataFrame([{name: features.get(name, 0) for name in self._feature_names}])

        formula = str(self._model.predict(prediction_frame)[0])
        confidence = self._predict_confidence(prediction_frame, formula)
        nutrient_need = self._nutrient_need(crop, crop_group, body.target_yield_t_ha, body.ndvi)
        fertilizer_kg_per_ha = self._fertilizer_kg_per_ha(formula, nutrient_need)
        total_fertilizer_kg = fertilizer_kg_per_ha * area_ha

        return {
            "field_id": str(field.id),
            "crop": crop,
            "crop_group": crop_group,
            "formula": formula,
            "confidence": confidence,
            "area_ha": round(area_ha, 2),
            "target_yield_t_ha": body.target_yield_t_ha,
            "fertilizer_kg_per_ha": round(fertilizer_kg_per_ha, 2),
            "total_fertilizer_kg": round(total_fertilizer_kg, 2),
            "nutrient_need_kg_ha": {key: round(value, 2) for key, value in nutrient_need.items()},
            "model_features": features,
            "explanation": (
                f"The model selected {formula} for {crop} using the {crop_group.replace('_', ' ')} "
                f"nutrient profile, soil type {body.soil_type}, "
                f"{body.ndvi:.2f} NDVI, pH {body.ph:.1f}, and a "
                f"{body.target_yield_t_ha:.1f} t/ha target yield."
            ),
        }

    def _build_features(
        self,
        field: Field,
        body: FertilizerRecommendationRequest,
        crop: str,
        crop_group: str,
        area_ha: float,
    ) -> dict[str, str | float]:
        return {
            "crop": crop,
            "crop_group": crop_group,
            "soil_type": body.soil_type,
            "texture": body.texture,
            "drainage": body.drainage,
            "ph": body.ph,
            "total_nitrogen": body.total_nitrogen,
            "organic_carbon": body.organic_carbon,
            "ndvi": body.ndvi,
            "target_yield_t_ha": body.target_yield_t_ha,
            "area_ha": area_ha,
            "fertility_level": _fertility_level(body.ndvi),
            "field_name": field.name,
        }

    def _predict_confidence(self, prediction_frame: pd.DataFrame, formula: str) -> float | None:
        model = self._model
        if not hasattr(model, "predict_proba") or not hasattr(model, "classes_"):
            return None

        probabilities = model.predict_proba(prediction_frame)[0]
        classes = [str(item) for item in model.classes_]
        try:
            class_index = classes.index(formula)
        except ValueError:
            return None
        return round(float(probabilities[class_index]), 3)

    def _nutrient_need(
        self,
        crop: str,
        crop_group: str,
        target_yield_t_ha: float,
        ndvi: float,
    ) -> dict[str, float]:
        base = CROP_BASE_NEEDS_KG_HA.get(
            crop,
            CROP_GROUP_BASE_NEEDS_KG_HA.get(crop_group, CROP_GROUP_BASE_NEEDS_KG_HA["cereal"]),
        )
        yield_factor = max(target_yield_t_ha / 4.0, 0.5)
        fertility_factor = {"low": 1.2, "medium": 1.0, "high": 0.75}[_fertility_level(ndvi)]
        return {
            nutrient: amount * yield_factor * fertility_factor
            for nutrient, amount in base.items()
        }

    def _fertilizer_kg_per_ha(self, formula: str, nutrient_need: dict[str, float]) -> float:
        n_pct, p_pct, k_pct = _parse_npk_formula(formula)
        candidates = []
        for nutrient, pct in (("N", n_pct), ("P", p_pct), ("K", k_pct)):
            if pct > 0:
                candidates.append(nutrient_need[nutrient] / (pct / 100))
        return max(candidates) if candidates else 0.0
