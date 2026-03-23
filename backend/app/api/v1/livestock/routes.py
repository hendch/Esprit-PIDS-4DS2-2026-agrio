from __future__ import annotations

from datetime import date

from fastapi import APIRouter

from .schemas import (
    AnimalCreate,
    AnimalResponse,
    HealthEventCreate,
    HealthEventResponse,
)

router = APIRouter()

_STUB_ANIMAL = AnimalResponse(
    id="animal-001",
    farm_id="farm-001",
    name="Bessie",
    animal_type="cattle",
    breed="Holstein",
    birth_date=date(2022, 3, 15),
    tag_id="TAG-0042",
    status="healthy",
)

_STUB_EVENT = HealthEventResponse(
    id="evt-001",
    animal_id="animal-001",
    event_type="vaccination",
    description="Annual brucellosis vaccine",
    date=date.today(),
)


@router.get("/", response_model=list[AnimalResponse])
async def list_animals() -> list[AnimalResponse]:
    # TODO: inject service
    return [_STUB_ANIMAL]


@router.post("/", response_model=AnimalResponse, status_code=201)
async def create_animal(body: AnimalCreate) -> AnimalResponse:
    # TODO: inject service
    return _STUB_ANIMAL


@router.get("/{animal_id}", response_model=AnimalResponse)
async def get_animal(animal_id: str) -> AnimalResponse:
    # TODO: inject service
    return _STUB_ANIMAL


@router.patch("/{animal_id}", response_model=AnimalResponse)
async def update_animal(animal_id: str) -> AnimalResponse:
    # TODO: inject service
    return _STUB_ANIMAL


@router.post("/health-events", response_model=HealthEventResponse, status_code=201)
async def create_health_event(body: HealthEventCreate) -> HealthEventResponse:
    # TODO: inject service
    return _STUB_EVENT


@router.get("/health-events/{animal_id}", response_model=list[HealthEventResponse])
async def get_health_events(animal_id: str) -> list[HealthEventResponse]:
    # TODO: inject service
    return [_STUB_EVENT]


@router.get("/alerts", response_model=list[dict])
async def get_alerts() -> list[dict]:
    # TODO: inject service
    return [
        {
            "id": "alert-001",
            "animal_id": "animal-001",
            "type": "vaccination_due",
            "message": "Bessie vaccination due in 3 days",
        }
    ]
