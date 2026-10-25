"""The Prayer Times Display integration."""

from __future__ import annotations

from pathlib import Path

from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.const import Platform
from homeassistant.core import HomeAssistant
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.typing import ConfigType
from homeassistant.loader import async_get_integration

from .const import CARD_FILENAME, CARD_URL, DOMAIN, LOGGER
from .coordinator import PrayerTimesConfigEntry, PrayerTimesCoordinator
from .dashboard import async_register_card_resource, async_unregister_card_resource

PLATFORMS: list[Platform] = [Platform.SENSOR]

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)


async def _async_card_url(hass: HomeAssistant) -> str:
    """The card's URL; the version query string busts caches after an update."""
    integration = await async_get_integration(hass, DOMAIN)
    return f"{CARD_URL}?v={integration.version}"


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Serve the Lovelace card and load it on every dashboard."""
    card_path = Path(__file__).parent / "frontend" / CARD_FILENAME
    await hass.http.async_register_static_paths(
        [StaticPathConfig(CARD_URL, str(card_path), cache_headers=True)]
    )
    add_extra_js_url(hass, await _async_card_url(hass))
    return True


async def async_setup_entry(hass: HomeAssistant, entry: PrayerTimesConfigEntry) -> bool:
    """Set up a prayer times location from a config entry."""
    # Casting a dashboard only loads its resources, so keep the card in them.
    # A problem here must not stop the location from loading.
    try:
        await async_register_card_resource(hass, await _async_card_url(hass))
    except Exception:  # noqa: BLE001
        LOGGER.warning(
            "Couldn't add the card to the dashboard resources; it may not show "
            "when casting a dashboard",
            exc_info=True,
        )

    coordinator = PrayerTimesCoordinator(hass, entry)
    await coordinator.async_config_entry_first_refresh()
    entry.runtime_data = coordinator

    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    entry.async_on_unload(entry.add_update_listener(_async_options_updated))
    return True


async def async_unload_entry(hass: HomeAssistant, entry: PrayerTimesConfigEntry) -> bool:
    """Unload a config entry."""
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)


async def async_remove_entry(hass: HomeAssistant, entry: PrayerTimesConfigEntry) -> None:
    """Remove the card's dashboard resource once the last location is deleted."""
    remaining = [
        other
        for other in hass.config_entries.async_entries(DOMAIN)
        if other.entry_id != entry.entry_id
    ]
    if remaining:
        return
    try:
        await async_unregister_card_resource(hass)
    except Exception:  # noqa: BLE001
        LOGGER.warning("Couldn't remove the card's dashboard resource", exc_info=True)


async def _async_options_updated(
    hass: HomeAssistant, entry: PrayerTimesConfigEntry
) -> None:
    """Reload so a new method or school is fetched straight away."""
    await hass.config_entries.async_reload(entry.entry_id)
