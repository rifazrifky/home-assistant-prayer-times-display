"""Minimal async client for the Aladhan prayer times API."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
import re
from typing import Any
from zoneinfo import ZoneInfo

import aiohttp

from .const import PRAYERS

API_URL = "https://api.aladhan.com/v1/timings/{date}"
REQUEST_TIMEOUT = aiohttp.ClientTimeout(total=15)

# Timings normally look like "05:05" but may carry a suffix such as "05:05 (+04)"
_TIME_RE = re.compile(r"^(\d{1,2}):(\d{2})")


class PrayerTimesApiError(Exception):
    """Raised when prayer times cannot be fetched or parsed."""


@dataclass(frozen=True)
class HijriDate:
    """A Hijri calendar date as reported by Aladhan."""

    day: int
    month: int
    month_name: str
    month_name_ar: str
    year: int

    def __str__(self) -> str:
        return f"{self.day} {self.month_name} {self.year}"


@dataclass(frozen=True)
class DayTimings:
    """Prayer times for a single Gregorian day."""

    date: date
    hijri: HijriDate
    times: dict[str, datetime]


async def async_fetch_day(
    session: aiohttp.ClientSession,
    day: date,
    *,
    latitude: float,
    longitude: float,
    method: str,
    school: str,
    time_zone: str,
) -> DayTimings:
    """Fetch and parse the prayer times for one day."""
    data = await _async_get(
        session,
        day,
        {
            "latitude": str(latitude),
            "longitude": str(longitude),
            "method": method,
            "school": school,
            "timezonestring": time_zone,
        },
    )
    return parse_day(day, data, ZoneInfo(time_zone))


async def async_fetch_time_zone(
    session: aiohttp.ClientSession, day: date, latitude: float, longitude: float
) -> str:
    """Return the IANA time zone Aladhan resolves for a coordinate."""
    data = await _async_get(
        session, day, {"latitude": str(latitude), "longitude": str(longitude)}
    )
    try:
        return str(data["meta"]["timezone"])
    except (KeyError, TypeError) as err:
        raise PrayerTimesApiError(f"No time zone in Aladhan response: {err}") from err


async def _async_get(
    session: aiohttp.ClientSession, day: date, params: dict[str, str]
) -> dict[str, Any]:
    """Call the timings endpoint and return its "data" object."""
    url = API_URL.format(date=day.strftime("%d-%m-%Y"))
    try:
        async with session.get(url, params=params, timeout=REQUEST_TIMEOUT) as resp:
            resp.raise_for_status()
            payload = await resp.json()
    except (aiohttp.ClientError, TimeoutError, ValueError) as err:
        raise PrayerTimesApiError(f"Error fetching prayer times: {err}") from err

    if payload.get("code") != 200 or not isinstance(payload.get("data"), dict):
        raise PrayerTimesApiError(f"Unexpected response from Aladhan: {payload.get('data')}")
    return payload["data"]


def parse_day(day: date, data: dict[str, Any], tz: ZoneInfo) -> DayTimings:
    """Turn the "data" object of a timings response into a DayTimings."""
    try:
        timings = data["timings"]
        hijri = data["date"]["hijri"]
        hijri_date = HijriDate(
            day=int(hijri["day"]),
            month=int(hijri["month"]["number"]),
            month_name=hijri["month"]["en"],
            month_name_ar=hijri["month"]["ar"],
            year=int(hijri["year"]),
        )

        times: dict[str, datetime] = {}
        previous: datetime | None = None
        for key, field in PRAYERS.items():
            match = _TIME_RE.match(timings[field])
            if match is None:
                raise PrayerTimesApiError(f"Unparseable time for {field}: {timings[field]}")
            value = datetime.combine(
                day, time(int(match[1]), int(match[2])), tzinfo=tz
            )
            # At high latitudes Isha can fall after midnight
            if previous is not None and value < previous:
                value += timedelta(days=1)
            times[key] = previous = value
    except (KeyError, TypeError, ValueError) as err:
        raise PrayerTimesApiError(f"Malformed response from Aladhan: {err}") from err

    return DayTimings(date=day, hijri=hijri_date, times=times)
