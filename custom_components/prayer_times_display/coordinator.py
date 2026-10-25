"""Data update coordinator for Prayer Times Display."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from datetime import date, timedelta
from zoneinfo import ZoneInfo

from homeassistant.config_entries import ConfigEntry
from homeassistant.const import CONF_LATITUDE, CONF_LONGITUDE
from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.update_coordinator import DataUpdateCoordinator, UpdateFailed
from homeassistant.util import dt as dt_util

from .api import PrayerTimesApiError, DayTimings, async_fetch_day
from .const import (
    CONF_METHOD,
    CONF_SCHOOL,
    CONF_TIME_ZONE,
    DEFAULT_METHOD,
    DEFAULT_SCHOOL,
    DOMAIN,
    LOGGER,
    SCHEDULE_DAYS,
)

# The API is only called for days not fetched yet; this interval just
# controls how quickly a new day (or a failed fetch) is picked up.
UPDATE_INTERVAL = timedelta(minutes=5)

type PrayerTimesConfigEntry = ConfigEntry[PrayerTimesCoordinator]


@dataclass(frozen=True)
class PrayerTimesData:
    """Prayer times for SCHEDULE_DAYS consecutive days, starting today."""

    days: tuple[DayTimings, ...]

    @property
    def today(self) -> DayTimings:
        return self.days[0]

    @property
    def tomorrow(self) -> DayTimings:
        return self.days[1]


class PrayerTimesCoordinator(DataUpdateCoordinator[PrayerTimesData]):
    """Keeps a rolling week of prayer times for a configured location."""

    config_entry: PrayerTimesConfigEntry

    def __init__(self, hass: HomeAssistant, entry: PrayerTimesConfigEntry) -> None:
        super().__init__(
            hass,
            LOGGER,
            config_entry=entry,
            name=DOMAIN,
            update_interval=UPDATE_INTERVAL,
            always_update=False,
        )
        self.time_zone = entry.data.get(CONF_TIME_ZONE) or hass.config.time_zone

    async def _async_update_data(self) -> PrayerTimesData:
        today = dt_util.now(ZoneInfo(self.time_zone)).date()
        wanted = [today + timedelta(days=offset) for offset in range(SCHEDULE_DAYS)]

        # Reuse days already fetched; normally only the newest day is missing
        known = {day.date: day for day in self.data.days} if self.data else {}
        missing = [day for day in wanted if day not in known]
        if not missing:
            return PrayerTimesData(days=tuple(known[day] for day in wanted))

        try:
            fetched = await asyncio.gather(*(self._fetch(day) for day in missing))
        except PrayerTimesApiError as err:
            raise UpdateFailed(str(err)) from err

        known.update((timings.date, timings) for timings in fetched)
        return PrayerTimesData(days=tuple(known[day] for day in wanted))

    async def _fetch(self, day: date) -> DayTimings:
        entry = self.config_entry
        return await async_fetch_day(
            async_get_clientsession(self.hass),
            day,
            latitude=entry.data[CONF_LATITUDE],
            longitude=entry.data[CONF_LONGITUDE],
            method=entry.options.get(CONF_METHOD, DEFAULT_METHOD),
            school=entry.options.get(CONF_SCHOOL, DEFAULT_SCHOOL),
            time_zone=self.time_zone,
        )
