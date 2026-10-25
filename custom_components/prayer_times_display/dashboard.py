"""Keeps the card registered as a dashboard resource.

The card is loaded on every dashboard with ``add_extra_js_url``, but Home
Assistant's cast receiver (used when casting a dashboard to a Google Cast
device such as a Nest Hub) only loads the dashboard's resources. Registering
the card as a resource too makes it work there. The browser loads it only once,
because both use the same URL.

Only dashboards whose resources are managed in the UI (storage mode) can be
updated. In YAML mode the resource has to be added by hand.
"""

from __future__ import annotations

import asyncio
from typing import Any

from homeassistant.components.lovelace.const import LOVELACE_DATA
from homeassistant.components.lovelace.resources import ResourceStorageCollection
from homeassistant.core import HomeAssistant

from .const import CARD_URL, DOMAIN, LOGGER

RESOURCE_TYPE = "module"

# Entries can be set up concurrently; this stops them adding the resource twice
_LOCK_KEY = f"{DOMAIN}_resource_lock"


def _storage_resources(hass: HomeAssistant) -> ResourceStorageCollection | None:
    """Return the editable resource collection, or None in YAML mode."""
    lovelace = hass.data.get(LOVELACE_DATA)
    if lovelace is None:
        return None
    resources = lovelace.resources
    return resources if isinstance(resources, ResourceStorageCollection) else None


def _is_card(item: dict[str, Any]) -> bool:
    """Whether a resource points at this card, whatever its version."""
    return str(item.get("url", "")).split("?", 1)[0] == CARD_URL


async def async_register_card_resource(hass: HomeAssistant, url: str) -> None:
    """Add the card as a dashboard resource, or bring an existing one up to date."""
    resources = _storage_resources(hass)
    if resources is None:
        LOGGER.info(
            "Dashboard resources are managed in YAML. To show the Prayer Times "
            "Display card when casting a dashboard, add %s as a JavaScript "
            "module resource",
            url,
        )
        return

    lock = hass.data.setdefault(_LOCK_KEY, asyncio.Lock())
    async with lock:
        # Loads the resources from storage if nothing has read them yet
        await resources.async_get_info()
        existing = [item for item in resources.async_items() if _is_card(item)]

        if not existing:
            await resources.async_create_item({"res_type": RESOURCE_TYPE, "url": url})
            LOGGER.debug("Added dashboard resource %s", url)
            return

        first, *duplicates = existing
        if first.get("url") != url or first.get("type") != RESOURCE_TYPE:
            await resources.async_update_item(
                first["id"], {"res_type": RESOURCE_TYPE, "url": url}
            )
            LOGGER.debug("Updated dashboard resource to %s", url)
        for item in duplicates:
            await resources.async_delete_item(item["id"])
            LOGGER.debug("Removed duplicate dashboard resource %s", item.get("url"))


async def async_unregister_card_resource(hass: HomeAssistant) -> None:
    """Remove the card's dashboard resource."""
    resources = _storage_resources(hass)
    if resources is None:
        return

    lock = hass.data.setdefault(_LOCK_KEY, asyncio.Lock())
    async with lock:
        await resources.async_get_info()
        for item in [item for item in resources.async_items() if _is_card(item)]:
            await resources.async_delete_item(item["id"])
            LOGGER.debug("Removed dashboard resource %s", item.get("url"))
