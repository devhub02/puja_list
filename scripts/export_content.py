#!/usr/bin/env python3
"""Validate content/, then export it to mobile/assets/puja_data/content.json.

Refuses to export (exit code 1, nothing written) if validation or the release checks fail.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from app.services.content_export import DEFAULT_OUT_DIR, ExportError, export_content  # noqa: E402
from app.services.content_loader import DEFAULT_CONTENT_DIR  # noqa: E402


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--content", type=Path, default=DEFAULT_CONTENT_DIR, help="content directory")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT_DIR, help="output directory")
    args = parser.parse_args(argv)

    try:
        result = export_content(args.content, args.out)
    except ExportError as exc:
        print(f"Export REFUSED: {len(exc.issues)} problem(s)\n", file=sys.stderr)
        for issue in exc.issues:
            print(f"  {issue}", file=sys.stderr)
        return 1

    c = result.counts
    print(
        f"Exported {result.path}\n  contentVersion {result.content_version}, {c['festivals']} festivals, "
        f"{c['pujas']} pujas, {c['samagri']} samagri, {c['calendar']} calendar year(s)\n  {result.checksum}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
