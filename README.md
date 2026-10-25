<img src="custom_components/prayer_times_display/brand/icon@2x.png" alt="" width="96" height="96" align="right">

# Prayer Times Display for Home Assistant

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://hacs.xyz/docs/faq/custom_repositories)
[![Validate](https://github.com/rifazrifky/home-assistant-prayer-times-display/actions/workflows/validate.yml/badge.svg)](https://github.com/rifazrifky/home-assistant-prayer-times-display/actions/workflows/validate.yml)
[![GitHub release](https://img.shields.io/github/v/release/rifazrifky/home-assistant-prayer-times-display)](https://github.com/rifazrifky/home-assistant-prayer-times-display/releases)

Daily Islamic prayer times for any location, with a dashboard card to display them.

> **Data source:** prayer times, Hijri dates and time zones are pulled from the free public [Aladhan prayer times API](https://aladhan.com/prayer-times-api). This is an independent project and isn't affiliated with or endorsed by Aladhan.com or Islamic Network. See [Data sources and attribution](#data-sources-and-attribution).

- Set up entirely from the UI: pick a location on the map, a calculation method and an Asr school
- Sensors for today **and tomorrow**: Imsak, Fajr, Sunrise, Dhuhr, Asr, Maghrib and Isha, plus the Gregorian and Hijri dates
- A dashboard card showing 1 to 7 days as a table, a next-prayer countdown or a timeline, with the current and next prayer highlighted
- Prayer times are timestamp sensors, so they show in your own 12/24-hour format and can trigger automations directly
- Includes a dashboard card, registered automatically (no resource to add)
- Add as many locations as you like
- No API key needed

## Requirements

- Home Assistant 2025.2 or newer (the integration's icon shows from 2026.3)
- Internet access to `api.aladhan.com` (and, while adding a location, `geocoding-api.open-meteo.com`)

## Installation

### HACS (recommended)

[![Open your Home Assistant instance and open a repository inside the Home Assistant Community Store.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=rifazrifky&repository=home-assistant-prayer-times-display&category=integration)

Or manually in HACS:

1. Open the menu (⋮) → **Custom repositories**, add `https://github.com/rifazrifky/home-assistant-prayer-times-display` with type **Integration**.
2. Search for **Prayer Times Display** and download it.
3. Restart Home Assistant.

### Manual

1. Download the latest release and copy `custom_components/prayer_times_display` into your `config/custom_components` folder.
2. Restart Home Assistant.

## Configuration

[![Open your Home Assistant instance and start setting up a new integration.](https://my.home-assistant.io/badges/config_flow_start.svg)](https://my.home-assistant.io/redirect/config_flow_start/?domain=prayer_times_display)

Or go to **Settings → Devices & services → Add integration → Prayer Times Display**.

1. **Search** for a city or town, e.g. `Dubai`. Leave it blank to use your home location.
2. **Pick** the right match if there are several. You can also type a different name to search again.
3. **Confirm** the details. The map pin, coordinates, name, time zone and a suggested calculation method are filled in for you:

| Field | Description |
| --- | --- |
| Location / Latitude / Longitude | Drag the pin or type coordinates to fine-tune the location |
| Name | Used for the device and entity names, e.g. `Dubai` |
| Time zone | The location's time zone |
| Calculation method | The authority whose angles are used, suggested from the country (see below) |
| Asr juristic method | Standard (Shafi, Maliki, Hanbali) or Hanafi |

If you move the pin or change the coordinates, submitting refreshes the time zone to match the new spot and shows the form again so you can check it. A time zone you picked yourself is kept. The name and calculation method aren't changed, so update them if the new spot needs it.

Place search uses [Open-Meteo](https://open-meteo.com/en/docs/geocoding-api), which is only contacted while you're adding a location, never in the background. See [Data sources and attribution](#data-sources-and-attribution).

You can change the method and school later from the integration's **Configure** button. To track another city, add the integration again with a different location.

The integration keeps a rolling week of prayer times. After the first fetch, only the newly added day is fetched each night, just after midnight in the location's time zone. If a fetch fails it is retried every few minutes.

### Choosing a calculation method

Different authorities use different sun angles for Fajr and Isha, so times can differ by several minutes. Setup suggests a method based on the country, but check it against your local mosque or official announcements:

| Region | Suggested method |
| --- | --- |
| United Arab Emirates | Dubai |
| Saudi Arabia | Umm Al-Qura University, Makkah |
| Other Gulf states | Gulf Region, Kuwait or Qatar |
| North America | Islamic Society of North America (ISNA) |
| United Kingdom, Europe | Muslim World League or Moonsighting Committee Worldwide |
| Pakistan, India, Bangladesh | University of Islamic Sciences, Karachi |
| Egypt and much of Africa | Egyptian General Authority of Survey |
| Turkey | Diyanet İşleri Başkanlığı |
| Malaysia / Singapore / Indonesia | JAKIM / MUIS / Kementerian Agama |

The full list is on [aladhan.com/calculation-methods](https://aladhan.com/calculation-methods).

## Entities

Each location becomes a device with these sensors. For a location named `Dubai`:

| Entity | State |
| --- | --- |
| `sensor.dubai_date` | Today's date, e.g. `2026-10-24` |
| `sensor.dubai_hijri_date` | e.g. `13 Jumādá al-ūlá 1448`, with `day`, `month`, `month_name`, `month_name_ar` and `year` attributes |
| `sensor.dubai_imsak` | Timestamp (end of suhoor) |
| `sensor.dubai_fajr` | Timestamp |
| `sensor.dubai_sunrise` | Timestamp |
| `sensor.dubai_dhuhr` | Timestamp |
| `sensor.dubai_asr` | Timestamp |
| `sensor.dubai_maghrib` | Timestamp |
| `sensor.dubai_isha` | Timestamp |
| `sensor.dubai_tomorrow_*` | The same values for tomorrow |
| `sensor.dubai_weekly_schedule` | Number of days available (7). The `days` attribute lists each day's `date`, `hijri_date` and prayer times. Used by the card; the attribute isn't stored in history |

### Automation examples

Notify at Maghrib:

```yaml
triggers:
  - trigger: time
    at: sensor.dubai_maghrib
actions:
  - action: notify.mobile_app_phone
    data:
      message: "It's time for Maghrib"
```

Turn on a light 15 minutes before Fajr:

```yaml
triggers:
  - trigger: time
    at:
      entity_id: sensor.dubai_fajr
      offset: "-00:15:00"
actions:
  - action: light.turn_on
    target:
      entity_id: light.bedroom
```

## Dashboard card

The card is loaded automatically. Add it from the card picker (**Prayer Times Display**) or in YAML:

```yaml
type: custom:prayer-times-display-card
title: Prayer Times in Dubai
days: 2
design: table
rendering_style: vertical
alignment: left
```

| Option | Default | Description |
| --- | --- | --- |
| `device_id` | first location | Which location to show if you have several. Easiest to pick in the visual editor |
| `title` | `Prayer Times` | Shown at the top of the card |
| `days` | `1` | How many days to show, from `1` (today only) to `7`. `2` adds tomorrow; later days are labelled with the weekday |
| `design` | `table` | How the times are drawn; see below |
| `rendering_style` | `vertical` | `vertical` or `horizontal`; see below. Horizontal suits more than 3 days best |
| `alignment` | `left` | `left`, `center` or `right` |

### Designs

Every design highlights the **current prayer** in green with a **Now** tag and the **next prayer** in blue with a **Next** tag. Prayers that have already passed today are dimmed. These update by themselves every 30 seconds.

| `design` | What it shows | Vertical | Horizontal |
| --- | --- | --- | --- |
| `table` | A table of times with an icon per prayer, plus "Dhuhr now" and "Asr in 1h 12m" badges in the header | Prayers as rows, days as columns | Days as rows, prayers as columns |
| `focus` | A large panel with the next prayer, a countdown and a progress bar since the previous prayer, plus today's times | Today's list below the panel, other days in a compact table | Panel on the left, a row of times per day on the right |
| `timeline` | Each day drawn as a line through the day, with every prayer placed at its time, daylight shaded and the current time marked | Days as columns, time running down | Days as rows, time running across |

The current prayer is the last one to have started. Fajr's time ends at sunrise, so between sunrise and Dhuhr only the next prayer is marked. After Isha, the next prayer is tomorrow's Fajr, which is highlighted if tomorrow is shown.

Times follow the time format and time zone set in your Home Assistant user profile.

## Migrating from the YAML setup

If you used the earlier `command_line` + `template` YAML version of this project:

1. Install and set up this integration as above.
2. Remove the two `command_line` sensors (`Prayer Times Dubai` and `Prayer Times Dubai - Tomorrow`) and all `Prayer Times Dubai …` template sensors from `configuration.yaml`.
3. Delete the **Update Prayer Times** automation; the integration refreshes itself.
4. Remove the `/local/prayer-times-dxb-card.js` dashboard resource and delete `www/prayer-times-dxb-card.js`.
5. In your dashboards, change `type: custom:prayer-times-dxb-card` to `type: custom:prayer-times-display-card`. The `title`, `rendering_style` and `alignment` options work as before. Replace `include_next_day: true` with `days: 2`.
6. Update any automations or templates that used the old entity IDs. The `_12h` sensors are no longer needed, because timestamp sensors are shown in each user's preferred format.
7. Restart Home Assistant.

## Troubleshooting

**The card says "No prayer times found".** Set up the integration first, then refresh the browser.

**The card is missing from the card picker, or shows "Custom element not found: prayer-times-display-card".** The card is loaded once the integration has been set up, but your browser may still be using a cached copy of Home Assistant from before. Reload with Ctrl+F5. If that doesn't help, open the browser's developer tools (F12) → **Application → Service workers**, click **Unregister**, and reload again. On the mobile app, use **Settings → Companion app → Debugging → Reset frontend cache**.

**Times differ from my local mosque.** Try a different calculation method or Asr school from the integration's **Configure** button.

**Debug logging.** Add this to `configuration.yaml`, restart and check the logs:

```yaml
logger:
  logs:
    custom_components.prayer_times_display: debug
```

## Removing the integration

1. Go to **Settings → Devices & services → Prayer Times Display**, open the menu (⋮) on each location and choose **Delete**.
2. Remove any cards using `custom:prayer-times-display-card` from your dashboards.
3. If installed with HACS, remove it in HACS; otherwise delete `custom_components/prayer_times_display`.
4. Restart Home Assistant.

## Contributing

Issues and pull requests are welcome on [GitHub](https://github.com/rifazrifky/home-assistant-prayer-times-display/issues). Every push is checked by the HACS and hassfest validation workflows.

## Data sources and attribution

This integration doesn't calculate or host any prayer time data itself. It calls these public services:

| Service | Used for | When | Terms |
| --- | --- | --- | --- |
| [Aladhan prayer times API](https://aladhan.com/prayer-times-api) by [Islamic Network](https://islamic.network) | Prayer times, Hijri dates, time zone of a location | One request per new day per location, plus when adding a location | [Credits and terms](https://aladhan.com/credits-and-terms). Free to use, no API key; provided without warranty, and times may not match every local authority |
| [Open-Meteo Geocoding API](https://open-meteo.com/en/docs/geocoding-api) | Searching for a place by name | Only while adding a location | Free for non-commercial use; data under [CC BY 4.0](https://open-meteo.com/en/license) |

Each sensor carries the attribution "Data provided by Aladhan.com". This project is independent and isn't affiliated with or endorsed by Aladhan.com, Islamic Network or Open-Meteo. Their names are used only to identify the data sources.

Prayer times are calculations. Always confirm them against your local mosque or official announcements.

## License

[MIT](LICENSE)
