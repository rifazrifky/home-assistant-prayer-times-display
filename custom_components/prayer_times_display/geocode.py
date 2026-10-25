"""Place search by name, used only while setting up a location."""

from __future__ import annotations

from dataclasses import dataclass

import aiohttp

SEARCH_URL = "https://geocoding-api.open-meteo.com/v1/search"
REQUEST_TIMEOUT = aiohttp.ClientTimeout(total=10)
MAX_RESULTS = 10


class GeocodingError(Exception):
    """Raised when a place lookup fails."""


@dataclass(frozen=True)
class Place:
    """A named location."""

    name: str
    label: str
    latitude: float
    longitude: float
    time_zone: str | None = None
    country_code: str | None = None


async def async_search(
    session: aiohttp.ClientSession, query: str, language: str = "en"
) -> list[Place]:
    """Return places matching a free-text search, best match first."""
    params = {
        "name": query,
        "count": str(MAX_RESULTS),
        "language": language,
        "format": "json",
    }
    try:
        async with session.get(
            SEARCH_URL, params=params, timeout=REQUEST_TIMEOUT
        ) as resp:
            resp.raise_for_status()
            payload = await resp.json()
    except (aiohttp.ClientError, TimeoutError, ValueError) as err:
        raise GeocodingError(f"Error searching for {query!r}: {err}") from err

    places: list[Place] = []
    for result in payload.get("results") or []:
        try:
            name = result["name"]
            parts = [name]
            if result.get("admin1") and result["admin1"] != name:
                parts.append(result["admin1"])
            if result.get("country"):
                parts.append(result["country"])
            places.append(
                Place(
                    name=name,
                    label=", ".join(parts),
                    latitude=float(result["latitude"]),
                    longitude=float(result["longitude"]),
                    time_zone=result.get("timezone"),
                    country_code=result.get("country_code"),
                )
            )
        except (KeyError, TypeError, ValueError):
            continue
    return places
