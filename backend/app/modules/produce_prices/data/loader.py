"""ProduceDataLoader — reads and normalises fruits.csv and legumes.csv.

Source files
------------
CSV (comma-separated), identical schema:
  date      : YYYY-MM-DD
  type      : product name (may contain leading/trailing whitespace)
  qte       : quantity traded in tonnes
  pgmin     : wholesale price min in millimes/kg
  pgmax     : wholesale price max in millimes/kg
  pdmin     : retail price min in millimes/kg
  pdmax     : retail price max in millimes/kg

Products
--------
fruits.csv  : clémentine, maltaise, thomson, pommes
legumes.csv : oignon, piment doux, piment piquant, pomme de terre

Zero-price rows (retail_mid == 0) represent seasonal non-trading days, not
data errors.  They are dropped before resampling.

Output frequency: weekly (W-MON), aggregated by mean for prices and sum for qte.
"""
from __future__ import annotations

import logging
from pathlib import Path

import pandas as pd

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

#: Mapping from internal key (ASCII, snake_case) → raw type string in CSV
#: (stripped of whitespace, lowercased for matching).
_PRODUCT_RAW_NAME: dict[str, str] = {
    # fruits
    "clementine": "clémentine",
    "maltaise": "maltaise",
    "thomson": "thomson",
    "pommes": "pommes",
    # legumes
    "oignon": "oignon",
    "piment_doux": "piment doux",
    "piment_piquant": "piment piquant",
    "pomme_de_terre": "pomme de terre",
}

#: Which CSV file each product lives in.
_PRODUCT_CSV: dict[str, str] = {
    "clementine": "fruits.csv",
    "maltaise": "fruits.csv",
    "thomson": "fruits.csv",
    "pommes": "fruits.csv",
    "oignon": "legumes.csv",
    "piment_doux": "legumes.csv",
    "piment_piquant": "legumes.csv",
    "pomme_de_terre": "legumes.csv",
}

#: Category per product.
_PRODUCT_CATEGORY: dict[str, str] = {
    "clementine": "fruit",
    "maltaise": "fruit",
    "thomson": "fruit",
    "pommes": "fruit",
    "oignon": "legume",
    "piment_doux": "legume",
    "piment_piquant": "legume",
    "pomme_de_terre": "legume",
}

#: French display names with proper accents.
_DISPLAY_NAMES: dict[str, str] = {
    "clementine": "Clémentine",
    "maltaise": "Maltaise",
    "thomson": "Thomson",
    "pommes": "Pommes",
    "oignon": "Oignon",
    "piment_doux": "Piment doux",
    "piment_piquant": "Piment piquant",
    "pomme_de_terre": "Pomme de terre",
}

#: All product keys produced by this loader.
ALL_PRODUCTS: tuple[str, ...] = tuple(_PRODUCT_RAW_NAME.keys())

#: Price unit for all series.
UNIT: str = "millimes/kg"

#: Maximum forward-fill gap in weeks when resampling.
_MAX_FFILL_WEEKS: int = 2


# ---------------------------------------------------------------------------
# Module-level helpers
# ---------------------------------------------------------------------------


def _default_data_dir() -> Path:
    """Return the default raw-data directory relative to this source file.

    Resolves to ``<repo_root>/backend/data/produce_prices/raw/`` by walking
    five ``parents`` up from this file's location:
    ``loader.py → data/ → produce_prices/ → modules/ → app/ → backend/``
    and then appending ``data/produce_prices/raw``.
    """
    return Path(__file__).parents[4] / "data" / "produce_prices" / "raw"


def _normalize_type(raw: str) -> str:
    """Strip whitespace and lowercase a raw type value from the CSV."""
    return str(raw).strip().lower()


# ---------------------------------------------------------------------------
# Main class
# ---------------------------------------------------------------------------


class ProduceDataLoader:
    """Load and normalise Tunisian fruits and vegetables price source files.

    The loader reads two CSV files (``fruits.csv`` and ``legumes.csv``) and
    returns per-product DataFrames with a weekly ``DatetimeIndex``.

    Parameters
    ----------
    data_dir : str or Path or None, optional
        Directory that contains ``fruits.csv`` and ``legumes.csv``.
        Resolution order:

        1. Explicit ``data_dir`` argument.
        2. ``settings.produce_data_dir`` (from FastAPI app settings).
        3. Package-relative fallback:
           ``<repo_root>/backend/data/produce_prices/raw/``.

    Examples
    --------
    >>> loader = ProduceDataLoader()
    >>> data = loader.load_all()
    >>> panel = loader.load_panel()
    >>> products = loader.get_product_list()
    """

    def __init__(self, data_dir: str | Path | None = None) -> None:
        if data_dir is not None:
            self._dir = Path(data_dir)
        else:
            try:
                from app.settings import settings  # type: ignore[import]

                self._dir = Path(
                    getattr(settings, "produce_data_dir", _default_data_dir())
                )
            except Exception:
                self._dir = _default_data_dir()

        # Cache parsed CSV files so we only read each once per loader instance.
        self._csv_cache: dict[str, pd.DataFrame] = {}

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def load_all(self) -> dict[str, pd.DataFrame]:
        """Load all eight produce price series and return a dict of DataFrames.

        Only products whose source CSV exists on disk are loaded; missing files
        are silently skipped.

        Returns
        -------
        dict[str, pd.DataFrame]
            Keys are product names from :data:`ALL_PRODUCTS`.  Each value is a
            ``DataFrame`` with:

            - ``DatetimeIndex`` named ``"date"``, weekly (W-MON) frequency,
              sorted ascending.
            - ``retail_mid``    : float — ``(pdmin + pdmax) / 2``
            - ``wholesale_mid`` : float — ``(pgmin + pgmax) / 2``
            - ``qte``           : float — weekly total quantity (tonnes)
            - ``product``       : str   — product key
            - ``category``      : str   — ``'fruit'`` or ``'legume'``
            - ``unit``          : str   — ``'millimes/kg'``

        Notes
        -----
        Zero-price rows (``retail_mid == 0``) are dropped before resampling
        because they represent seasonal non-trading days, not measurement errors.
        Gaps of up to ``_MAX_FFILL_WEEKS`` weeks are forward-filled after
        resampling; longer gaps remain ``NaN``.
        """
        result: dict[str, pd.DataFrame] = {}
        for product_key in ALL_PRODUCTS:
            df = self._load_product(product_key)
            if df is not None:
                result[product_key] = df
        return result

    def load_panel(self) -> pd.DataFrame:
        """Return all produce price series in long format.

        Returns
        -------
        pd.DataFrame
            Columns: ``date``, ``product``, ``category``, ``retail_mid``,
            ``wholesale_mid``, ``qte``, ``unit``.
            Sorted by ``date`` ascending.
        """
        all_data = self.load_all()
        frames: list[pd.DataFrame] = []

        for df in all_data.values():
            frames.append(
                df[["retail_mid", "wholesale_mid", "qte", "product", "category", "unit"]]
                .reset_index()
                .rename(columns={"index": "date"})
            )

        if not frames:
            return pd.DataFrame(
                columns=["date", "product", "category", "retail_mid", "wholesale_mid", "qte", "unit"]
            )

        panel = (
            pd.concat(frames, ignore_index=True)
            .sort_values("date")
            .reset_index(drop=True)
        )
        return panel

    def get_product_list(self) -> list[dict]:
        """Return metadata for all eight produce products.

        Returns
        -------
        list[dict]
            Each entry contains:
            ``product``      — internal key (ASCII snake_case)
            ``category``     — ``'fruit'`` or ``'legume'``
            ``unit``         — ``'millimes/kg'``
            ``display_name`` — French name with proper accents
        """
        return [
            {
                "product": key,
                "category": _PRODUCT_CATEGORY[key],
                "unit": UNIT,
                "display_name": _DISPLAY_NAMES[key],
            }
            for key in ALL_PRODUCTS
        ]

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _get_csv(self, filename: str) -> pd.DataFrame | None:
        """Read and cache a CSV file from the data directory.

        Parameters
        ----------
        filename : str
            Basename of the CSV file (e.g. ``'fruits.csv'``).

        Returns
        -------
        pd.DataFrame or None
            Raw DataFrame, or ``None`` if the file does not exist.
        """
        if filename in self._csv_cache:
            return self._csv_cache[filename]

        path = self._dir / filename
        if not path.exists():
            logger.info("File not found, skipping: %s", path)
            return None

        try:
            raw = pd.read_csv(
                path,
                encoding="utf-8",
                parse_dates=["date"],
                dtype={
                    "type": str,
                    "qte": float,
                    "pgmin": float,
                    "pgmax": float,
                    "pdmin": float,
                    "pdmax": float,
                },
            )
        except Exception as exc:
            logger.warning("Failed to read %s: %s", path, exc)
            return None

        # Normalise the type column in-place (strip whitespace, lowercase)
        raw["_type_norm"] = raw["type"].apply(_normalize_type)
        self._csv_cache[filename] = raw
        logger.debug("Loaded %s: %d rows", filename, len(raw))
        return raw

    def _load_product(self, product_key: str) -> pd.DataFrame | None:
        """Load and process a single product's time series.

        Parameters
        ----------
        product_key : str
            One of the keys in :data:`ALL_PRODUCTS`.

        Returns
        -------
        pd.DataFrame or None
            Processed weekly DataFrame, or ``None`` if the source file is absent
            or no rows match the product.
        """
        filename = _PRODUCT_CSV[product_key]
        raw_csv = self._get_csv(filename)
        if raw_csv is None:
            return None

        # Normalised raw name for matching (strip whitespace, lowercase)
        target_name = _normalize_type(_PRODUCT_RAW_NAME[product_key])

        # Filter rows for this product
        mask = raw_csv["_type_norm"] == target_name
        subset = raw_csv.loc[mask].copy()

        if subset.empty:
            logger.warning(
                "No rows found for product '%s' (looking for '%s') in %s",
                product_key,
                target_name,
                filename,
            )
            return None

        # Drop rows with invalid dates
        subset = subset.dropna(subset=["date"])
        subset["date"] = pd.to_datetime(subset["date"], errors="coerce")
        subset = subset.dropna(subset=["date"])

        # Compute mid-prices
        subset["retail_mid"] = (subset["pdmin"] + subset["pdmax"]) / 2.0
        subset["wholesale_mid"] = (subset["pgmin"] + subset["pgmax"]) / 2.0

        # Drop non-trading days: rows where retail_mid == 0
        n_before = len(subset)
        subset = subset[subset["retail_mid"] > 0].copy()
        n_dropped = n_before - len(subset)
        if n_dropped > 0:
            logger.debug(
                "Product '%s': dropped %d zero-price row(s) (seasonal non-trading)",
                product_key,
                n_dropped,
            )

        if subset.empty:
            logger.warning("Product '%s': all rows have zero retail price — skipped", product_key)
            return None

        # Set DatetimeIndex and sort
        subset = subset.set_index("date").sort_index()
        subset.index.name = "date"

        # Keep only the columns we need before resampling
        price_cols = subset[["retail_mid", "wholesale_mid"]]
        qte_col = subset[["qte"]]

        # Resample to weekly (W-MON), mean for prices, sum for quantity
        weekly_prices = price_cols.resample("W-MON").mean()
        weekly_qte = qte_col.resample("W-MON").sum()

        weekly = weekly_prices.join(weekly_qte)

        # Forward-fill gaps of at most _MAX_FFILL_WEEKS weeks, then stop.
        # We do this by forward-filling with limit=_MAX_FFILL_WEEKS.
        # Longer seasonal gaps (citrus off-season) must remain NaN.
        weekly["retail_mid"] = weekly["retail_mid"].ffill(limit=_MAX_FFILL_WEEKS)
        weekly["wholesale_mid"] = weekly["wholesale_mid"].ffill(limit=_MAX_FFILL_WEEKS)
        # Do NOT fill qte for forward-filled weeks (no trading happened)
        weekly.loc[weekly["retail_mid"].isna(), "qte"] = float("nan")

        # Add metadata columns
        weekly["product"] = product_key
        weekly["category"] = _PRODUCT_CATEGORY[product_key]
        weekly["unit"] = UNIT

        n_non_null = weekly["retail_mid"].notna().sum()
        logger.debug(
            "Product '%s': %d weekly rows, %d non-null retail_mid",
            product_key,
            len(weekly),
            n_non_null,
        )

        return weekly
