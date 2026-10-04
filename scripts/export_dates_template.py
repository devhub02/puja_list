#!/usr/bin/env python3
"""Create or extend content/calendar/calendar_dates.csv: one row per festival per supported year.

The date, end_date and certainty columns are left EMPTY: dates are filled by a person from
verified sources, never by this tool. An existing CSV is never overwritten; only rows for festival/year
pairs that are not in it yet are appended.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from app.services.calendar_dates import SUPPORTED_YEARS, export_template  # noqa: E402
from app.services.content_loader import DEFAULT_CONTENT_DIR  # noqa: E402


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--content", type=Path, default=DEFAULT_CONTENT_DIR, help="content directory")
    parser.add_argument("--years", type=int, nargs="+", default=list(SUPPORTED_YEARS), help="years to cover")
    args = parser.parse_args(argv)

    result = export_template(args.content, tuple(args.years))
    verb = "Created" if result.created else "Updated"
    print(f"{verb} {result.path}\n  {result.total_rows} rows in total, {result.added_rows} added (existing rows untouched)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
