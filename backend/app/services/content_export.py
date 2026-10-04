"""Exports a validated bundle to the single JSON file the mobile seed loader reads.

Metro cannot glob files at runtime, so the per-puja source files are merged into one
`content.json`. Export only copies and normalises validated content; it never writes any.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from app.schemas import ContentBundle, ContentIssue
from app.services.content_loader import DEFAULT_CONTENT_DIR, load_content

DEFAULT_OUT_DIR = Path(__file__).resolve().parents[3] / "mobile" / "assets" / "puja_data"
EXPORT_FILE = "content.json"


class ExportError(Exception):
    def __init__(self, issues: list[ContentIssue]):
        super().__init__("\n".join(str(i) for i in issues))
        self.issues = issues


@dataclass(frozen=True)
class ExportResult:
    path: Path
    content_version: int
    checksum: str
    counts: dict[str, int]


def canonical_json(data: Any) -> str:
    return json.dumps(data, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def build_payload(bundle: ContentBundle) -> dict[str, Any]:
    """Everything except the checksum, in a stable order."""
    data = bundle.model_dump(mode="json", by_alias=True, exclude_none=True)
    data["festivals"] = sorted(data["festivals"], key=lambda e: e["id"])
    data["pujas"] = sorted(data["pujas"], key=lambda e: e["id"])
    data["samagri"] = sorted(data["samagri"], key=lambda e: e["id"])
    data["calendar"] = sorted(data["calendar"], key=lambda e: e["year"])
    return data


def compute_checksum(payload: dict[str, Any]) -> str:
    return "sha256:" + hashlib.sha256(canonical_json(payload).encode("utf-8")).hexdigest()


def _stable_ids(payload: dict[str, Any]) -> dict[str, set[str]]:
    """Ids that user data may point at: they must never disappear between releases."""
    return {
        "festival": {f["id"] for f in payload.get("festivals", [])},
        "puja": {p["id"] for p in payload.get("pujas", [])},
        "samagri": {s["id"] for s in payload.get("samagri", [])},
        "checklist item": {
            c["id"] for p in payload.get("pujas", []) for c in p.get("preparationChecklist", [])
        },
    }


def check_against_previous(previous: dict[str, Any], payload: dict[str, Any]) -> list[ContentIssue]:
    """Release rules: ids are never removed (docs/CONTENT_SCHEMA.md rule 3); contentVersion only goes up."""
    issues: list[ContentIssue] = []
    file = EXPORT_FILE
    old_version, new_version = previous.get("contentVersion"), payload["contentVersion"]
    if isinstance(old_version, int):
        if new_version < old_version:
            issues.append(ContentIssue(file, None, "contentVersion",
                                       f"{new_version} is lower than the previously exported {old_version}"))
        elif new_version == old_version:
            old_payload = {k: v for k, v in previous.items() if k != "checksum"}
            if compute_checksum(old_payload) != compute_checksum(payload):
                issues.append(ContentIssue(file, None, "contentVersion",
                                           f"content changed but contentVersion is still {old_version}; bump it"))
    old_ids, new_ids = _stable_ids(previous), _stable_ids(payload)
    for kind, ids in old_ids.items():
        for missing in sorted(ids - new_ids[kind]):
            issues.append(ContentIssue(file, missing, "id",
                                       f"{kind} id existed in the previous export and was removed or renamed; "
                                       "keep it with status 'deprecated' instead"))
    return issues


def export_content(content_dir: Path = DEFAULT_CONTENT_DIR, out_dir: Path = DEFAULT_OUT_DIR) -> ExportResult:
    result = load_content(content_dir)
    if not result.ok or result.bundle is None:
        raise ExportError(result.issues)

    payload = build_payload(result.bundle)
    target = out_dir / EXPORT_FILE
    if target.exists():
        try:
            previous = json.loads(target.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            previous = None  # a broken previous export cannot constrain this one
        if isinstance(previous, dict):
            issues = check_against_previous(previous, payload)
            if issues:
                raise ExportError(issues)

    checksum = compute_checksum(payload)
    document = {"checksum": checksum, **payload}
    out_dir.mkdir(parents=True, exist_ok=True)
    tmp = target.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    tmp.replace(target)
    counts = {k: len(payload[k]) for k in ("festivals", "pujas", "samagri", "calendar")}
    return ExportResult(target, payload["contentVersion"], checksum, counts)
