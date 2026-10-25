"""Config flow for Prayer Times Display.

Setting up a location takes up to three steps:
1. user: search for a place by name (or leave blank for the home location)
2. pick: choose one of the matches, when there is more than one
3. location: confirm the map pin, coordinates, name, time zone and method

Config flow forms can't update fields live, so when the pin or coordinates are
changed in step 3, the time zone is refreshed on submit and the step is shown
again (as "location_updated") for a final check. The name and method are left
as they are for the user to adjust.
"""

from __future__ import annotations

from typing import Any
import zoneinfo

import voluptuous as vol

from homeassistant.config_entries import ConfigFlow, ConfigFlowResult, OptionsFlow
from homeassistant.const import CONF_LATITUDE, CONF_LOCATION, CONF_LONGITUDE, CONF_NAME
from homeassistant.core import callback
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.selector import (
    LocationSelector,
    NumberSelector,
    NumberSelectorConfig,
    NumberSelectorMode,
    SelectOptionDict,
    SelectSelector,
    SelectSelectorConfig,
    SelectSelectorMode,
    TextSelector,
)
from homeassistant.util import dt as dt_util

from .api import PrayerTimesApiError, async_fetch_day, async_fetch_time_zone
from .const import (
    CONF_METHOD,
    CONF_SCHOOL,
    CONF_TIME_ZONE,
    COUNTRY_METHODS,
    DEFAULT_METHOD,
    DEFAULT_SCHOOL,
    DOMAIN,
    LOGGER,
    METHODS,
    SCHOOLS,
)
from .coordinator import PrayerTimesConfigEntry
from .geocode import GeocodingError, Place, async_search

CONF_QUERY = "query"
CONF_PLACE = "place"

# Credit links shown in the setup steps; Home Assistant doesn't allow URLs in
# translation strings, so they're passed in as description placeholders
LINKS = {
    "aladhan_url": "https://aladhan.com",
    "open_meteo_url": "https://open-meteo.com",
}

# Coordinates closer than this (about 10 cm) count as unchanged
COORDINATE_TOLERANCE = 1e-6

METHOD_SELECTOR = SelectSelector(
    SelectSelectorConfig(
        options=METHODS, mode=SelectSelectorMode.DROPDOWN, translation_key=CONF_METHOD
    )
)
SCHOOL_SELECTOR = SelectSelector(
    SelectSelectorConfig(
        options=SCHOOLS, mode=SelectSelectorMode.LIST, translation_key=CONF_SCHOOL
    )
)
LATITUDE_SELECTOR = NumberSelector(
    NumberSelectorConfig(min=-90, max=90, step="any", mode=NumberSelectorMode.BOX)
)
LONGITUDE_SELECTOR = NumberSelector(
    NumberSelectorConfig(min=-180, max=180, step="any", mode=NumberSelectorMode.BOX)
)


def _suggested_method(country_code: str | None) -> str:
    return COUNTRY_METHODS.get((country_code or "").upper(), DEFAULT_METHOD)


def _moved(old: float, new: float) -> bool:
    return abs(old - new) > COORDINATE_TOLERANCE


class PrayerTimesConfigFlow(ConfigFlow, domain=DOMAIN):
    """Set up a location to fetch prayer times for."""

    VERSION = 1

    def __init__(self) -> None:
        self._places: list[Place] = []
        self._time_zones: set[str] = set()
        # Values currently shown on the location step
        self._values: dict[str, Any] = {}

    @staticmethod
    @callback
    def async_get_options_flow(config_entry: PrayerTimesConfigEntry) -> OptionsFlow:
        """Return the options flow."""
        return PrayerTimesOptionsFlow()

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Search for a place by name."""
        errors: dict[str, str] = {}

        if user_input is not None:
            query = (user_input.get(CONF_QUERY) or "").strip()
            if not query:
                return await self._async_start_location(self._home_place())
            try:
                self._places = await async_search(
                    async_get_clientsession(self.hass), query, self.hass.config.language
                )
            except GeocodingError as err:
                LOGGER.debug("Place search failed: %s", err)
                errors["base"] = "search_failed"
            else:
                if not self._places:
                    errors[CONF_QUERY] = "no_results"
                elif len(self._places) == 1:
                    return await self._async_start_location(self._places[0])
                else:
                    return await self.async_step_pick()

        schema = vol.Schema({vol.Optional(CONF_QUERY): TextSelector()})
        return self.async_show_form(
            step_id="user",
            data_schema=self.add_suggested_values_to_schema(schema, user_input),
            errors=errors,
            description_placeholders=LINKS,
        )

    async def async_step_pick(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Choose one of several search results."""
        if user_input is not None:
            choice = str(user_input[CONF_PLACE]).strip()
            if choice.isdigit() and int(choice) < len(self._places):
                return await self._async_start_location(self._places[int(choice)])
            # Anything typed that isn't one of the results is a new search
            return await self.async_step_user({CONF_QUERY: choice})

        options = [
            SelectOptionDict(value=str(index), label=place.label)
            for index, place in enumerate(self._places)
        ]
        schema = vol.Schema(
            {
                vol.Required(CONF_PLACE, default="0"): SelectSelector(
                    SelectSelectorConfig(
                        options=options,
                        mode=SelectSelectorMode.DROPDOWN,
                        custom_value=True,
                    )
                )
            }
        )
        return self.async_show_form(step_id="pick", data_schema=schema)

    async def async_step_location(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Confirm the details, refreshing them if the location was moved."""
        errors: dict[str, str] = {}
        step_id = "location"

        if user_input is not None:
            shown = self._values
            latitude, longitude = self._submitted_coordinates(user_input)
            self._values = {
                **shown,
                CONF_NAME: user_input[CONF_NAME],
                CONF_TIME_ZONE: user_input[CONF_TIME_ZONE],
                CONF_METHOD: user_input[CONF_METHOD],
                CONF_SCHOOL: user_input[CONF_SCHOOL],
                CONF_LATITUDE: latitude,
                CONF_LONGITUDE: longitude,
            }

            if _moved(shown[CONF_LATITUDE], latitude) or _moved(
                shown[CONF_LONGITUDE], longitude
            ):
                # A time zone the user picked by hand is kept
                if user_input[CONF_TIME_ZONE] == shown[CONF_TIME_ZONE]:
                    await self._async_update_time_zone()
                step_id = "location_updated"
            elif (result := await self._async_create(errors)) is not None:
                return result

        return self._show_location_form(step_id, errors)

    # Re-shown form after a move submits to the same handler
    async_step_location_updated = async_step_location

    def _home_place(self) -> Place:
        config = self.hass.config
        return Place(
            name=config.location_name,
            label=config.location_name,
            latitude=config.latitude,
            longitude=config.longitude,
            time_zone=config.time_zone,
            country_code=config.country,
        )

    async def _async_start_location(self, place: Place) -> ConfigFlowResult:
        """Fill the location step from a chosen place and show it."""
        if not self._time_zones:
            self._time_zones = await self.hass.async_add_executor_job(
                zoneinfo.available_timezones
            )
        self._values = {
            CONF_NAME: place.name,
            CONF_LATITUDE: place.latitude,
            CONF_LONGITUDE: place.longitude,
            CONF_TIME_ZONE: place.time_zone or self.hass.config.time_zone,
            CONF_METHOD: _suggested_method(place.country_code),
            CONF_SCHOOL: self._values.get(CONF_SCHOOL, DEFAULT_SCHOOL),
        }

        if place.time_zone not in self._time_zones:
            await self._async_update_time_zone()
        return self._show_location_form("location", {})

    def _submitted_coordinates(self, user_input: dict[str, Any]) -> tuple[float, float]:
        """Pick the coordinates the user changed: the boxes win over the map."""
        shown_lat = self._values[CONF_LATITUDE]
        shown_lon = self._values[CONF_LONGITUDE]
        typed_lat = float(user_input[CONF_LATITUDE])
        typed_lon = float(user_input[CONF_LONGITUDE])
        if _moved(shown_lat, typed_lat) or _moved(shown_lon, typed_lon):
            return typed_lat, typed_lon
        pin = user_input[CONF_LOCATION]
        return float(pin[CONF_LATITUDE]), float(pin[CONF_LONGITUDE])

    async def _async_update_time_zone(self) -> None:
        """Set the time zone for the current coordinates.

        A failed lookup leaves the current value; the user can still pick one.
        """
        try:
            time_zone = await async_fetch_time_zone(
                async_get_clientsession(self.hass),
                dt_util.now().date(),
                self._values[CONF_LATITUDE],
                self._values[CONF_LONGITUDE],
            )
        except PrayerTimesApiError as err:
            LOGGER.debug("Time zone lookup failed: %s", err)
            return
        if time_zone in self._time_zones:
            self._values[CONF_TIME_ZONE] = time_zone

    async def _async_create(self, errors: dict[str, str]) -> ConfigFlowResult | None:
        """Validate the final values and create the entry, or fill in errors."""
        values = self._values
        latitude = values[CONF_LATITUDE]
        longitude = values[CONF_LONGITUDE]

        await self.async_set_unique_id(f"{latitude:.4f}_{longitude:.4f}")
        self._abort_if_unique_id_configured()

        if values[CONF_TIME_ZONE] not in self._time_zones:
            errors[CONF_TIME_ZONE] = "invalid_time_zone"
            return None
        try:
            await async_fetch_day(
                async_get_clientsession(self.hass),
                dt_util.now().date(),
                latitude=latitude,
                longitude=longitude,
                method=values[CONF_METHOD],
                school=values[CONF_SCHOOL],
                time_zone=values[CONF_TIME_ZONE],
            )
        except PrayerTimesApiError as err:
            LOGGER.debug("Validation fetch failed: %s", err)
            errors["base"] = "cannot_connect"
            return None

        return self.async_create_entry(
            title=values[CONF_NAME],
            data={
                CONF_LATITUDE: latitude,
                CONF_LONGITUDE: longitude,
                CONF_TIME_ZONE: values[CONF_TIME_ZONE],
            },
            options={
                CONF_METHOD: values[CONF_METHOD],
                CONF_SCHOOL: values[CONF_SCHOOL],
            },
        )

    def _show_location_form(
        self, step_id: str, errors: dict[str, str]
    ) -> ConfigFlowResult:
        values = self._values
        schema = vol.Schema(
            {
                vol.Required(CONF_LOCATION): LocationSelector(),
                vol.Required(CONF_LATITUDE): LATITUDE_SELECTOR,
                vol.Required(CONF_LONGITUDE): LONGITUDE_SELECTOR,
                vol.Required(CONF_NAME): TextSelector(),
                vol.Required(CONF_TIME_ZONE): SelectSelector(
                    SelectSelectorConfig(
                        options=sorted(self._time_zones),
                        mode=SelectSelectorMode.DROPDOWN,
                    )
                ),
                vol.Required(CONF_METHOD): METHOD_SELECTOR,
                vol.Required(CONF_SCHOOL): SCHOOL_SELECTOR,
            }
        )
        suggested = {
            **values,
            CONF_LOCATION: {
                CONF_LATITUDE: values[CONF_LATITUDE],
                CONF_LONGITUDE: values[CONF_LONGITUDE],
            },
        }
        return self.async_show_form(
            step_id=step_id,
            data_schema=self.add_suggested_values_to_schema(schema, suggested),
            errors=errors,
            description_placeholders=LINKS,
        )


class PrayerTimesOptionsFlow(OptionsFlow):
    """Change the calculation method and school."""

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Manage the options."""
        if user_input is not None:
            return self.async_create_entry(data=user_input)

        schema = vol.Schema(
            {
                vol.Required(CONF_METHOD): METHOD_SELECTOR,
                vol.Required(CONF_SCHOOL): SCHOOL_SELECTOR,
            }
        )
        return self.async_show_form(
            step_id="init",
            data_schema=self.add_suggested_values_to_schema(
                schema,
                {
                    CONF_METHOD: DEFAULT_METHOD,
                    CONF_SCHOOL: DEFAULT_SCHOOL,
                    **self.config_entry.options,
                },
            ),
        )
