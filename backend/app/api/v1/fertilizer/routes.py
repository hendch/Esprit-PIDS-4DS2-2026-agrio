from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.di import get_db
from app.middleware.auth import CurrentUser
from app.modules.farms.models import Field
from app.modules.farms.repository import FarmRepository
from app.modules.farms.service import FarmService
from app.modules.fertilizer.service import FertilizerRecommendationService

from .schemas import FertilizerRecommendationRequest, FertilizerRecommendationResponse

router = APIRouter()
_fertilizer_service = FertilizerRecommendationService()


def get_farm_service(db: AsyncSession = Depends(get_db)) -> FarmService:
    return FarmService(FarmRepository(db))


def get_fertilizer_service() -> FertilizerRecommendationService:
    return _fertilizer_service


async def _current_farm_id(current_user: dict, service: FarmService) -> uuid.UUID:
    user_id = uuid.UUID(current_user["user_id"])
    farm = await service.get_or_create_default_farm(user_id)
    return farm.id


async def _get_owned_field(
    field_id: str,
    current_user: dict,
    service: FarmService,
) -> Field:
    try:
        parsed_field_id = uuid.UUID(field_id)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Field not found") from exc

    farm_id = await _current_farm_id(current_user, service)
    field = await service.get_field(parsed_field_id)
    if field is None or field.farm_id != farm_id:
        raise HTTPException(status_code=404, detail="Field not found")
    return field


@router.post("/recommendations/{field_id}", response_model=FertilizerRecommendationResponse)
async def recommend_fertilizer(
    field_id: str,
    body: FertilizerRecommendationRequest,
    current_user: dict = CurrentUser,
    farm_service: FarmService = Depends(get_farm_service),
    fertilizer_service: FertilizerRecommendationService = Depends(get_fertilizer_service),
) -> FertilizerRecommendationResponse:
    field = await _get_owned_field(field_id, current_user, farm_service)
    try:
        recommendation = fertilizer_service.recommend(field, body)
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return FertilizerRecommendationResponse(**recommendation)
