from __future__ import annotations

KC_TABLE: dict[str, dict[str, float]] = {
    "wheat": {
        "initial": 0.30,
        "development": 0.70,
        "mid": 1.15,
        "late": 0.25,
    },
    "maize": {
        "initial": 0.30,
        "development": 0.75,
        "mid": 1.20,
        "late": 0.60,
    },
    "tomato": {
        "initial": 0.60,
        "development": 0.85,
        "mid": 1.15,
        "late": 0.80,
    },
    "rice": {
        "initial": 1.05,
        "development": 1.10,
        "mid": 1.20,
        "late": 0.90,
    },
    "barley": {
        "initial": 0.30,
        "development": 0.70,
        "mid": 1.15,
        "late": 0.25,
    },
}
