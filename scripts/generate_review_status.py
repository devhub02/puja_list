#!/usr/bin/env python3
"""Write docs/CONTENT_REVIEW_STATUS.md from content/ (every puja, festival and dated entry, with counts).

Run from the repo root: python scripts/generate_review_status.py
Use --check to fail (exit 1) when the committed file is out of date (release-check uses this).
"""

from __future__ import annotations

import argparse
import collections
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT / "content"
OUT = ROOT / "docs" / "CONTENT_REVIEW_STATUS.md"


def name_of(item: dict) -> str:
    name = item.get("name")
    if isinstance(name, dict):
        return name.get("en") or next(iter(name.values()), item.get("id", ""))
    return str(name or item.get("id", ""))


def load_pujas() -> list[dict]:
    pujas: list[dict] = []
    for path in sorted((CONTENT / "pujas").glob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        for item in data if isinstance(data, list) else [data]:
            if isinstance(item, dict) and "reviewStatus" in item:
                pujas.append(item)
    return sorted(pujas, key=lambda p: p["id"])


def load_festivals() -> list[dict]:
    data = json.loads((CONTENT / "festivals.json").read_text(encoding="utf-8"))
    items = data if isinstance(data, list) else list(data.values())
    return sorted([i for i in items if isinstance(i, dict) and "id" in i], key=lambda f: f["id"])


def load_dates() -> list[dict]:
    dates: list[dict] = []
    for path in sorted((CONTENT / "calendar").glob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        entries = data.get("entries", data) if isinstance(data, dict) else data
        dates += [e for e in entries if isinstance(e, dict) and "date" in e]
    return sorted(dates, key=lambda e: e["date"])


def render() -> str:
    pujas, festivals, dates = load_pujas(), load_festivals(), load_dates()
    pc = collections.Counter(p["reviewStatus"] for p in pujas)
    fc = collections.Counter(f.get("reviewStatus", "unset") for f in festivals)
    lines = [
        "# Content review status",
        "",
        "Generated from `content/` by `scripts/generate_review_status.py`. Do not edit by hand.",
        "",
        "Review status meanings: `ai_drafted` = drafted with AI, not yet checked by a person; `cross_checked` = checked",
        "against sources; `expert_verified` = checked by a pandit or elder. The app labels every guide that is not",
        "`expert_verified`.",
        "",
        "## Counts",
        "",
        f"- Pujas (guides): {len(pujas)} "
        + ", ".join(f"{k}: {v}" for k, v in sorted(pc.items())),
        f"- Festivals: {len(festivals)} "
        + ", ".join(f"{k}: {v}" for k, v in sorted(fc.items())),
        f"- Dated festival entries: {len(dates)}"
        + (f", from {dates[0]['date']} to {dates[-1]['date']}" if dates else ""),
        "",
        "## Pujas",
        "",
        "| id | name | reviewStatus |",
        "|---|---|---|",
    ]
    lines += [f"| {p['id']} | {name_of(p)} | {p['reviewStatus']} |" for p in pujas]
    lines += ["", "## Festivals", "", "| id | name | reviewStatus |", "|---|---|---|"]
    lines += [f"| {f['id']} | {name_of(f)} | {f.get('reviewStatus', 'unset')} |" for f in festivals]
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--check", action="store_true", help="fail if the committed file is out of date")
    args = parser.parse_args()
    text = render()
    if args.check:
        current = OUT.read_text(encoding="utf-8") if OUT.exists() else ""
        if current != text:
            print("docs/CONTENT_REVIEW_STATUS.md is out of date: run scripts/generate_review_status.py", file=sys.stderr)
            return 1
        print("docs/CONTENT_REVIEW_STATUS.md is up to date")
        return 0
    OUT.write_text(text, encoding="utf-8", newline="\n")
    print(f"wrote {OUT.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
