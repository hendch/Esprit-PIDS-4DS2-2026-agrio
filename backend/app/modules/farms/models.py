from __future__ import annotations

import uuid

from sqlalchemy import Boolean, Date, Float, ForeignKey, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.persistence.base_model import Base, TimestampMixin


class Farm(Base, TimestampMixin):
    __tablename__ = "farms"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String)
    owner_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    location: Mapped[str | None] = mapped_column(String, nullable=True)

    fields: Mapped[list[Field]] = relationship(back_populates="farm", lazy="selectin")


class Field(Base, TimestampMixin):
    __tablename__ = "fields"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    farm_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("farms.id"), index=True)

    # Basic identity
    name: Mapped[str] = mapped_column(String)
    crop_type: Mapped[str | None] = mapped_column(String, nullable=True)

    # Geometry / spatial data
    area_ha: Mapped[float | None] = mapped_column(Float, nullable=True)
    boundary: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    centroid_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    centroid_lon: Mapped[float | None] = mapped_column(Float, nullable=True)
    governorate: Mapped[str | None] = mapped_column(String, nullable=True)

    # Agronomic profile
    planting_date: Mapped[str | None] = mapped_column(Date, nullable=True)
    irrigated: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    irrigation_method: Mapped[str | None] = mapped_column(String, nullable=True)
    field_notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    farm: Mapped[Farm] = relationship(back_populates="fields")
