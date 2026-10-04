"""Shared building blocks of the content schema (see docs/CONTENT_SCHEMA.md section 1)."""

from __future__ import annotations

import re
from datetime import date
from enum import Enum
from typing import Annotated

from pydantic import AfterValidator, BaseModel, ConfigDict, StringConstraints
from pydantic.alias_generators import to_camel

SCHEMA_VERSION = 2

ID_PATTERN = r"^[a-z0-9]+(_[a-z0-9]+)*$"
LANGUAGE_PATTERN = r"^[a-z]{2,3}(-[A-Za-z0-9]+)*$"
_ISO_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
_LANGUAGE = re.compile(LANGUAGE_PATTERN)


class Classification(str, Enum):
    REQUIRED = "REQUIRED"
    COMMON = "COMMON"
    OPTIONAL = "OPTIONAL"


class ReviewStatus(str, Enum):
    ai_drafted = "ai_drafted"
    cross_checked = "cross_checked"
    expert_verified = "expert_verified"


class DateCertainty(str, Enum):
    confirmed = "confirmed"
    provisional = "provisional"
    varies_by_region = "varies_by_region"


class EntityStatus(str, Enum):
    active = "active"
    deprecated = "deprecated"


class Region(str, Enum):
    north = "north"
    east = "east"
    south = "south"
    west = "west"
    central = "central"
    north_east = "north_east"
    tribal_regional = "tribal_regional"
    pan_india = "pan_india"


class FestivalRegion(str, Enum):
    """Fixed region list for festivals (Region, above, is the older list used by pujas)."""

    pan_india = "pan_india"
    north = "north"
    east = "east"
    west = "west"
    south = "south"
    central = "central"
    north_east = "north_east"
    himalayan = "himalayan"
    tribal = "tribal"


class FestivalCategory(str, Enum):
    deity_festival = "deity_festival"
    harvest_seasonal = "harvest_seasonal"
    new_year = "new_year"
    vrat_fasting = "vrat_fasting"
    family_bond = "family_bond"
    nature_ritual = "nature_ritual"
    yatra_mela = "yatra_mela"


class DateType(str, Enum):
    fixed_gregorian = "fixed_gregorian"
    solar = "solar"
    lunar = "lunar"
    regional = "regional"
    variable = "variable"


# Region values allowed in a calendar entry / CSV row: "all" or one FestivalRegion value.
CALENDAR_ALL_REGIONS = "all"


class PujaCategory(str, Enum):
    festival = "festival"
    vrat = "vrat"
    household = "household"
    life_cycle = "life_cycle"
    regional = "regional"
    tribal = "tribal"


class ContentModel(BaseModel):
    """Base for every content model: camelCase JSON names, unknown fields rejected."""

    model_config = ConfigDict(
        extra="forbid",
        alias_generator=to_camel,
        populate_by_name=True,
    )


EntityId = Annotated[str, StringConstraints(pattern=ID_PATTERN, max_length=100)]


def _check_language_key(key: str) -> None:
    if not _LANGUAGE.match(key):
        raise ValueError(f"invalid language code {key!r} (expected e.g. 'en', 'hi', 'pt-BR')")


def _check_locale_map(value: dict[str, str]) -> dict[str, str]:
    for key, text in value.items():
        _check_language_key(key)
        if not text.strip():
            raise ValueError(f"locale map entry {key!r} is empty")
    if "en" not in value:
        raise ValueError("locale map must contain an 'en' entry")
    return value


def _check_alt_names(value: dict[str, list[str]]) -> dict[str, list[str]]:
    for key, names in value.items():
        _check_language_key(key)
        for name in names:
            if not name.strip():
                raise ValueError(f"alternate name list {key!r} contains an empty string")
    return value


# {"en": "...", "hi": "..."}; "en" is mandatory, every value non-empty.
LocaleMap = Annotated[dict[str, str], AfterValidator(_check_locale_map)]
# {"en": ["Laxmi"], "hi": ["लक्ष्मी"]}; search-only alternate spellings (never displayed).
AltNames = Annotated[dict[str, list[str]], AfterValidator(_check_alt_names)]


def _check_iso_date(value: str) -> str:
    if not _ISO_DATE.match(value):
        raise ValueError(f"{value!r} is not a YYYY-MM-DD date")
    try:
        date.fromisoformat(value)
    except ValueError as exc:
        raise ValueError(f"{value!r} is not a real calendar date") from exc
    return value


IsoDate = Annotated[str, AfterValidator(_check_iso_date)]
