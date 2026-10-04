"""Reads content/ from disk and validates it. Never creates or alters content."""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable

from pydantic import BaseModel, ValidationError

from app.schemas import (
    SCHEMA_VERSION,
    CalendarYear,
    ContentBundle,
    ContentIssue,
    ContentManifest,
    Festival,
    Puja,
    SamagriItem,
    cross_validate,
)
from app.schemas.crosscheck import FESTIVALS_FILE, MANIFEST_FILE, SAMAGRI_FILE

DEFAULT_CONTENT_DIR = Path(__file__).resolve().parents[3] / "content"


@dataclass
class LoadResult:
    bundle: ContentBundle | None
    issues: list[ContentIssue] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.issues and self.bundle is not None


def _format_loc(loc: tuple[Any, ...]) -> str:
    out = ""
    for part in loc:
        if isinstance(part, int):
            out += f"[{part}]"
        else:
            out += f".{part}" if out else str(part)
    return out


def _pydantic_issues(
    file: str, exc: ValidationError, entity_of: Callable[[tuple[Any, ...]], str | None]
) -> list[ContentIssue]:
    issues = []
    for err in exc.errors():
        loc = tuple(err["loc"])
        message = err["msg"].removeprefix("Value error, ")
        issues.append(ContentIssue(file, entity_of(loc), _format_loc(loc) or None, message))
    return issues


def _read_json(path: Path, rel: str, issues: list[ContentIssue]) -> Any | None:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        issues.append(ContentIssue(rel, None, None, "required file is missing"))
    except json.JSONDecodeError as exc:
        issues.append(ContentIssue(rel, None, None, f"invalid JSON at line {exc.lineno}, column {exc.colno}: {exc.msg}"))
    except UnicodeDecodeError:
        issues.append(ContentIssue(rel, None, None, "file is not valid UTF-8"))
    return None


def _load_list(
    content_dir: Path, rel: str, model: type[BaseModel], issues: list[ContentIssue]
) -> list[Any]:
    raw = _read_json(content_dir / rel, rel, issues)
    if raw is None:
        return []
    if not isinstance(raw, list):
        issues.append(ContentIssue(rel, None, None, "top level must be a JSON array"))
        return []
    items = []
    for index, row in enumerate(raw):
        entity = row.get("id") if isinstance(row, dict) else None
        try:
            items.append(model.model_validate(row))
        except ValidationError as exc:
            issues.extend(_pydantic_issues(rel, exc, lambda _loc, e=entity: e))
    return items


def _load_single(
    content_dir: Path, rel: str, model: type[BaseModel], issues: list[ContentIssue], entity_key: str
) -> Any | None:
    raw = _read_json(content_dir / rel, rel, issues)
    if raw is None:
        return None
    entity = str(raw.get(entity_key)) if isinstance(raw, dict) and entity_key in raw else None
    try:
        return model.model_validate(raw)
    except ValidationError as exc:
        issues.extend(_pydantic_issues(rel, exc, lambda _loc: entity))
        return None


def load_content(content_dir: Path = DEFAULT_CONTENT_DIR) -> LoadResult:
    issues: list[ContentIssue] = []

    if not content_dir.is_dir():
        return LoadResult(None, [ContentIssue(str(content_dir), None, None, "content directory does not exist")])

    manifest: ContentManifest | None = _load_single(content_dir, MANIFEST_FILE, ContentManifest, issues, "")
    festivals: list[Festival] = _load_list(content_dir, FESTIVALS_FILE, Festival, issues)
    samagri: list[SamagriItem] = _load_list(content_dir, SAMAGRI_FILE, SamagriItem, issues)

    pujas: list[Puja] = []
    puja_dir = content_dir / "pujas"
    for path in sorted(puja_dir.glob("*.json")) if puja_dir.is_dir() else []:
        rel = f"pujas/{path.name}"
        puja = _load_single(content_dir, rel, Puja, issues, "id")
        if puja is not None:
            if puja.id != path.stem:
                issues.append(ContentIssue(rel, puja.id, "id", f"must match the file name {path.stem!r}"))
            pujas.append(puja)

    calendar: list[CalendarYear] = []
    cal_dir = content_dir / "calendar"
    for path in sorted(cal_dir.glob("*.json")) if cal_dir.is_dir() else []:
        rel = f"calendar/{path.name}"
        year = _load_single(content_dir, rel, CalendarYear, issues, "year")
        if year is not None:
            if str(year.year) != path.stem:
                issues.append(ContentIssue(rel, None, "year", f"{year.year} does not match the file name {path.stem!r}"))
            calendar.append(year)

    for path in sorted(content_dir.glob("*.json")):
        if path.name not in {MANIFEST_FILE, FESTIVALS_FILE, SAMAGRI_FILE}:
            issues.append(ContentIssue(path.name, None, None, "unknown file in content/ (not part of the content layout)"))

    if manifest is None:
        return LoadResult(None, issues)

    if manifest.schema_version != SCHEMA_VERSION:
        issues.append(ContentIssue(MANIFEST_FILE, None, "schemaVersion",
                                   f"{manifest.schema_version} is not supported (tooling supports {SCHEMA_VERSION})"))
    if "en" not in manifest.languages:
        issues.append(ContentIssue(MANIFEST_FILE, None, "languages", "must include 'en'"))
    if sorted(manifest.calendar_years) != sorted(c.year for c in calendar):
        issues.append(ContentIssue(MANIFEST_FILE, None, "calendarYears",
                                   f"{sorted(manifest.calendar_years)} does not match the calendar files found "
                                   f"{sorted(c.year for c in calendar)}"))

    # Build without re-running validators: every part is already validated.
    bundle = ContentBundle.model_construct(
        schema_version=manifest.schema_version,
        content_version=manifest.content_version,
        languages=manifest.languages,
        festivals=festivals,
        pujas=pujas,
        samagri=samagri,
        calendar=calendar,
    )
    if not issues:  # cross checks assume structurally valid entities
        issues.extend(cross_validate(bundle))
    return LoadResult(bundle if not issues else None, issues)
