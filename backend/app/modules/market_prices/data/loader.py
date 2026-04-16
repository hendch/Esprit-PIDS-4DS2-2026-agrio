"""LivestockDataLoader — reads and normalises the six Tunisian market-price source files.

Source files
------------
XLSX (openpyxl engine) — header row 0, data from row 1:
  - evolution-du-prix-moyen-des-brebis-suitees-par-grande-region-en-dinar.xlsx
  - evolution-du-prix-moyen-des-genisses-pleines-par-grande-region-en-dinar.xlsx
  - evolution-du-prix-moyen-des-vaches-suitees-par-grande-region-en-dinar.xlsx
  - evolution-du-prix-moyen-de-vente-des-viandes-rouge-en-dinar-par-kilogramme-vif.xlsx

HTML-disguised XLS (pd.read_html):
  - Évolution_des_prix_des_bovins_suivis_par_tête__toutes_races_confondues.xls
  - Évolution_des_prix_des_vaches_gestantes_par_tête.xls

Column layouts
--------------
Regional XLSX  : annee | mois | nord | sahel | centre-et-sud
Meat XLSX      : annee | mois | taurillon-maigre | taurillon-engraisse | agneau | antenais | caprin
HTML XLS       : date_str (M/YYYY) | nord | centre_et_sud | sahel
"""
from __future__ import annotations

import logging
from pathlib import Path

import pandas as pd

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

#: All expected series names produced by this loader.
ALL_SERIES: tuple[str, ...] = (
    "brebis_suitees",
    "genisses_pleines",
    "vaches_suitees",
    "viandes_rouges",
    "bovins_suivis",
    "vaches_gestantes",
)

#: French month name → integer month number (handles accent variants).
FRENCH_MONTHS: dict[str, int] = {
    "janvier": 1,
    "février": 2,
    "fevrier": 2,
    "mars": 3,
    "avril": 4,
    "mai": 5,
    "juin": 6,
    "juillet": 7,
    "août": 8,
    "aout": 8,
    "septembre": 9,
    "octobre": 10,
    "novembre": 11,
    "décembre": 12,
    "decembre": 12,
}

# (series_name, filename, unit)
_XLSX_REGIONAL_FILES: list[tuple[str, str, str]] = [
    (
        "brebis_suitees",
        "evolution-du-prix-moyen-des-brebis-suitees-par-grande-region-en-dinar.xlsx",
        "TND/head",
    ),
    (
        "genisses_pleines",
        "evolution-du-prix-moyen-des-genisses-pleines-par-grande-region-en-dinar.xlsx",
        "TND/head",
    ),
    (
        "vaches_suitees",
        "evolution-du-prix-moyen-des-vaches-suitees-par-grande-region-en-dinar.xlsx",
        "TND/head",
    ),
]

_XLSX_MEAT_FILE: tuple[str, str, str] = (
    "viandes_rouges",
    "evolution-du-prix-moyen-de-vente-des-viandes-rouge-en-dinar-par-kilogramme-vif.xlsx",
    "TND/kg",
)

_XLS_HTML_FILES: list[tuple[str, str, str]] = [
    (
        "bovins_suivis",
        "Évolution des prix des bovins suivis par tête, toutes races confondues.xls",
        "TND/head",
    ),
    (
        "vaches_gestantes",
        "Évolution des prix des vaches gestantes par tête.xls",
        "TND/head",
    ),
]

# Canonical region column names used throughout the output DataFrames.
REGION_COLS: list[str] = ["nord", "sahel", "centre_et_sud"]

# Canonical meat species column names (normalised from the raw file headers).
MEAT_SPECIES_COLS: list[str] = [
    "taurillon_maigre",
    "taurillon_engraisse",
    "agneau",
    "antenais",
    "caprin",
]


# ---------------------------------------------------------------------------
# Module-level helpers
# ---------------------------------------------------------------------------


def _default_data_dir() -> Path:
    """Return the default raw-data directory relative to this source file.

    The path resolves to ``<repo_root>/backend/data/market_prices/raw/``
    by walking four ``parents`` up from this file's location:
    ``loader.py → data/ → market_prices/ → modules/ → app/ → backend/``
    and then appending ``data/market_prices/raw``.
    """
    return Path(__file__).parents[4] / "data" / "market_prices" / "raw"


def _parse_french_date(annee: object, mois: object) -> pd.Timestamp | None:
    """Convert a ``(annee, mois)`` pair to a first-of-month ``pd.Timestamp``.

    Parameters
    ----------
    annee:
        Year value — coerced to ``int``.  Accepts int, float, or string.
    mois:
        Month value — either an integer (1–12), a numeric string, or a French
        month name (handles accented and unaccented variants).

    Returns
    -------
    pd.Timestamp or None
        ``None`` is returned for any row where the date cannot be reliably
        parsed (NaN year, unknown month name, out-of-range values, etc.).
    """
    try:
        year = int(float(str(annee)))
        month_raw = str(mois).strip().lower().rstrip(".")
        if month_raw.isdigit():
            month = int(month_raw)
        else:
            month = FRENCH_MONTHS.get(month_raw)
            if month is None:
                logger.debug("Unknown French month token %r — row dropped", mois)
                return None
        if not (1 <= month <= 12):
            return None
        return pd.Timestamp(year=year, month=month, day=1)
    except (ValueError, TypeError, OverflowError):
        return None


def _parse_mslash_date(date_str: object) -> pd.Timestamp | None:
    """Parse a date string in ``M/YYYY`` format (e.g. ``'3/2015'``).

    Parameters
    ----------
    date_str:
        Raw cell value from the HTML-disguised XLS files.

    Returns
    -------
    pd.Timestamp or None
        ``None`` when the string cannot be split into a valid month/year pair.
    """
    try:
        parts = str(date_str).strip().split("/")
        if len(parts) != 2:
            return None
        month, year = int(parts[0]), int(parts[1])
        if not (1 <= month <= 12) or year < 1900:
            return None
        return pd.Timestamp(year=year, month=month, day=1)
    except (ValueError, TypeError):
        return None


def _normalise_columns(columns: pd.Index) -> list[str]:
    """Lowercase, strip, and replace separators in column names.

    Converts ``'Centre-et-Sud'`` → ``'centre_et_sud'``, handles French
    accented characters commonly found in these files.
    """
    result = []
    for c in columns:
        s = (
            str(c)
            .strip()
            .lower()
            .replace("-", "_")
            .replace(" ", "_")
            .replace("é", "e")
            .replace("è", "e")
            .replace("ê", "e")
            .replace("à", "a")
            .replace("â", "a")
            .replace("î", "i")
            .replace("ô", "o")
            .replace("û", "u")
            .replace("ç", "c")
        )
        result.append(s)
    return result


def _map_region_columns(columns: list[str]) -> dict[str, str]:
    """Return a rename mapping from raw column names to canonical region names.

    Parameters
    ----------
    columns:
        Already-normalised column names (output of ``_normalise_columns``).
        Handles both French/Latin and Arabic column headers.

    Returns
    -------
    dict[str, str]
        ``{raw_name: canonical_name}`` for columns that look like region names.
    """
    # Arabic: شمال=nord, الساحل=sahel, الوسط و الجنوب or الوسط=centre_et_sud
    _ARABIC_NORD = "\u0634\u0645\u0627\u0644"          # شمال
    _ARABIC_SAHEL = "\u0627\u0644\u0633\u0627\u062d\u0644"  # الساحل
    _ARABIC_CENTRE = "\u0627\u0644\u0648\u0633\u0637"  # الوسط

    rename: dict[str, str] = {}
    for col in columns:
        col_norm = col.strip()
        if _ARABIC_NORD in col_norm and col not in rename.values():
            rename[col] = "nord"
        elif _ARABIC_SAHEL in col_norm and col not in rename.values():
            rename[col] = "sahel"
        elif _ARABIC_CENTRE in col_norm and col not in rename.values():
            rename[col] = "centre_et_sud"
        elif "nord" in col and col not in rename.values():
            rename[col] = "nord"
        elif "sahel" in col and col not in rename.values():
            rename[col] = "sahel"
        elif ("centre" in col or "sud" in col) and col not in rename.values():
            rename[col] = "centre_et_sud"
    return rename


# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------


def _validate_no_duplicate_dates(df: pd.DataFrame, series_name: str) -> None:
    """Raise ``ValueError`` if the DataFrame index contains duplicate dates.

    Parameters
    ----------
    df:
        Wide-format DataFrame with ``DatetimeIndex``.
    series_name:
        Used only in the error message for easier debugging.

    Raises
    ------
    ValueError
        When one or more dates appear more than once in the index.
    """
    duplicates = df.index[df.index.duplicated()]
    if len(duplicates) > 0:
        raise ValueError(
            f"Series '{series_name}' contains duplicate dates: "
            + ", ".join(str(d) for d in sorted(set(duplicates)))
        )


def _validate_prices_positive(df: pd.DataFrame, series_name: str) -> None:
    """Log a warning for any numeric price value that is zero or negative.

    We warn rather than raise so that partial or provisional data (e.g. a
    government file with a ``0`` placeholder) does not crash the entire load.
    The offending rows are replaced with ``NaN`` so downstream cleaning can
    handle them.

    Parameters
    ----------
    df:
        Wide-format DataFrame whose numeric columns contain prices.
    series_name:
        Used in the warning message.
    """
    numeric_cols = df.select_dtypes(include="number").columns
    for col in numeric_cols:
        bad_mask = df[col] <= 0
        n_bad = bad_mask.sum()
        if n_bad > 0:
            logger.warning(
                "Series '%s' column '%s': %d non-positive value(s) found — replaced with NaN",
                series_name,
                col,
                n_bad,
            )
            df.loc[bad_mask, col] = float("nan")


# ---------------------------------------------------------------------------
# Main class
# ---------------------------------------------------------------------------


class LivestockDataLoader:
    """Load and normalise Tunisian livestock and meat market-price source files.

    The loader reads six government-published data files (four ``.xlsx`` and
    two HTML-disguised ``.xls``) and returns them as tidy ``pandas``
    DataFrames with a monthly ``DatetimeIndex``.

    Parameters
    ----------
    data_dir : str or Path or None, optional
        Directory that contains the six raw data files.  Resolution order:

        1. Explicit ``data_dir`` argument.
        2. ``settings.market_data_dir`` (read from the FastAPI app settings
           when the backend package is importable).
        3. Package-relative fallback:
           ``<repo_root>/backend/data/market_prices/raw/``.

    Examples
    --------
    >>> loader = LivestockDataLoader("/path/to/raw/data")
    >>> data = loader.load_all()
    >>> panel = loader.load_livestock_panel()
    >>> meat = loader.load_meat_panel()
    """

    def __init__(self, data_dir: str | Path | None = None) -> None:
        if data_dir is not None:
            self._dir = Path(data_dir)
        else:
            try:
                from app.settings import settings  # type: ignore[import]

                self._dir = Path(getattr(settings, "market_data_dir", _default_data_dir()))
            except Exception:
                self._dir = _default_data_dir()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def load_all(self) -> dict[str, pd.DataFrame]:
        """Load all six source files and return a dict of wide-format DataFrames.

        Only files that actually exist on disk are loaded; missing files are
        silently skipped and their series key is absent from the result.

        Returns
        -------
        dict[str, pd.DataFrame]
            Keys are series names from :data:`ALL_SERIES`.  Each value is a
            ``DataFrame`` with:

            - ``DatetimeIndex`` named ``"date"``, monthly frequency, day=1,
              sorted ascending.
            - Region columns: ``nord``, ``sahel``, ``centre_et_sud``
              (livestock series) or species columns (``viandes_rouges``).
            - ``national_avg`` : float — arithmetic mean of the three region
              columns (or of all species columns for meat).
            - ``series`` : str — series name repeated in every row.
            - ``unit`` : str — ``"TND/head"`` or ``"TND/kg"``.

        Notes
        -----
        Validation is applied to every loaded series:

        * Duplicate dates raise ``ValueError``.
        * Non-positive prices are replaced with ``NaN`` and a warning is logged.
        """
        result: dict[str, pd.DataFrame] = {}

        for series_name, filename, unit in _XLSX_REGIONAL_FILES:
            df = self._load_xlsx_regional(series_name, filename, unit)
            if df is not None:
                result[series_name] = df

        df_meat = self._load_xlsx_meat()
        if df_meat is not None:
            result[_XLSX_MEAT_FILE[0]] = df_meat

        for series_name, filename, unit in _XLS_HTML_FILES:
            df = self._load_xls_html(series_name, filename, unit)
            if df is not None:
                result[series_name] = df

        return result

    def load_livestock_panel(self) -> pd.DataFrame:
        """Return all livestock series (excluding meat) in long format.

        Calls :meth:`load_all` internally and melts the regional columns.

        Returns
        -------
        pd.DataFrame
            Columns: ``date`` (datetime64), ``series`` (str), ``region`` (str),
            ``price`` (float).  Sorted by ``date`` ascending.

        Notes
        -----
        The ``viandes_rouges`` series is excluded because it has species
        columns rather than region columns.  Use :meth:`load_meat_panel`
        for meat prices.
        """
        all_data = self.load_all()
        frames: list[pd.DataFrame] = []

        for series_name, df in all_data.items():
            if series_name == "viandes_rouges":
                continue
            available_regions = [c for c in REGION_COLS if c in df.columns]
            if not available_regions:
                logger.warning("Series '%s' has no recognised region columns — skipped", series_name)
                continue
            melted = (
                df[available_regions]
                .reset_index()
                .melt(
                    id_vars="date",
                    value_vars=available_regions,
                    var_name="region",
                    value_name="price",
                )
            )
            melted["series"] = series_name
            frames.append(melted[["date", "series", "region", "price"]])

        if not frames:
            return pd.DataFrame(columns=["date", "series", "region", "price"])

        panel = pd.concat(frames, ignore_index=True).sort_values("date").reset_index(drop=True)
        return panel

    def load_meat_panel(self) -> pd.DataFrame:
        """Return the meat price series in long format.

        Calls :meth:`load_all` internally and melts the species columns of
        the ``viandes_rouges`` DataFrame.

        Returns
        -------
        pd.DataFrame
            Columns: ``date`` (datetime64), ``species`` (str),
            ``price_per_kg`` (float).  Sorted by ``date`` ascending.

        Notes
        -----
        Returns an empty DataFrame with the correct columns if the meat source
        file is not present on disk.
        """
        all_data = self.load_all()
        df = all_data.get("viandes_rouges")
        if df is None:
            return pd.DataFrame(columns=["date", "species", "price_per_kg"])

        species_cols = [c for c in df.columns if c not in ("series", "unit", "national_avg")]
        melted = (
            df[species_cols]
            .reset_index()
            .melt(
                id_vars="date",
                value_vars=species_cols,
                var_name="species",
                value_name="price_per_kg",
            )
        )
        return (
            melted[["date", "species", "price_per_kg"]]
            .sort_values("date")
            .reset_index(drop=True)
        )

    # ------------------------------------------------------------------
    # Private loaders
    # ------------------------------------------------------------------

    def _load_xlsx_regional(
        self, series_name: str, filename: str, unit: str
    ) -> pd.DataFrame | None:
        """Load a regional livestock XLSX file.

        Expected raw columns (after header row 0): ``annee``, ``mois``,
        ``nord``, ``sahel``, ``centre-et-sud``.

        Parameters
        ----------
        series_name : str
            Key used in the result dict and in the ``series`` column.
        filename : str
            Basename of the file inside :attr:`_dir`.
        unit : str
            Price unit string stored in the ``unit`` column.

        Returns
        -------
        pd.DataFrame or None
            ``None`` when the file does not exist on disk.

        Raises
        ------
        ValueError
            If the loaded series contains duplicate dates.
        """
        path = self._dir / filename
        if not path.exists():
            logger.info("File not found, skipping: %s", path)
            return None

        raw = pd.read_excel(path, header=0, engine="openpyxl")
        raw.columns = pd.Index(_normalise_columns(raw.columns))

        # Build DatetimeIndex from annee + mois columns
        raw["date"] = [
            _parse_french_date(row.get("annee"), row.get("mois"))
            for _, row in raw.iterrows()
        ]
        raw = raw.dropna(subset=["date"])
        raw["date"] = pd.to_datetime(raw["date"])
        raw = raw.set_index("date").sort_index()
        raw.index.name = "date"

        rename_map = _map_region_columns(list(raw.columns))
        raw = raw.rename(columns=rename_map)

        region_cols = [c for c in REGION_COLS if c in raw.columns]
        df = raw[region_cols].apply(pd.to_numeric, errors="coerce").copy()
        _validate_prices_positive(df, series_name)
        df["national_avg"] = df[region_cols].mean(axis=1)
        df["series"] = series_name
        df["unit"] = unit

        _validate_no_duplicate_dates(df, series_name)
        return df

    def _load_xlsx_meat(self) -> pd.DataFrame | None:
        """Load the meat price XLSX file.

        Expected raw columns: ``annee``, ``mois``, ``taurillon-maigre``,
        ``taurillon-engraisse``, ``agneau``, ``antenais``, ``caprin``.
        Unit: TND per kg live weight.

        Returns
        -------
        pd.DataFrame or None
            ``None`` when the file does not exist on disk.

        Raises
        ------
        ValueError
            If the loaded series contains duplicate dates.
        """
        series_name, filename, unit = _XLSX_MEAT_FILE
        path = self._dir / filename
        if not path.exists():
            logger.info("File not found, skipping: %s", path)
            return None

        raw = pd.read_excel(path, header=0, engine="openpyxl")
        raw.columns = pd.Index(_normalise_columns(raw.columns))

        raw["date"] = [
            _parse_french_date(row.get("annee"), row.get("mois"))
            for _, row in raw.iterrows()
        ]
        raw = raw.dropna(subset=["date"])
        raw["date"] = pd.to_datetime(raw["date"])
        raw = raw.set_index("date").sort_index()
        raw.index.name = "date"

        # Drop the date-component columns; everything else is a species price
        non_price = {"annee", "mois", "date"}
        species_cols = [c for c in raw.columns if c not in non_price]
        df = raw[species_cols].apply(pd.to_numeric, errors="coerce").copy()
        _validate_prices_positive(df, series_name)
        numeric_species = df.select_dtypes(include="number").columns.tolist()
        df["national_avg"] = df[numeric_species].mean(axis=1)
        df["series"] = series_name
        df["unit"] = unit

        _validate_no_duplicate_dates(df, series_name)
        return df

    def _load_xls_html(
        self, series_name: str, filename: str, unit: str
    ) -> pd.DataFrame | None:
        """Load an HTML-disguised XLS file using ``pd.read_html()``.

        These files are saved as HTML tables with a ``.xls`` extension.
        ``xlrd`` cannot read them; ``pd.read_html`` is used instead.

        Expected columns after parsing: ``date_str`` (``M/YYYY`` format),
        ``nord``, ``centre_et_sud``, ``sahel`` (column order may vary).

        Parameters
        ----------
        series_name : str
            Key used in the result dict and in the ``series`` column.
        filename : str
            Basename of the file inside :attr:`_dir`.
        unit : str
            Price unit string stored in the ``unit`` column.

        Returns
        -------
        pd.DataFrame or None
            ``None`` when the file is absent or ``pd.read_html`` returns no
            tables.

        Raises
        ------
        ValueError
            If the loaded series contains duplicate dates.
        """
        path = self._dir / filename
        if not path.exists():
            logger.info("File not found, skipping: %s", path)
            return None

        try:
            tables = pd.read_html(str(path), header=0)
        except Exception as exc:
            logger.warning("pd.read_html failed for %s: %s", path, exc)
            return None

        if not tables:
            logger.warning("No tables found in %s", path)
            return None

        # Use the largest table (most rows)
        raw = max(tables, key=len).copy()
        raw.columns = pd.Index(_normalise_columns(raw.columns))

        # The date column is the first column; its values look like "3/2015"
        date_col = raw.columns[0]
        raw["date"] = raw[date_col].apply(_parse_mslash_date)
        raw = raw.dropna(subset=["date"])
        raw["date"] = pd.to_datetime(raw["date"])
        raw = raw.set_index("date").sort_index()
        raw.index.name = "date"

        rename_map = _map_region_columns([c for c in raw.columns if c != date_col])
        raw = raw.rename(columns=rename_map)

        region_cols = [c for c in REGION_COLS if c in raw.columns]
        df = raw[region_cols].apply(pd.to_numeric, errors="coerce").copy()
        _validate_prices_positive(df, series_name)
        df["national_avg"] = df[region_cols].mean(axis=1)
        df["series"] = series_name
        df["unit"] = unit

        _validate_no_duplicate_dates(df, series_name)
        return df
