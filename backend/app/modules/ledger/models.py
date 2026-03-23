from __future__ import annotations

import uuid

from sqlalchemy import JSON, String
from sqlalchemy.orm import Mapped, mapped_column

from app.persistence.base_model import Base, TimestampMixin


class LedgerEntry(Base, TimestampMixin):
    __tablename__ = "ledger_entries"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    farm_id: Mapped[uuid.UUID] = mapped_column(index=True)
    event_type: Mapped[str] = mapped_column(String)
    payload: Mapped[dict] = mapped_column(JSON)
    hash: Mapped[str] = mapped_column(String, unique=True)
    prev_hash: Mapped[str | None] = mapped_column(String, nullable=True)
