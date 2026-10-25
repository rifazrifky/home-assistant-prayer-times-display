"""Constants for the Prayer Times Display integration."""

from __future__ import annotations

import logging
from typing import Final

DOMAIN: Final = "prayer_times_display"
LOGGER = logging.getLogger(__package__)

CONF_METHOD: Final = "method"
CONF_SCHOOL: Final = "school"
CONF_TIME_ZONE: Final = "time_zone"

# Aladhan calculation method IDs, see https://aladhan.com/calculation-methods
METHODS: Final = [
    "0",  # Shia Ithna-Ashari, Leva Institute, Qum
    "1",  # University of Islamic Sciences, Karachi
    "2",  # Islamic Society of North America
    "3",  # Muslim World League
    "4",  # Umm Al-Qura University, Makkah
    "5",  # Egyptian General Authority of Survey
    "7",  # Institute of Geophysics, University of Tehran
    "8",  # Gulf Region
    "9",  # Kuwait
    "10",  # Qatar
    "11",  # Majlis Ugama Islam Singapura
    "12",  # Union Organization Islamic de France
    "13",  # Diyanet İşleri Başkanlığı, Turkey
    "14",  # Spiritual Administration of Muslims of Russia
    "15",  # Moonsighting Committee Worldwide
    "16",  # Dubai
    "17",  # Jabatan Kemajuan Islam Malaysia (JAKIM)
    "18",  # Tunisia
    "19",  # Algeria
    "20",  # Kementerian Agama Republik Indonesia
    "21",  # Morocco
    "22",  # Comunidade Islamica de Lisboa
    "23",  # Ministry of Awqaf, Islamic Affairs and Holy Places, Jordan
]
SCHOOLS: Final = ["0", "1"]  # 0 = Shafi (standard), 1 = Hanafi

DEFAULT_METHOD: Final = "3"
DEFAULT_SCHOOL: Final = "0"

# Method suggested when a place in one of these countries is chosen; anywhere
# else falls back to DEFAULT_METHOD. Users can always pick another.
COUNTRY_METHODS: Final = {
    "AE": "16",
    "AF": "1",
    "BD": "1",
    "BH": "8",
    "CA": "2",
    "DZ": "19",
    "EG": "5",
    "FR": "12",
    "GB": "15",
    "ID": "20",
    "IN": "1",
    "IR": "7",
    "JO": "23",
    "KW": "9",
    "MA": "21",
    "MY": "17",
    "OM": "8",
    "PK": "1",
    "PT": "22",
    "QA": "10",
    "RU": "14",
    "SA": "4",
    "SG": "11",
    "TN": "18",
    "TR": "13",
    "US": "2",
}

# Entity keys mapped to the field names in the API's "timings" object, in day order
PRAYERS: Final = {
    "imsak": "Imsak",
    "fajr": "Fajr",
    "sunrise": "Sunrise",
    "dhuhr": "Dhuhr",
    "asr": "Asr",
    "maghrib": "Maghrib",
    "isha": "Isha",
}
DAYS: Final = ("today", "tomorrow")
# Days of prayer times kept by the coordinator, starting today
SCHEDULE_DAYS: Final = 7

CARD_FILENAME: Final = "prayer-times-display-card.js"
CARD_URL: Final = f"/{DOMAIN}/{CARD_FILENAME}"
