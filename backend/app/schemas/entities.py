"""Entity models (docs/CONTENT_SCHEMA.md section 3). Cross-entity rules live in crosscheck.py."""

from __future__ import annotations

from typing import Annotated

from pydantic import Field, model_validator

from .common import (
    AltNames,
    Classification,
    ContentModel,
    CALENDAR_ALL_REGIONS,
    DateCertainty,
    DateType,
    EntityId,
    EntityStatus,
    FestivalCategory,
    FestivalRegion,
    IsoDate,
    LocaleMap,
    PujaCategory,
    Region,
    ReviewStatus,
)

Regions = Annotated[list[Region], Field(min_length=1)]


class Festival(ContentModel):
    """A festival or observance. It may exist without a puja guide (calendar-only festival)."""

    id: EntityId
    name: LocaleMap
    alternate_names: AltNames | None = None
    short_description: LocaleMap
    significance: LocaleMap | None = None
    regions: Annotated[list[FestivalRegion], Field(min_length=1)]
    states: list[LocaleMap] = []
    category: FestivalCategory
    date_type: DateType
    observance_description: LocaleMap | None = None
    linked_puja_ids: list[EntityId] = []
    review_status: ReviewStatus
    source_note: LocaleMap
    status: EntityStatus = EntityStatus.active
    replaced_by: EntityId | None = None

    @model_validator(mode="after")
    def _festival_rules(self) -> Festival:
        # Rule 18: user-visible festival text needs both English and Hindi.
        visible = {
            "name": self.name,
            "shortDescription": self.short_description,
            "significance": self.significance,
            "observanceDescription": self.observance_description,
            "sourceNote": self.source_note,
        }
        for field, value in visible.items():
            if value is not None and "hi" not in value:
                raise ValueError(f"{field} needs an 'hi' entry as well as 'en'")
        for index, state in enumerate(self.states):
            if "hi" not in state:
                raise ValueError(f"states[{index}] needs an 'hi' entry as well as 'en'")
        # Rule 19: the exact date is never stated; the reader is sent to a panchang.
        if self.observance_description is not None:
            if "panchang" not in self.observance_description["en"].lower():
                raise ValueError("observanceDescription (en) must tell the reader to check a local panchang")
            if "पंचांग" not in self.observance_description["hi"]:
                raise ValueError("observanceDescription (hi) must tell the reader to check a local panchang (पंचांग)")
        if len(set(self.linked_puja_ids)) != len(self.linked_puja_ids):
            raise ValueError("linkedPujaIds contains a duplicate")
        return self


class SamagriItem(ContentModel):
    """Catalogue entry: puja-independent."""

    id: EntityId
    name: LocaleMap
    alternate_names: AltNames | None = None
    description: LocaleMap | None = None
    status: EntityStatus = EntityStatus.active
    replaced_by: EntityId | None = None


class SamagriUsage(ContentModel):
    """How one puja uses a catalogue item; the classification is per puja."""

    samagri_id: EntityId
    classification: Classification
    purpose: LocaleMap
    quantity_guidance: LocaleMap | None = None
    preparation_note: LocaleMap | None = None
    regional_note: LocaleMap | None = None
    sort_order: int


class VidhiStep(ContentModel):
    id: EntityId
    step_number: Annotated[int, Field(ge=1)]
    title: LocaleMap
    description: LocaleMap
    related_samagri_ids: list[EntityId] = []
    is_optional: bool = False
    important_note: LocaleMap | None = None


class RegionalVariation(ContentModel):
    id: EntityId
    regions: Regions
    title: LocaleMap
    description: LocaleMap
    affects_step_ids: list[EntityId] = []
    affects_samagri_ids: list[EntityId] = []


class ChecklistItem(ContentModel):
    id: EntityId
    text: LocaleMap
    days_before: Annotated[int, Field(ge=0)]


class Puja(ContentModel):
    id: EntityId
    festival_id: EntityId | None = None
    name: LocaleMap
    alternate_names: AltNames | None = None
    category: PujaCategory
    regions: Regions
    summary: LocaleMap
    significance: LocaleMap
    samagri: list[SamagriUsage] = []
    steps: list[VidhiStep] = []
    variations: list[RegionalVariation] = []
    preparation_checklist: list[ChecklistItem] = []
    disclaimer: LocaleMap | None = None
    review_status: ReviewStatus
    source_note: LocaleMap
    content_version: Annotated[int, Field(ge=1)]
    status: EntityStatus = EntityStatus.active
    replaced_by: EntityId | None = None


class CalendarEntry(ContentModel):
    id: EntityId
    festival_id: EntityId
    date: IsoDate
    end_date: IsoDate | None = None
    region: str = CALENDAR_ALL_REGIONS
    certainty: DateCertainty
    region_note: LocaleMap | None = None
    source: Annotated[str, Field(min_length=1)]


    @model_validator(mode="after")
    def _region_is_known(self) -> CalendarEntry:
        if self.region != CALENDAR_ALL_REGIONS and self.region not in {r.value for r in FestivalRegion}:
            allowed = [CALENDAR_ALL_REGIONS] + [r.value for r in FestivalRegion]
            raise ValueError(f"region {self.region!r} is not one of {allowed}")
        return self


class CalendarYear(ContentModel):
    year: Annotated[int, Field(ge=1900, le=2200)]
    entries: list[CalendarEntry] = []


class ContentManifest(ContentModel):
    """content/content_manifest.json"""

    content_version: Annotated[int, Field(ge=1)]
    schema_version: Annotated[int, Field(ge=1)]
    languages: Annotated[list[str], Field(min_length=1)]
    calendar_years: list[int] = []
