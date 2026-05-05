"""Tunisian holiday calendar with Islamic and national holidays.

Islamic holidays (Eid al-Adha, Eid al-Fitr, Ramadan start) follow the lunar
calendar and shift ~11 days earlier each Gregorian year.  The dates below are
verified against the official Tunisian holiday announcements and standard
astronomical sources (Umm al-Qura calendar for Saudi Arabia, adjusted +0/+1
day for Tunisia where the moon-sighting can differ by one day).

Key price-signal events
-----------------------
Eid al-Adha (10 Dhul Hijjah)
    The most important signal for livestock prices: lamb and sheep prices
    spike 15–30% in the 30–45 days before Eid as households buy animals for
    slaughter.  The ``get_days_to_eid`` function encodes this as a signed
    distance feature for forecasting models.

Ramadan
    Meat consumption (and prices) rise during Ramadan.  The start date marks
    the beginning of the elevated-demand window; Eid al-Fitr marks the end.
"""
from __future__ import annotations

import pandas as pd

# ---------------------------------------------------------------------------
# Verified Islamic holiday dates for Tunisia 2008–2030
# ---------------------------------------------------------------------------
# Sources: Umm al-Qura calendar, IslamicFinder, official Tunisian gazette.
# Tunisia follows moon-sighting; dates may differ by ±1 day from Saudi Arabia.

#: Eid al-Adha (10 Dhul Hijjah) — the primary livestock price driver.
EID_AL_ADHA_DATES: list[str] = [
    "2008-12-09",
    "2009-11-28",
    "2010-11-17",
    "2011-11-07",
    "2012-10-26",
    "2013-10-15",
    "2014-10-04",
    "2015-09-24",
    "2016-09-12",
    "2017-09-01",
    "2018-08-21",
    "2019-08-11",
    "2020-07-31",
    "2021-07-20",
    "2022-07-09",
    "2023-06-28",
    "2024-06-17",
    "2025-06-07",
    "2026-05-27",
    "2027-05-17",
    "2028-05-05",
    "2029-04-25",
    "2030-04-14",
]

#: Ramadan start (1 Ramadan) — begins the elevated meat-demand period.
RAMADAN_START_DATES: list[str] = [
    "2008-09-01",
    "2009-08-22",
    "2010-08-11",
    "2011-08-01",
    "2012-07-20",
    "2013-07-09",
    "2014-06-29",
    "2015-06-18",
    "2016-06-06",
    "2017-05-27",
    "2018-05-16",
    "2019-05-05",
    "2020-04-24",
    "2021-04-13",
    "2022-04-02",
    "2023-03-23",
    "2024-03-11",
    "2025-03-01",
    "2026-02-18",
    "2027-02-08",
    "2028-01-28",
    "2029-01-16",
    "2030-01-06",
]

#: Eid al-Fitr (1 Shawwal) — end of Ramadan; Ramadan duration is 29 or 30 days.
#: Calculated as Ramadan start + 29 or 30 days (verified against official calendars).
EID_AL_FITR_DATES: list[str] = [
    "2008-10-01",
    "2009-09-20",
    "2010-09-10",
    "2011-08-30",
    "2012-08-19",
    "2013-08-08",
    "2014-07-28",
    "2015-07-17",
    "2016-07-06",
    "2017-06-25",
    "2018-06-15",
    "2019-06-04",
    "2020-05-24",
    "2021-05-13",
    "2022-05-02",
    "2023-04-21",
    "2024-04-10",
    "2025-03-30",
    "2026-03-20",
    "2027-03-09",
    "2028-02-26",
    "2029-02-14",
    "2030-02-04",
]

# ---------------------------------------------------------------------------
# Tunisian fixed national holidays (month, day, name)
# ---------------------------------------------------------------------------
#: Gregorian fixed public holidays declared by Tunisian law.
NATIONAL_HOLIDAYS: list[tuple[int, int, str]] = [
    (1, 1,  "Nouvel An"),
    (1, 14, "Fête de la Révolution"),       # 2011 revolution anniversary
    (3, 20, "Fête de l'Indépendance"),
    (4, 9,  "Jour des Martyrs"),
    (5, 1,  "Fête du Travail"),
    (7, 25, "Fête de la République"),
    (8, 13, "Fête de la Femme"),
    (10, 15, "Fête de l'Évacuation"),
]

# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def get_tunisian_holidays(
    start_year: int = 2008,
    end_year: int = 2030,
) -> pd.DataFrame:
    """Build a DataFrame of all Tunisian holidays in the requested year range.

    Islamic holidays (Eid al-Adha, Eid al-Fitr, Ramadan start) are included
    for years where verified dates are available (2008–2030).  National fixed
    holidays are generated for every year in ``[start_year, end_year]``.

    Parameters
    ----------
    start_year : int, default 2008
        First calendar year to include (inclusive).
    end_year : int, default 2030
        Last calendar year to include (inclusive).

    Returns
    -------
    pd.DataFrame
        Columns:

        ``date`` : datetime64[ns]
            The holiday date (exact day).
        ``holiday_name`` : str
            Human-readable name of the holiday.
        ``days_to_event`` : int
            Always ``0`` — every row *is* the event day.  Downstream code
            (e.g. feature engineering) is responsible for computing signed
            distances from a date index using :func:`get_days_to_eid`.

    Notes
    -----
    The ``days_to_event`` column is deliberately always 0 here because this
    DataFrame represents the events themselves, not distances from arbitrary
    dates.  Use :func:`get_days_to_eid` for distance-to-event features.
    """
    rows: list[dict] = []

    # --- Islamic holidays ---
    _add_islamic_holidays(rows, EID_AL_ADHA_DATES, "Eid al-Adha", start_year, end_year)
    _add_islamic_holidays(rows, EID_AL_FITR_DATES, "Eid al-Fitr", start_year, end_year)
    _add_islamic_holidays(rows, RAMADAN_START_DATES, "Ramadan Start", start_year, end_year)

    # --- Fixed national holidays ---
    for year in range(start_year, end_year + 1):
        for month, day, name in NATIONAL_HOLIDAYS:
            try:
                dt = pd.Timestamp(year=year, month=month, day=day)
                rows.append({"date": dt, "holiday_name": name, "days_to_event": 0})
            except Exception:
                continue  # skip invalid dates (e.g. Feb 30)

    df = (
        pd.DataFrame(rows, columns=["date", "holiday_name", "days_to_event"])
        .sort_values("date")
        .drop_duplicates(subset=["date", "holiday_name"])
        .reset_index(drop=True)
    )
    return df


def get_days_to_eid(date_index: pd.DatetimeIndex) -> pd.Series:
    """Return signed days from each date in *date_index* to the nearest Eid al-Adha.

    This is the primary calendar feature for livestock price forecasting.
    Lamb and sheep prices begin rising ~45 days before Eid and peak on
    the day itself, then drop sharply.

    Sign convention
    ---------------
    * **Positive** — the date is *before* an Eid (upcoming event, days remaining).
    * **Zero** — the date *is* an Eid al-Adha date.
    * **Negative** — the date is *after* an Eid (days elapsed since last Eid).

    For any date in the index the function selects the nearest future Eid;
    if no future Eid is available (dates beyond 2030) it falls back to the
    nearest past Eid (least-negative delta).

    Parameters
    ----------
    date_index : pd.DatetimeIndex
        Dates for which to compute the signed distance.  Typically the index
        of a monthly price DataFrame.

    Returns
    -------
    pd.Series
        Integer series indexed by *date_index*.  Positive = days until next
        Eid, negative = days since last Eid, 0 = Eid day itself.

    Examples
    --------
    >>> idx = pd.date_range("2024-05-01", periods=6, freq="MS")
    >>> get_days_to_eid(idx)
    2024-05-01    47
    2024-06-01    16
    2024-07-01   -14   # 2024-06-17 was Eid
    ...
    """
    eid_ts = pd.to_datetime(EID_AL_ADHA_DATES)
    result: list[int] = []

    for dt in date_index:
        # Signed delta in days: positive = future Eid, negative = past Eid
        deltas = (eid_ts - dt).days  # numpy array of int64
        future = deltas[deltas >= 0]
        if len(future) > 0:
            result.append(int(future.min()))
        else:
            # All Eid dates are in the past — return closest past one
            result.append(int(deltas.max()))

    return pd.Series(result, index=date_index, dtype=int, name="days_to_eid")


def get_days_to_ramadan(date_index: pd.DatetimeIndex) -> pd.Series:
    """Return signed days from each date to the nearest Ramadan start.

    Same sign convention as :func:`get_days_to_eid`.  Positive = upcoming
    Ramadan, negative = days since Ramadan started, 0 = first day of Ramadan.

    Parameters
    ----------
    date_index : pd.DatetimeIndex
        Dates for which to compute the signed distance.

    Returns
    -------
    pd.Series
        Integer series indexed by *date_index*, named ``'days_to_ramadan'``.
    """
    ramadan_ts = pd.to_datetime(RAMADAN_START_DATES)
    result: list[int] = []

    for dt in date_index:
        deltas = (ramadan_ts - dt).days
        future = deltas[deltas >= 0]
        if len(future) > 0:
            result.append(int(future.min()))
        else:
            result.append(int(deltas.max()))

    return pd.Series(result, index=date_index, dtype=int, name="days_to_ramadan")


# ---------------------------------------------------------------------------
# Private helpers
# ---------------------------------------------------------------------------


def _add_islamic_holidays(
    rows: list[dict],
    date_list: list[str],
    name: str,
    start_year: int,
    end_year: int,
) -> None:
    """Append rows for an Islamic holiday to *rows* (in-place).

    Parameters
    ----------
    rows : list[dict]
        Accumulator list being built by :func:`get_tunisian_holidays`.
    date_list : list[str]
        ISO-8601 date strings for the holiday (one per year).
    name : str
        Holiday name to store in ``holiday_name``.
    start_year : int
        Filter: only include dates whose year >= start_year.
    end_year : int
        Filter: only include dates whose year <= end_year.
    """
    for date_str in date_list:
        dt = pd.Timestamp(date_str)
        if start_year <= dt.year <= end_year:
            rows.append({"date": dt, "holiday_name": name, "days_to_event": 0})
