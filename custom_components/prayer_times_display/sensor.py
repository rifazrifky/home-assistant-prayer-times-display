"""Sensors for Prayer Times Display."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any

from homeassistant.components.sensor import (
    SensorDeviceClass,
    SensorEntity,
    SensorEntityDescription,
)
from homeassistant.const import UnitOfTime
from homeassistant.core import HomeAssistant
from homeassistant.helpers.device_registry import DeviceEntryType, DeviceInfo
from homeassistant.helpers.entity_platform import AddConfigEntryEntitiesCallback
from homeassistant.helpers.update_coordinator import CoordinatorEntity

from .api import DayTimings
from .const import DAYS, DOMAIN, PRAYERS
from .coordinator import PrayerTimesConfigEntry, PrayerTimesCoordinator

PARALLEL_UPDATES = 0


@dataclass(frozen=True, kw_only=True)
class PrayerTimesSensorDescription(SensorEntityDescription):
    """Describes a sensor that reads one value from a day's timings."""

    day: str
    value_fn: Callable[[DayTimings], str | date | datetime]
    attrs_fn: Callable[[DayTimings], dict[str, Any]] | None = None


def _prayer_getter(prayer: str) -> Callable[[DayTimings], datetime]:
    return lambda timings: timings.times[prayer]


def _descriptions() -> list[PrayerTimesSensorDescription]:
    descriptions: list[PrayerTimesSensorDescription] = []
    for day in DAYS:
        descriptions.append(
            PrayerTimesSensorDescription(
                key=f"{day}_date",
                translation_key=f"{day}_date",
                device_class=SensorDeviceClass.DATE,
                day=day,
                value_fn=lambda timings: timings.date,
            )
        )
        descriptions.append(
            PrayerTimesSensorDescription(
                key=f"{day}_hijri_date",
                translation_key=f"{day}_hijri_date",
                day=day,
                value_fn=lambda timings: str(timings.hijri),
                attrs_fn=lambda timings: {
                    "day": timings.hijri.day,
                    "month": timings.hijri.month,
                    "month_name": timings.hijri.month_name,
                    "month_name_ar": timings.hijri.month_name_ar,
                    "year": timings.hijri.year,
                },
            )
        )
        descriptions.extend(
            PrayerTimesSensorDescription(
                key=f"{day}_{prayer}",
                translation_key=f"{day}_{prayer}",
                device_class=SensorDeviceClass.TIMESTAMP,
                day=day,
                value_fn=_prayer_getter(prayer),
            )
            for prayer in PRAYERS
        )
    return descriptions


SENSORS = _descriptions()

SCHEDULE_SENSOR = SensorEntityDescription(
    key="schedule",
    translation_key="schedule",
    native_unit_of_measurement=UnitOfTime.DAYS,
)


async def async_setup_entry(
    hass: HomeAssistant,
    entry: PrayerTimesConfigEntry,
    async_add_entities: AddConfigEntryEntitiesCallback,
) -> None:
    """Set up the sensors for a location."""
    coordinator = entry.runtime_data
    async_add_entities(
        [
            *(PrayerTimesSensor(coordinator, description) for description in SENSORS),
            PrayerTimesScheduleSensor(coordinator, SCHEDULE_SENSOR),
        ]
    )


class PrayerTimesEntity(CoordinatorEntity[PrayerTimesCoordinator]):
    """Base entity attached to the location's device."""

    _attr_has_entity_name = True
    _attr_attribution = "Data provided by Aladhan.com"

    def __init__(
        self, coordinator: PrayerTimesCoordinator, description: SensorEntityDescription
    ) -> None:
        super().__init__(coordinator)
        self.entity_description = description
        entry = coordinator.config_entry
        self._attr_unique_id = f"{entry.entry_id}_{description.key}"
        self._attr_device_info = DeviceInfo(
            identifiers={(DOMAIN, entry.entry_id)},
            name=entry.title,
            entry_type=DeviceEntryType.SERVICE,
        )


class PrayerTimesScheduleSensor(PrayerTimesEntity, SensorEntity):
    """The coming week of prayer times, used by the dashboard card.

    The state is the number of days available; the days themselves are in
    the "days" attribute, which is kept out of the recorder.
    """

    _unrecorded_attributes = frozenset({"days"})

    @property
    def native_value(self) -> int:
        """Return how many days are available."""
        return len(self.coordinator.data.days)

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        """Return each day's dates and prayer times."""
        return {
            "days": [
                {
                    "date": timings.date.isoformat(),
                    "hijri_date": str(timings.hijri),
                    **{
                        prayer: value.isoformat()
                        for prayer, value in timings.times.items()
                    },
                }
                for timings in self.coordinator.data.days
            ]
        }


class PrayerTimesSensor(PrayerTimesEntity, SensorEntity):
    """A single prayer time or date value."""

    entity_description: PrayerTimesSensorDescription

    @property
    def _timings(self) -> DayTimings:
        return getattr(self.coordinator.data, self.entity_description.day)

    @property
    def native_value(self) -> str | date | datetime:
        """Return the value for this sensor's day."""
        return self.entity_description.value_fn(self._timings)

    @property
    def extra_state_attributes(self) -> dict[str, Any] | None:
        """Return extra attributes, if any."""
        if self.entity_description.attrs_fn is None:
            return None
        return self.entity_description.attrs_fn(self._timings)
