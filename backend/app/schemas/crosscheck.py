"""Cross-entity validation rules (docs/CONTENT_SCHEMA.md section 6).

Pure function over an already structurally valid bundle. Returns issues instead of raising so the
CLI can print all of them at once, with the file, entity id and field of each.
"""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Iterator

from pydantic import BaseModel

if TYPE_CHECKING:
    from .bundle import ContentBundle


@dataclass(frozen=True)
class ContentIssue:
    file: str
    entity: str | None
    field: str | None
    message: str

    def __str__(self) -> str:
        parts = [self.file]
        if self.entity:
            parts.append(self.entity)
        if self.field:
            parts.append(self.field)
        return f"{': '.join(parts)}: {self.message}"


def puja_file(puja_id: str) -> str:
    return f"pujas/{puja_id}.json"


def calendar_file(year: int) -> str:
    return f"calendar/{year}.json"


FESTIVALS_FILE = "festivals.json"
SAMAGRI_FILE = "samagri.json"
MANIFEST_FILE = "content_manifest.json"


def _walk_dicts(value: Any, path: str) -> Iterator[tuple[str, dict[str, Any]]]:
    """Yield every locale map / alternate-names dict inside a model, with its field path."""
    if isinstance(value, BaseModel):
        for name, info in type(value).model_fields.items():
            alias = info.alias or name
            yield from _walk_dicts(getattr(value, name), f"{path}.{alias}" if path else alias)
    elif isinstance(value, dict):
        yield path, value
    elif isinstance(value, list):
        for index, item in enumerate(value):
            yield from _walk_dicts(item, f"{path}[{index}]")


def cross_validate(bundle: ContentBundle) -> list[ContentIssue]:
    issues: list[ContentIssue] = []

    def add(file: str, entity: str | None, field: str | None, message: str) -> None:
        issues.append(ContentIssue(file, entity, field, message))

    def duplicates(ids: list[str]) -> set[str]:
        return {i for i, n in Counter(ids).items() if n > 1}

    festival_ids = {f.id for f in bundle.festivals}
    puja_ids = {p.id for p in bundle.pujas}
    samagri_ids = {s.id for s in bundle.samagri}
    languages = set(bundle.languages)

    # Rule 2: unique ids per entity type.
    for dup in sorted(duplicates([f.id for f in bundle.festivals])):
        add(FESTIVALS_FILE, dup, "id", "duplicate festival id")
    for dup in sorted(duplicates([s.id for s in bundle.samagri])):
        add(SAMAGRI_FILE, dup, "id", "duplicate samagri id")
    for dup in sorted(duplicates([p.id for p in bundle.pujas])):
        add(puja_file(dup), dup, "id", "duplicate puja id")

    step_owner: dict[str, str] = {}
    variation_owner: dict[str, str] = {}
    checklist_owner: dict[str, str] = {}
    for puja in bundle.pujas:
        for step in puja.steps:
            if step.id in step_owner:
                add(puja_file(puja.id), puja.id, f"steps[{step.id}].id",
                    f"duplicate step id (also used in puja {step_owner[step.id]!r})")
            step_owner.setdefault(step.id, puja.id)
        for variation in puja.variations:
            if variation.id in variation_owner:
                add(puja_file(puja.id), puja.id, f"variations[{variation.id}].id",
                    f"duplicate variation id (also used in puja {variation_owner[variation.id]!r})")
            variation_owner.setdefault(variation.id, puja.id)
        for item in puja.preparation_checklist:
            if item.id in checklist_owner:
                add(puja_file(puja.id), puja.id, f"preparationChecklist[{item.id}].id",
                    f"duplicate checklist item id (also used in puja {checklist_owner[item.id]!r})")
            checklist_owner.setdefault(item.id, puja.id)

    # Rule 1: locale-map keys must be languages listed in the manifest.
    def check_languages(file: str, entity: str, model: BaseModel) -> None:
        for path, mapping in _walk_dicts(model, ""):
            for key in mapping:
                if key not in languages:
                    add(file, entity, path,
                        f"language {key!r} is not in the manifest languages {sorted(languages)}")

    for festival in bundle.festivals:
        check_languages(FESTIVALS_FILE, festival.id, festival)
    for item in bundle.samagri:
        check_languages(SAMAGRI_FILE, item.id, item)
    for puja in bundle.pujas:
        check_languages(puja_file(puja.id), puja.id, puja)

    # Rule 11 and festival links.
    puja_by_id = {p.id: p for p in bundle.pujas}
    for puja in bundle.pujas:
        if puja.festival_id is not None:
            if puja.festival_id not in festival_ids:
                add(puja_file(puja.id), puja.id, "festivalId",
                    f"festival {puja.festival_id!r} does not exist")
            else:
                festival = next(f for f in bundle.festivals if f.id == puja.festival_id)
                if puja.id not in festival.linked_puja_ids:
                    add(puja_file(puja.id), puja.id, "festivalId",
                        f"festival {festival.id!r} does not list this puja in linkedPujaIds")
    for festival in bundle.festivals:
        for pid in festival.linked_puja_ids:
            if pid not in puja_ids:
                add(FESTIVALS_FILE, festival.id, "linkedPujaIds", f"puja {pid!r} does not exist")

    # replacedBy points at an existing entity of the same type.
    for kind, entities, known, file_of in (
        ("festival", bundle.festivals, festival_ids, lambda _id: FESTIVALS_FILE),
        ("samagri", bundle.samagri, samagri_ids, lambda _id: SAMAGRI_FILE),
        ("puja", bundle.pujas, puja_ids, puja_file),
    ):
        for entity in entities:
            if entity.replaced_by is not None and entity.replaced_by not in known:
                add(file_of(entity.id), entity.id, "replacedBy",
                    f"{kind} {entity.replaced_by!r} does not exist")

    # Per-puja rules.
    for puja in bundle.pujas:
        file = puja_file(puja.id)
        used = [u.samagri_id for u in puja.samagri]

        # Rule 14.
        if puja.content_version > bundle.content_version:
            add(file, puja.id, "contentVersion",
                f"{puja.content_version} is greater than the bundle contentVersion {bundle.content_version}")

        # Rules 5, 6, 8.
        for dup in sorted(duplicates(used)):
            add(file, puja.id, "samagri", f"samagri {dup!r} is listed more than once in this puja")
        for index, usage in enumerate(puja.samagri):
            if usage.samagri_id not in samagri_ids:
                add(file, puja.id, f"samagri[{index}].samagriId",
                    f"samagri {usage.samagri_id!r} does not exist in samagri.json")
        for dup in sorted(duplicates([str(u.sort_order) for u in puja.samagri])):
            add(file, puja.id, "samagri", f"sortOrder {dup} is used more than once in this puja")

        # Rule 7.
        numbers = sorted(s.step_number for s in puja.steps)
        if numbers != list(range(1, len(numbers) + 1)):
            add(file, puja.id, "steps",
                f"stepNumber values must be exactly 1..{len(numbers)} with no gaps or duplicates, got {numbers}")

        puja_samagri = set(used)
        puja_steps = {s.id for s in puja.steps}
        for step in puja.steps:
            for sid in step.related_samagri_ids:
                if sid not in puja_samagri:
                    add(file, puja.id, f"steps[{step.id}].relatedSamagriIds",
                        f"samagri {sid!r} is not in this puja's samagri list")
        for variation in puja.variations:
            for sid in variation.affects_step_ids:
                if sid not in puja_steps:
                    add(file, puja.id, f"variations[{variation.id}].affectsStepIds",
                        f"step {sid!r} is not a step of this puja")
            for sid in variation.affects_samagri_ids:
                if sid not in puja_samagri:
                    add(file, puja.id, f"variations[{variation.id}].affectsSamagriIds",
                        f"samagri {sid!r} is not in this puja's samagri list")

    # Rule 12: calendar.
    years = [c.year for c in bundle.calendar]
    for dup in sorted(duplicates([str(y) for y in years])):
        add(calendar_file(int(dup)), None, "year", "more than one calendar file for this year")
    calendar_ids: list[str] = []
    for cal in bundle.calendar:
        file = calendar_file(cal.year)
        seen: set[tuple[str, str]] = set()
        for entry in cal.entries:
            calendar_ids.append(entry.id)
            if entry.festival_id not in festival_ids:
                add(file, entry.id, "festivalId", f"festival {entry.festival_id!r} does not exist")
            if int(entry.date[:4]) != cal.year:
                add(file, entry.id, "date", f"{entry.date} is not in the file's year {cal.year}")
            if entry.end_date is not None:
                if entry.end_date < entry.date:
                    add(file, entry.id, "endDate", f"{entry.end_date} is before date {entry.date}")
                if int(entry.end_date[:4]) != cal.year:
                    add(file, entry.id, "endDate",
                        f"{entry.end_date} is not in the file's year {cal.year}")
            key = (entry.festival_id, entry.region)
            if key in seen:
                add(file, entry.id, "region",
                    f"festival {entry.festival_id!r} already has an entry for region {entry.region!r} in {cal.year}")
            seen.add(key)
    for dup in sorted(duplicates(calendar_ids)):
        add("calendar", dup, "id", "duplicate calendar entry id")

    return issues
