from __future__ import annotations

import unicodedata


_GOVERNORATE_ALIAS_MAP = {
    "tunis": "Tunis",
    "ariana": "Ariana",
    "ben arous": "Ben Arous",
    "manouba": "Manouba",
    "bizerte": "Bizerte",
    "beja": "Beja",
    "jendouba": "Jendouba",
    "kef": "Kef",
    "siliana": "Siliana",
    "kairouan": "Kairouan",
    "kasserine": "Kasserine",
    "kasserine governorate": "Kasserine",
    "sidi bouzid": "Sidi Bouzid",
    "sousse": "Sousse",
    "monastir": "Monastir",
    "mahdia": "Mahdia",
    "sfax": "Sfax",
    "gabes": "Gabes",
    "medenine": "Medenine",
    "tataouine": "Tataouine",
    "gafsa": "Gafsa",
    "tozeur": "Tozeur",
    "kebili": "Kebili",
    "zaghouan": "Zaghouan",
    "nabeul": "Nabeul",
}

_CROP_ALIAS_MAP = {
    "almonds": "almonds",
    "almond": "almonds",
    "apples": "apples",
    "apricots": "apricots",
    "artichokes": "artichokes",
    "avocados": "avocados",
    "barley": "barley",
    "beans": "beans",
    "broad beans": "broad_beans_and_horse_beans",
    "horse beans": "broad_beans_and_horse_beans",
    "cabbages": "cabbages",
    "cantaloupes": "cantaloupes_and_other_melons",
    "melons": "cantaloupes_and_other_melons",
    "carrots": "carrots_and_turnips",
    "turnips": "carrots_and_turnips",
    "cauliflower": "cauliflowers_and_broccoli",
    "broccoli": "cauliflowers_and_broccoli",
    "cereals": "cereals",
    "cherries": "cherries",
    "chickpeas": "chick_peas",
    "chillies": "chillies_and_peppers",
    "peppers": "chillies_and_peppers",
    "cucumbers": "cucumbers_and_gherkins",
    "gherkins": "cucumbers_and_gherkins",
    "dates": "dates",
    "eggplants": "eggplants_aubergines",
    "aubergines": "eggplants_aubergines",
    "figs": "figs",
    "grapes": "grapes",
    "garlic": "green_garlic",
    "hazelnuts": "hazelnuts",
    "kiwi": "kiwi_fruit",
    "lemons": "lemons_and_limes",
    "limes": "lemons_and_limes",
    "lentils": "lentils",
    "lettuce": "lettuce_and_chicory",
    "chicory": "lettuce_and_chicory",
    "linseed": "linseed",
    "carobs": "locust_beans_carobs",
    "oats": "oats",
    "olives": "olives",
    "onions": "onions_and_shallots",
    "shallots": "onions_and_shallots",
    "oranges": "oranges",
    "other beans": "other_beans",
    "other citrus fruit": "other_citrus_fruit",
    "other fruits": "other_fruits",
    "other nuts": "other_nuts_excluding_wild_edible_nuts_and_groundnuts",
    "other pulses": "other_pulses",
    "other spice or aromatic crops": "other_stimulant_spice_and_aromatic_crops",
    "other stone fruits": "other_stone_fruits",
    "other tropical fruits": "other_tropical_fruits",
    "other fresh vegetables": "other_vegetables_fresh",
    "other berries": "other_berries_and_fruits",
    "peaches": "peaches_and_nectarines",
    "nectarines": "peaches_and_nectarines",
    "pears": "pears",
    "peas": "peas",
    "pistachios": "pistachios",
    "plums": "plums_and_sloes",
    "sloes": "plums_and_sloes",
    "pomelos": "pomelos_and_grapefruits",
    "grapefruits": "pomelos_and_grapefruits",
    "potatoes": "potatoes",
    "pumpkins": "pumpkins_squash_and_gourds",
    "squash": "pumpkins_squash_and_gourds",
    "gourds": "pumpkins_squash_and_gourds",
    "pyrethrum": "pyrethrum_dried_flowers",
    "quinces": "quinces",
    "rape seed": "rape_or_colza_seed",
    "colza seed": "rape_or_colza_seed",
    "cotton": "seed_cotton_unginned",
    "sorghum": "sorghum",
    "mixed spices": "spices_mixed",
    "spinach": "spinach",
    "strawberries": "strawberries",
    "sugar beet": "sugar_beet",
    "sunflower": "sunflower_seed",
    "tangerines": "tangerines_mandarins_clementines",
    "mandarins": "tangerines_mandarins_clementines",
    "clementines": "tangerines_mandarins_clementines",
    "tomatoes": "tomatoes",
    "triticale": "triticale",
    "tobacco": "unmanufactured_tobacco",
    "vetches": "vetches",
    "watermelons": "watermelons",
    "wheat": "wheat",
}


def _normalize_basic(value: str | None) -> str:
    if not value:
        return ""

    normalized = (
        unicodedata.normalize("NFD", value)
        .encode("ascii", "ignore")
        .decode("utf-8")
        .replace("_", " ")
        .replace("-", " ")
        .replace("governorate", "")
        .replace("gouvernorat", "")
        .strip()
        .lower()
    )

    return " ".join(normalized.split())


def normalize_governorate(value: str | None) -> str | None:
    if not value:
        return None

    normalized = _normalize_basic(value)
    return _GOVERNORATE_ALIAS_MAP.get(normalized, value.strip())


def normalize_crop(value: str | None) -> str | None:
    if not value:
        return None

    normalized = _normalize_basic(value)
    return _CROP_ALIAS_MAP.get(normalized, value.strip().lower())
