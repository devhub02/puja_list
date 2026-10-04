"""Entity models (docs/CONTENT_SCHEMA.md section 3). Cross-entity rules live in crosscheck.py."""

from __future__ import annotations

from typing import Annotated

from pydantic import Field

from .common import (
    AltNames,
    Classification,
    ContentModel,
    DateCertainty,
    EntityId,
    EntityStatus,
    IsoDate,
    LocaleMap,
    PujaCategory,
    Region,
    ReviewStatus,
)

Regions = Annotated[list[Region], Field(min_length=1)]


class Festival(ContentModel):
    id: EntityId
    name: LocaleMap
    alternate_names: AltNames | None = None
    description: LocaleMap
    significance: LocaleMap
    regions: Regions
    puja_ids: list[EntityId] = []
    status: EntityStatus = EntityStatus.active
    replaced_by: EntityId | None = None


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
    certainty: DateCertainty
    region_note: LocaleMap | None = None
    source: Annotated[str, Field(min_length=1)]


class CalendarYear(ContentModel):
    year: Annotated[int, Field(ge=1900, le=2200)]
    entries: list[CalendarEntry] = []


class ContentManifest(ContentModel):
    """content/content_manifest.json"""

    content_version: Annotated[int, Field(ge=1)]
    schema_version: Annotated[int, Field(ge=1)]
    languages: Annotated[list[str], Field(min_length=1)]
    calendar_years: list[int] = []
