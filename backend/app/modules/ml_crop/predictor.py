import json
import logging
from pathlib import Path
from typing import Any, Dict, List

import numpy as np
import pandas as pd
import xgboost as xgb

logger = logging.getLogger(__name__)


class YieldPredictor:
    def __init__(self) -> None:
        self.model: xgb.Booster | None = None
        self.feature_names: List[str] = []
        self.categorical_features: List[str] = []
        self.target_transform: str = "none"
        self.model_variant: str = "unknown"
        self.model_loaded: bool = False
        self._load()

    def _artifact_dir(self) -> Path:
        return Path(__file__).resolve().parent

    def _load(self) -> None:
        artifact_dir = self._artifact_dir()
        model_path = artifact_dir / "yield_model.json"
        feature_names_path = artifact_dir / "feature_names.json"

        if not model_path.exists():
            logger.warning("Yield model not found at %s", model_path)
            return

        if not feature_names_path.exists():
            logger.warning("Feature names file not found at %s", feature_names_path)
            return

        with open(feature_names_path, "r", encoding="utf-8") as f:
            payload = json.load(f)

        if isinstance(payload, list):
            # backward-compatible format
            self.feature_names = payload
            self.categorical_features = []
            self.target_transform = "none"
            self.model_variant = "unknown"
        elif isinstance(payload, dict):
            self.feature_names = payload.get("feature_names", [])
            self.categorical_features = payload.get("categorical_features", [])
            self.target_transform = payload.get("target_transform", "none")
            self.model_variant = payload.get("model_variant", "unknown")
        else:
            raise ValueError("feature_names.json must be either a list or a dict")

        booster = xgb.Booster()
        booster.load_model(str(model_path))

        self.model = booster
        self.model_loaded = True

        logger.info(
            "Yield predictor loaded: %s | features=%s | target_transform=%s",
            self.model_variant,
            len(self.feature_names),
            self.target_transform,
        )

    def _prepare_dataframe(self, input_data: Dict[str, Any]) -> pd.DataFrame:
        if not self.model_loaded or self.model is None:
            raise RuntimeError("Yield model is not loaded")

        missing = [col for col in self.feature_names if col not in input_data]
        if missing:
            raise ValueError(f"Missing required features: {missing}")

        row = {col: input_data[col] for col in self.feature_names}
        X = pd.DataFrame([row], columns=self.feature_names)

        inferred_categorical = list(self.categorical_features)
        if not inferred_categorical:
            inferred_categorical = [col for col in X.columns if X[col].dtype == "object"]

        for col in inferred_categorical:
            if col in X.columns:
                X[col] = X[col].astype("category")

        return X

    def predict(self, input_data: Dict[str, Any]) -> float:
        X = self._prepare_dataframe(input_data)

        dmatrix = xgb.DMatrix(X, enable_categorical=True)
        pred = float(self.model.predict(dmatrix)[0])

        # Future-proofing:
        # your final selected model currently uses no target transform,
        # but keep this logic in case you export a log-model later.
        if self.target_transform == "log1p":
            pred = float(np.expm1(pred))

        return pred


yield_predictor = YieldPredictor()