#!/usr/bin/env python3
"""Import content/calendar/calendar_dates.csv into content/calendar/<year>.json.

Rows whose date is empty are ignored. Every filled row is validated; if any row is invalid nothing is
written and each problem is printed with its CSV line number. Dates are copied exactly as written:
this tool never invents, computes or adjusts a date.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from app.services.calendar_dates import import_dates  # noqa: E402
from app.services.content_loader import DEFAULT_CONTENT_DIR  # noqa: E402


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--content", type=Path, default=DEFAULT_CONTENT_DIR, help="content directory")
    args = parser.parse_args(argv)

    result = import_dates(args.content)
    if not result.ok:
        print(f"Calendar import FAILED: {len(result.issues)} problem(s), nothing was written\n", file=sys.stderr)
        for issue in result.issues:
            print(f"  {issue}", file=sys.stderr)
        return 1

    print(f"Calendar import OK: {result.dated_rows} date(s) imported, {result.ignored_rows} row(s) without a date ignored")
    for year in result.years_written:
        print(f"  wrote calendar/{year}.json")
    for year in result.files_removed:
        print(f"  removed calendar/{year}.json (no dated rows for {year} in the CSV any more)")
    if result.years_written or result.files_removed:
        print("Next: bump contentVersion in content/content_manifest.json, then run validate_content.py and export_content.py.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
