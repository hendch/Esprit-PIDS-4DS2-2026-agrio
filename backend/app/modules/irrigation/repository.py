from __future__ import annotations

import sqlite3
from datetime import datetime
from pathlib import Path

_DB_PATH = Path(__file__).resolve().parent.parent.parent.parent / "irrigation.db"


class IrrigationRepository:
    """SQLite-backed irrigation event store (MVP)."""

    def __init__(self, db_path: str | Path = _DB_PATH) -> None:
        self._db_path = str(db_path)

    def init_db(self) -> None:
        conn = sqlite3.connect(self._db_path)
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS irrigation_events (
                id              INTEGER PRIMARY KEY,
                timestamp       TEXT,
                moisture_level  REAL,
                water_amount    REAL,
                duration        INTEGER,
                next_irrigation TEXT,
                crop_type       TEXT,
                weather_conditions TEXT
            )
            """
        )
        conn.commit()
        conn.close()

    def log_event(
        self,
        moisture: float,
        amount: float,
        duration: int,
        next_date: str,
        crop: str,
        weather: str,
    ) -> None:
        conn = sqlite3.connect(self._db_path)
        conn.execute(
            """
            INSERT INTO irrigation_events
                (timestamp, moisture_level, water_amount, duration,
                 next_irrigation, crop_type, weather_conditions)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (datetime.now().isoformat(), moisture, amount, duration, next_date, crop, weather),
        )
        conn.commit()
        conn.close()

    def get_history(self, limit: int = 10) -> list[dict]:
        conn = sqlite3.connect(self._db_path)
        conn.row_factory = sqlite3.Row
        rows = conn.execute(
            "SELECT * FROM irrigation_events ORDER BY timestamp DESC LIMIT ?",
            (limit,),
        ).fetchall()
        conn.close()
        return [dict(r) for r in rows]
