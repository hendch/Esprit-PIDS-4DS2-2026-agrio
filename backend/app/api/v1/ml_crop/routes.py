from typing import Any, Dict
import logging
import os
import sys

import numpy as np
import xgboost as xgb
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.modules.ml_crop.predictor import yield_predictor
import app.modules.ml_crop.predictor as predictor_module

logger = logging.getLogger(__name__)

router = APIRouter()


class YieldPredictionRequest(BaseModel):
    data: Dict[str, Any] = Field(..., description="Feature dictionary for yield prediction")


@router.get("/status")
async def model_status() -> Dict[str, Any]:
    return {
        "model_loaded": yield_predictor.model_loaded,
        "model_variant": yield_predictor.model_variant,
        "target_transform": yield_predictor.target_transform,
        "feature_count": len(yield_predictor.feature_names),

        # TEMP DEBUG INFO
        "pid": os.getpid(),
        "python": sys.executable,
        "numpy_version": np.__version__,
        "xgboost_version": xgb.__version__,
        "predictor_file": predictor_module.__file__,
    }


@router.post("/predict-yield")
async def predict_yield(request: YieldPredictionRequest) -> Dict[str, float]:
    try:
        prediction = yield_predictor.predict(request.data)
        return {"yield_hg_per_ha": prediction}
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Prediction failed inside API route")
        raise HTTPException(status_code=500, detail=f"Prediction failed: {exc}") from exc