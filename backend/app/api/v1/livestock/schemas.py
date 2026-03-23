from __future__ import annotations

from datetime import date

from pydantic import BaseModel


class AnimalCreate(BaseModel):
    name: str
    animal_type: str
    breed: str
    birth_date: date
    tag_id: str


class AnimalResponse(BaseModel):
    id: str
    farm_id: str
    name: str
    animal_type: str
    breed: str
    birth_date: date
    tag_id: str
    status: str


class HealthEventCreate(BaseModel):
    animal_id: str
    event_type: str
    description: str
    date: date


class HealthEventResponse(BaseModel):
    id: str
    animal_id: str
    event_type: str
    description: str
    date: date
