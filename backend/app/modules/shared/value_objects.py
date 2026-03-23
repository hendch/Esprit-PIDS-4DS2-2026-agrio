from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import date


@dataclass(frozen=True)
class GeoPoint:
    lat: float
    lon: float


@dataclass(frozen=True)
class FieldId:
    value: uuid.UUID

    @classmethod
    def generate(cls) -> FieldId:
        return cls(value=uuid.uuid4())

    def __str__(self) -> str:
        return str(self.value)


@dataclass(frozen=True)
class FarmId:
    value: uuid.UUID

    @classmethod
    def generate(cls) -> FarmId:
        return cls(value=uuid.uuid4())

    def __str__(self) -> str:
        return str(self.value)


@dataclass(frozen=True)
class DateRange:
    start: date
    end: date

    def __post_init__(self) -> None:
        if self.start > self.end:
            msg = f"start ({self.start}) must be <= end ({self.end})"
            raise ValueError(msg)
