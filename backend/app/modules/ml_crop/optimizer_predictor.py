from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pandas as pd
from xgboost import XGBClassifier, XGBRegressor


class AgronomicOptimizerPredictor:
    def __init__(self) -> None:
        bundle_dir = Path(__file__).resolve().parent / "optimizer_bundle"

        if not bundle_dir.exists():
            raise RuntimeError(
                "optimizer_bundle directory not found. "
                "Place the tuned exported models under app/modules/ml_crop/optimizer_bundle/."
            )

        metadata_path = bundle_dir / "optimizer_metadata.json"
        if not metadata_path.exists():
            raise RuntimeError("optimizer_metadata.json not found in optimizer_bundle.")

        self._metadata = json.loads(metadata_path.read_text(encoding="utf-8"))

        self._yield_model = XGBRegressor()
        self._yield_model.load_model(bundle_dir / "yield_model.json")

        self._yield_class_model = XGBClassifier()
        self._yield_class_model.load_model(bundle_dir / "yield_class_model.json")

        self._stress_model = XGBClassifier()
        self._stress_model.load_model(bundle_dir / "stress_model.json")

        self._vigor_model = XGBClassifier()
        self._vigor_model.load_model(bundle_dir / "vigor_model.json")

        self._feature_names_yield = self._metadata["feature_names_yield"]
        self._feature_names_yield_class = self._metadata["feature_names_yield_class"]
        self._feature_names_stress = self._metadata["feature_names_stress"]
        self._feature_names_vigor = self._metadata["feature_names_vigor"]
        self._categorical_features = set(self._metadata.get("categorical_features", []))

        self._yield_class_labels = {
            int(k): v for k, v in self._metadata["yield_class_thresholds"]["labels"].items()
        }
        self._stress_class_labels = {
            int(k): v for k, v in self._metadata["stress_class_thresholds"]["labels"].items()
        }
        self._vigor_class_labels = {
            int(k): v for k, v in self._metadata["vigor_class_thresholds"]["labels"].items()
        }

    def _frame_for_features(self, payload: dict[str, Any], feature_names: list[str]) -> pd.DataFrame:
        missing = [name for name in feature_names if name not in payload]
        if missing:
            raise ValueError(f"Missing optimizer features: {missing}")

        row = {name: payload[name] for name in feature_names}
        df = pd.DataFrame([row])

        for col in feature_names:
            if col in self._categorical_features and col in df.columns:
                df[col] = df[col].astype("category")

        return df

    @staticmethod
    def derive_optimization_priority(
        yield_class_label: str,
        stress_class_label: str,
        vigor_class_label: str,
        irrigated: bool,
        rain_sum_forecast: float | None = None,
    ) -> str:
        score = 0

        if yield_class_label == "low":
            score += 2
        elif yield_class_label == "medium":
            score += 1

        if stress_class_label == "high":
            score += 2
        elif stress_class_label == "medium":
            score += 1

        if vigor_class_label == "poor":
            score += 2
        elif vigor_class_label == "moderate":
            score += 1

        if not irrigated:
            score += 1

        if rain_sum_forecast is not None and rain_sum_forecast < 2:
            score += 1

        if score >= 6:
            return "intervene-soon"
        if score >= 3:
            return "monitor-closely"
        return "stable"

    def predict(self, payload: dict[str, Any]) -> dict[str, Any]:
        X_yield = self._frame_for_features(payload, self._feature_names_yield)
        X_yield_class = self._frame_for_features(payload, self._feature_names_yield_class)
        X_stress = self._frame_for_features(payload, self._feature_names_stress)
        X_vigor = self._frame_for_features(payload, self._feature_names_vigor)

        pred_yield = float(self._yield_model.predict(X_yield)[0])

        pred_yield_class_idx = int(self._yield_class_model.predict(X_yield_class)[0])
        pred_stress_class_idx = int(self._stress_model.predict(X_stress)[0])
        pred_vigor_class_idx = int(self._vigor_model.predict(X_vigor)[0])

        yield_class_label = self._yield_class_labels[pred_yield_class_idx]
        stress_class_label = self._stress_class_labels[pred_stress_class_idx]
        vigor_class_label = self._vigor_class_labels[pred_vigor_class_idx]

        optimization_priority = self.derive_optimization_priority(
            yield_class_label=yield_class_label,
            stress_class_label=stress_class_label,
            vigor_class_label=vigor_class_label,
            irrigated=bool(payload.get("irrigated_ha", 0) > 0),
            rain_sum_forecast=float(payload["rain_sum"]) if payload.get("rain_sum") is not None else None,
        )

        return {
            "yield_hg_per_ha": pred_yield,
            "yield_class": yield_class_label,
            "stress_class": stress_class_label,
            "vigor_class": vigor_class_label,
            "optimization_priority": optimization_priority,
        }


optimizer_predictor = AgronomicOptimizerPredictor()
