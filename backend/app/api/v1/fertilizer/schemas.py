from __future__ import annotations

from pydantic import BaseModel, Field


class FertilizerRecommendationRequest(BaseModel):
    crop: str | None = None
    target_yield_t_ha: float = Field(gt=0)
    soil_type: str = "Cambisol"
    texture: str = "loam"
    drainage: str = "moderate"
    ph: float = Field(default=7.0, ge=3.0, le=10.0)
    total_nitrogen: float = Field(default=0.12, ge=0)
    organic_carbon: float = Field(default=1.2, ge=0)
    ndvi: float = Field(default=0.72, ge=0, le=1)


class FertilizerRecommendationResponse(BaseModel):
    field_id: str
    crop: str
    formula: str
    confidence: float | None
    area_ha: float
    target_yield_t_ha: float
    fertilizer_kg_per_ha: float
    total_fertilizer_kg: float
    nutrient_need_kg_ha: dict[str, float]
    model_features: dict[str, str | float]
    explanation: str
