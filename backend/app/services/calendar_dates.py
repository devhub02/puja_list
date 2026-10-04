"""Calendar-date pipeline: CSV template and CSV -> content/calendar/<year>.json import.

Dates enter the project ONLY through content/calendar/calendar_dates.csv, filled by a human from verified
sources. Nothing in this module computes, guesses or adjusts a date: the template leaves date, certainty and
source_note empty, and the importer only copies rows that a person filled, after validating them.
"""

from __future__ import annotations

import csv
import io
import json
import re
from dataclasses import dataclass, field
from datetime import date as _date
from pathlib import Path
from typing import Any

from pydantic import ValidationError

from app.schemas import CalendarYear
from app.schemas.common import CALENDAR_ALL_REGIONS, DateCertainty, FestivalRegion
from app.services.content_loader import DEFAULT_CONTENT_DIR

SUPPORTED_YEARS: tuple[int, ...] = (2026, 2027)
CSV_RELATIVE = Path("calendar") / "calendar_dates.csv"
CSV_COLUMNS = (
    "festival_id",
    "festival_name_en",
    "year",
    "date",
    "end_date",
    "region",
    "certainty",
    "source_note",
)
VALID_REGIONS = (CALENDAR_ALL_REGIONS, *(r.value for r in FestivalRegion))
VALID_CERTAINTY = tuple(c.value for c in DateCertainty)
_ISO = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def csv_path(content_dir: Path = DEFAULT_CONTENT_DIR) -> Path:
    return content_dir / CSV_RELATIVE


# ------------------------------------------------------------------------------------- template


def _festival_names(content_dir: Path) -> dict[str, str]:
    raw = json.loads((content_dir / "festivals.json").read_text(encoding="utf-8"))
    return {f["id"]: f["name"]["en"] for f in raw}


def _read_rows(path: Path) -> list[dict[str, str]]:
    """All rows of an existing CSV, with every cell as the person left it (nothing is normalised)."""
    with path.open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        return [{col: (row.get(col) or "") for col in CSV_COLUMNS} for row in reader]


def _render(rows: list[dict[str, str]]) -> str:
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=CSV_COLUMNS, lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    return buffer.getvalue()


@dataclass(frozen=True)
class TemplateResult:
    path: Path
    total_rows: int
    added_rows: int
    created: bool


def export_template(
    content_dir: Path = DEFAULT_CONTENT_DIR,
    years: tuple[int, ...] = SUPPORTED_YEARS,
) -> TemplateResult:
    """Create the CSV, or merge into it: rows for new festival/year pairs are appended, and rows that already
    exist (filled or not) are kept exactly as they are. Nothing is ever removed or overwritten."""
    names = _festival_names(content_dir)
    path = csv_path(content_dir)
    existing = _read_rows(path) if path.exists() else []
    have = {(row["festival_id"].strip(), row["year"].strip()) for row in existing}

    added: list[dict[str, str]] = []
    for festival_id in sorted(names):
        for year in years:
            if (festival_id, str(year)) in have:
                continue
            added.append({
                "festival_id": festival_id,
                "festival_name_en": names[festival_id],
                "year": str(year),
                "date": "",
                "end_date": "",
                "region": CALENDAR_ALL_REGIONS,
                "certainty": "",
                "source_note": "",
            })
    rows = existing + added
    path.parent.mkdir(parents=True, exist_ok=True)
    if added or not path.exists():
        path.write_text(_render(rows), encoding="utf-8")
    return TemplateResult(path, len(rows), len(added), created=not existing)


# ------------------------------------------------------------------------------------- import


@dataclass(frozen=True)
class RowIssue:
    line: int
    message: str

    def __str__(self) -> str:
        return f"{CSV_RELATIVE.name}: line {self.line}: {self.message}"


@dataclass
class ImportResult:
    issues: list[RowIssue] = field(default_factory=list)
    dated_rows: int = 0
    ignored_rows: int = 0
    years_written: list[int] = field(default_factory=list)
    files_removed: list[int] = field(default_factory=list)

    @property
    def ok(self) -> bool:
        return not self.issues


def _parse_iso(value: str) -> _date | None:
    if not _ISO.match(value):
        return None
    try:
        return _date.fromisoformat(value)
    except ValueError:
        return None


def _entry_id(year: int, festival_id: str, region: str) -> str:
    base = festival_id.removeprefix("fest_")
    suffix = "" if region == CALENDAR_ALL_REGIONS else f"_{region}"
    return f"cal_{year}_{base}{suffix}"


def _read_numbered(path: Path) -> tuple[list[tuple[int, dict[str, str]]], list[RowIssue]]:
    issues: list[RowIssue] = []
    try:
        text = path.read_text(encoding="utf-8-sig")
    except FileNotFoundError:
        return [], [RowIssue(1, f"{path} does not exist; run scripts/export_dates_template.py first")]
    except UnicodeDecodeError:
        return [], [RowIssue(1, "file is not valid UTF-8 (in Excel, save as 'CSV UTF-8')")]
    reader = csv.reader(io.StringIO(text, newline=""))
    try:
        header = [h.strip() for h in next(reader)]
    except StopIteration:
        return [], [RowIssue(1, "file is empty (it needs the header row)")]
    missing = [c for c in CSV_COLUMNS if c not in header]
    if missing:
        return [], [RowIssue(1, f"missing column(s): {', '.join(missing)}")]
    rows: list[tuple[int, dict[str, str]]] = []
    for cells in reader:
        line = reader.line_num
        if not any(c.strip() for c in cells):
            continue  # blank line
        if len(cells) > len(header):
            issues.append(RowIssue(line, "row has more cells than the header (a comma inside a cell must be quoted)"))
            continue
        padded = cells + [""] * (len(header) - len(cells))
        row = {name: padded[i].strip() for i, name in enumerate(header)}
        rows.append((line, row))
    return rows, issues


def import_dates(content_dir: Path = DEFAULT_CONTENT_DIR) -> ImportResult:
    """Validate every filled row, then (only if all are valid) write content/calendar/<year>.json.

    Rows whose `date` is empty are ignored. A year that appears in the CSV is regenerated from the CSV; a
    year file that is not in the CSV at all is left alone. Manifest `calendarYears` is kept in sync.
    """
    result = ImportResult()
    rows, issues = _read_numbered(csv_path(content_dir))
    result.issues.extend(issues)
    if issues and not rows:
        return result

    festival_ids = set(_festival_names(content_dir))
    seen_years: set[int] = set()
    filled: list[tuple[int, dict[str, str]]] = []
    first_line: dict[tuple[str, int, str], int] = {}

    for line, row in rows:
        year_text = row["year"]
        if year_text.isdigit():
            seen_years.add(int(year_text))
        if not row["date"]:
            result.ignored_rows += 1
            continue

        problems: list[str] = []
        festival_id, region = row["festival_id"], row["region"] or CALENDAR_ALL_REGIONS
        if festival_id not in festival_ids:
            problems.append(f"festival_id {festival_id!r} does not exist in festivals.json")

        the_date = _parse_iso(row["date"])
        if the_date is None:
            problems.append(f"date {row['date']!r} is not a real calendar date in YYYY-MM-DD format")
        year: int | None = int(year_text) if year_text.isdigit() else None
        if year is None:
            problems.append(f"year {year_text!r} is not a number")
        elif the_date is not None and the_date.year != year:
            problems.append(f"year column is {year} but date {row['date']} is in {the_date.year}")

        if row["end_date"]:
            end = _parse_iso(row["end_date"])
            if end is None:
                problems.append(f"end_date {row['end_date']!r} is not a real calendar date in YYYY-MM-DD format")
            else:
                if the_date is not None and end < the_date:
                    problems.append(f"end_date {row['end_date']} is before date {row['date']}")
                if year is not None and end.year != year:
                    problems.append(f"end_date {row['end_date']} is not in {year} (a date range must stay in one year)")

        if region not in VALID_REGIONS:
            problems.append(f"region {region!r} is not one of {', '.join(VALID_REGIONS)}")
        if not row["certainty"]:
            problems.append(f"certainty is required when a date is given (one of {', '.join(VALID_CERTAINTY)})")
        elif row["certainty"] not in VALID_CERTAINTY:
            problems.append(f"certainty {row['certainty']!r} is not one of {', '.join(VALID_CERTAINTY)}")
        if not row["source_note"]:
            problems.append("source_note is required when a date is given (name where you verified the date)")

        if year is not None:
            key = (festival_id, year, region)
            if key in first_line:
                problems.append(
                    f"duplicate festival/year/region: {festival_id} {year} {region!r} already filled on line {first_line[key]}"
                )
            else:
                first_line[key] = line

        result.issues.extend(RowIssue(line, p) for p in problems)
        if not problems:
            filled.append((line, row))

    if result.issues:
        return result  # all-or-nothing: nothing is written when any row is invalid

    result.dated_rows = len(filled)
    by_year: dict[int, list[dict[str, Any]]] = {}
    for _line, row in filled:
        year = int(row["year"])
        region = row["region"] or CALENDAR_ALL_REGIONS
        entry: dict[str, Any] = {
            "id": _entry_id(year, row["festival_id"], region),
            "festivalId": row["festival_id"],
            "date": row["date"],
            "region": region,
            "certainty": row["certainty"],
            "source": row["source_note"],
        }
        if row["end_date"]:
            entry["endDate"] = row["end_date"]
        by_year.setdefault(year, []).append(entry)

    cal_dir = content_dir / "calendar"
    documents: dict[int, str] = {}
    for year, entries in sorted(by_year.items()):
        entries.sort(key=lambda e: (e["date"], e["festivalId"], e["region"]))
        try:
            model = CalendarYear.model_validate({"year": year, "entries": entries})
        except ValidationError as exc:  # should be unreachable after the checks above
            for err in exc.errors():
                result.issues.append(RowIssue(1, f"{year}: {err['msg']}"))
            return result
        data = model.model_dump(mode="json", by_alias=True, exclude_none=True)
        documents[year] = json.dumps(data, ensure_ascii=False, indent=2) + "\n"

    cal_dir.mkdir(parents=True, exist_ok=True)
    for year, text in documents.items():
        target = cal_dir / f"{year}.json"
        if not target.exists() or target.read_text(encoding="utf-8") != text:
            target.write_text(text, encoding="utf-8")
        result.years_written.append(year)
    for year in sorted(seen_years - set(documents)):
        stale = cal_dir / f"{year}.json"
        if stale.exists():
            stale.unlink()
            result.files_removed.append(year)

    _sync_manifest_years(content_dir)
    return result


def _sync_manifest_years(content_dir: Path) -> None:
    """Keep the manifest's calendarYears equal to the calendar files present (validation rule 16)."""
    cal_dir = content_dir / "calendar"
    years = sorted(int(p.stem) for p in cal_dir.glob("*.json") if p.stem.isdigit()) if cal_dir.is_dir() else []
    manifest = content_dir / "content_manifest.json"
    text = manifest.read_text(encoding="utf-8")
    new_line = f'"calendarYears": [{", ".join(str(y) for y in years)}]'
    updated, count = re.subn(r'"calendarYears":\s*\[[^\]]*\]', new_line, text)
    if count != 1:
        raise ValueError("content_manifest.json has no single calendarYears field to update")
    if updated != text:
        manifest.write_text(updated, encoding="utf-8")
