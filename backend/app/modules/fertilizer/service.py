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


CROP_ALIASES = {
    "tomatoes": "tomato",
    "potatoes": "potato",
    "olives": "olive",
    "cereals": "wheat",
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
        area_ha = float(field.area_ha or 1.0)
        features = self._build_features(field, body, crop, area_ha)
        prediction_frame = pd.DataFrame([{name: features.get(name, 0) for name in self._feature_names}])

        formula = str(self._model.predict(prediction_frame)[0])
        confidence = self._predict_confidence(prediction_frame, formula)
        nutrient_need = self._nutrient_need(crop, body.target_yield_t_ha, body.ndvi)
        fertilizer_kg_per_ha = self._fertilizer_kg_per_ha(formula, nutrient_need)
        total_fertilizer_kg = fertilizer_kg_per_ha * area_ha

        return {
            "field_id": str(field.id),
            "crop": crop,
            "formula": formula,
            "confidence": confidence,
            "area_ha": round(area_ha, 2),
            "target_yield_t_ha": body.target_yield_t_ha,
            "fertilizer_kg_per_ha": round(fertilizer_kg_per_ha, 2),
            "total_fertilizer_kg": round(total_fertilizer_kg, 2),
            "nutrient_need_kg_ha": {key: round(value, 2) for key, value in nutrient_need.items()},
            "model_features": features,
            "explanation": (
                f"The model selected {formula} for {crop} using soil type {body.soil_type}, "
                f"{body.ndvi:.2f} NDVI, pH {body.ph:.1f}, and a "
                f"{body.target_yield_t_ha:.1f} t/ha target yield."
            ),
        }

    def _build_features(
        self,
        field: Field,
        body: FertilizerRecommendationRequest,
        crop: str,
        area_ha: float,
    ) -> dict[str, str | float]:
        return {
            "crop": crop,
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

    def _nutrient_need(self, crop: str, target_yield_t_ha: float, ndvi: float) -> dict[str, float]:
        base = CROP_BASE_NEEDS_KG_HA.get(crop, CROP_BASE_NEEDS_KG_HA["wheat"])
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
