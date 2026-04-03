from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Float, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.persistence.base_model import Base, TimestampMixin


class DiseaseScan(Base, TimestampMixin):
    __tablename__ = "disease_scans"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    field_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("fields.id"), nullable=True)
    media_id: Mapped[uuid.UUID | None] = mapped_column(nullable=True)
    disease_name: Mapped[str | None] = mapped_column(String, nullable=True)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    severity: Mapped[str | None] = mapped_column(String, nullable=True)
    guidance: Mapped[str | None] = mapped_column(Text, nullable=True)
    plant_name: Mapped[str | None] = mapped_column(String, nullable=True)
    is_healthy: Mapped[bool] = mapped_column(default=False)
    scanned_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
