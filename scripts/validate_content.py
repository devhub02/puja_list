#!/usr/bin/env python3
"""Validate everything in content/. Exit code 1 on any problem."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from app.services.content_loader import DEFAULT_CONTENT_DIR, load_content  # noqa: E402


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--content", type=Path, default=DEFAULT_CONTENT_DIR, help="content directory")
    args = parser.parse_args(argv)

    result = load_content(args.content)
    if not result.ok or result.bundle is None:
        print(f"Content validation FAILED: {len(result.issues)} problem(s)\n", file=sys.stderr)
        for issue in result.issues:
            print(f"  {issue}", file=sys.stderr)
        return 1

    b = result.bundle
    print(
        f"Content OK: contentVersion {b.content_version}, {len(b.festivals)} festivals, "
        f"{len(b.pujas)} pujas, {len(b.samagri)} samagri, {len(b.calendar)} calendar year(s)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
