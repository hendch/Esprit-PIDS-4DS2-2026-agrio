from __future__ import annotations

import uuid

from sqlalchemy import JSON, Float, ForeignKey, String
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
    name: Mapped[str] = mapped_column(String)
    crop_type: Mapped[str | None] = mapped_column(String, nullable=True)
    area_ha: Mapped[float | None] = mapped_column(Float, nullable=True)
    boundary: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    farm: Mapped[Farm] = relationship(back_populates="fields")
