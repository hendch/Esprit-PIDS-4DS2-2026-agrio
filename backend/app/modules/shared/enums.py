from __future__ import annotations

from enum import StrEnum


class CropType(StrEnum):
    WHEAT = "wheat"
    CORN = "corn"
    RICE = "rice"
    SOYBEAN = "soybean"
    BARLEY = "barley"
    COTTON = "cotton"
    SUGARCANE = "sugarcane"
    SUNFLOWER = "sunflower"
    POTATO = "potato"
    TOMATO = "tomato"
    OLIVE = "olive"
    GRAPE = "grape"
    OTHER = "other"


class GrowthStage(StrEnum):
    INITIAL = "initial"
    DEVELOPMENT = "development"
    MID_SEASON = "mid_season"
    LATE_SEASON = "late_season"
    HARVEST = "harvest"


class AnimalType(StrEnum):
    CATTLE = "cattle"
    SHEEP = "sheep"
    GOAT = "goat"
    POULTRY = "poultry"
    SWINE = "swine"
    HORSE = "horse"
    OTHER = "other"


class AlertSeverity(StrEnum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class Season(StrEnum):
    SPRING = "spring"
    SUMMER = "summer"
    AUTUMN = "autumn"
    WINTER = "winter"
