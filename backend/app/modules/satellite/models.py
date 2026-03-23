from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.persistence.base_model import Base, TimestampMixin


class SatelliteSnapshot(Base, TimestampMixin):
    __tablename__ = "satellite_snapshots"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    field_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("fields.id"), index=True)
    captured_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    provider: Mapped[str] = mapped_column(String)
    raw_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)


class IndexMap(Base, TimestampMixin):
    __tablename__ = "index_maps"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    snapshot_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("satellite_snapshots.id"))
    index_type: Mapped[str] = mapped_column(String)
    values: Mapped[dict] = mapped_column(JSON)


class ZoneMap(Base, TimestampMixin):
    __tablename__ = "zone_maps"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    field_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("fields.id"))
    zones: Mapped[dict] = mapped_column(JSON)
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
