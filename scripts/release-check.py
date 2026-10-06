#!/usr/bin/env python3
"""Release gate: run from the repo root. Exits 1 on the first failing check.

Checks, in order:
  1. Mobile tests pass (npm test) and backend tests pass (pytest).
  2. Content validates (scripts/validate_content.py).
  3. The exported bundle matches content/ (re-export, then git must show no change to content.json).
  4. No secret-like file is tracked by git.
  5. The built release APK's permissions match the allowed list plus the accepted, documented findings.
  6. versionCode in mobile/app.json is higher than the last released value in docs/RELEASE.md
     (equal is allowed only when docs/RELEASE.md says there is no previous release).

Usage: python scripts/release-check.py [--skip-tests] [--apk PATH]
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MOBILE = ROOT / "mobile"
ALLOWED_PERMISSIONS = {
    "android.permission.INTERNET",
    "android.permission.ACCESS_NETWORK_STATE",
    "android.permission.WAKE_LOCK",
    "android.permission.POST_NOTIFICATIONS",
    "android.permission.RECEIVE_BOOT_COMPLETED",
    "com.google.android.gms.permission.AD_ID",
    "android.permission.VIBRATE",
}
# Present in the release build on purpose; each one is listed in docs/RELEASE.md with its source.
ACCEPTED_PERMISSIONS = {
    "android.permission.ACCESS_ADSERVICES_AD_ID",
    "android.permission.ACCESS_ADSERVICES_ATTRIBUTION",
    "android.permission.ACCESS_ADSERVICES_TOPICS",
    "android.permission.FOREGROUND_SERVICE",
    "com.pujasaathi.india.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION",
}
SECRET_NAME = re.compile(r"\.(keystore|jks)$|(^|/)google-services\.json$", re.IGNORECASE)
RECORDED_VERSION = re.compile(r"^Last released versionCode:\s*(\S+)", re.MULTILINE)


def run(cmd: list[str], cwd: Path, label: str) -> None:
    print(f"== {label}", flush=True)
    result = subprocess.run(cmd, cwd=cwd, shell=sys.platform == "win32")
    if result.returncode != 0:
        fail(f"{label} failed (exit {result.returncode})")
    print(f"   ok: {label}", flush=True)


def fail(message: str) -> None:
    print(f"RELEASE CHECK FAILED: {message}", file=sys.stderr)
    sys.exit(1)


def check_tests() -> None:
    run(["npm", "test", "--silent"], MOBILE, "mobile tests (npm test)")
    run([sys.executable, "-m", "pytest", "-q"], ROOT / "backend", "backend tests (pytest)")


def check_content() -> None:
    run([sys.executable, "scripts/validate_content.py"], ROOT, "content validates")


def check_export_matches() -> None:
    run([sys.executable, "scripts/export_content.py"], ROOT, "export content.json from content/")
    status = subprocess.run(
        ["git", "status", "--porcelain", "--", "mobile/assets/puja_data/content.json"],
        cwd=ROOT, capture_output=True, text=True, check=True,
    ).stdout.strip()
    if status:
        fail("exported content.json differs from the committed one: commit the export or fix content/")
    print("   ok: exported content.json matches the committed bundle", flush=True)


def check_no_secrets() -> None:
    print("== no secret-like files tracked", flush=True)
    files = subprocess.run(["git", "ls-files", "-z"], cwd=ROOT, capture_output=True, text=True, check=True).stdout
    bad = [f for f in files.split("\0") if f and SECRET_NAME.search(f)]
    if bad:
        fail(f"tracked secret-like files: {bad}")
    print("   ok: none tracked", flush=True)


def check_apk_permissions(apk: Path) -> None:
    print(f"== release manifest permissions ({apk.name})", flush=True)
    if not apk.exists():
        fail(f"release APK not found: {apk} (build it with ./gradlew assembleRelease first)")
    aapt = Path(os.environ["ANDROID_HOME"]) / "build-tools" / "37.0.0" / "aapt.exe"
    if not aapt.exists():
        fail(f"aapt not found at {aapt}")
    out = subprocess.run([str(aapt), "dump", "permissions", str(apk)], capture_output=True, text=True, check=True).stdout
    found = set(re.findall(r"name='([^']+)'", out))
    unexpected = found - ALLOWED_PERMISSIONS - ACCEPTED_PERMISSIONS
    missing = ALLOWED_PERMISSIONS - found - {"com.google.android.gms.permission.AD_ID"}
    if unexpected:
        fail(f"permissions not on the allowed or accepted list: {sorted(unexpected)}")
    print(f"   ok: {len(found)} permissions; all allowed or accepted", flush=True)
    if missing:
        print(f"   note: allowed but not present: {sorted(missing)}", flush=True)


def check_version() -> None:
    print("== versionCode increments", flush=True)
    app = json.loads((MOBILE / "app.json").read_text(encoding="utf-8"))
    current = int(app["expo"]["android"]["versionCode"])
    recorded = RECORDED_VERSION.search((ROOT / "docs" / "RELEASE.md").read_text(encoding="utf-8"))
    if recorded is None:
        fail("docs/RELEASE.md has no line 'Last released versionCode: ...'")
    value = recorded.group(1)
    if value.lower() == "none":
        print(f"   ok: no previous release recorded; versionCode is {current}", flush=True)
        return
    last = int(value)
    if current <= last:
        fail(f"versionCode {current} must be higher than the last released {last}")
    print(f"   ok: versionCode {current} > last released {last}", flush=True)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--skip-tests", action="store_true", help="skip npm test and pytest (for a quick local run)")
    parser.add_argument("--apk", type=Path, default=MOBILE / "android/app/build/outputs/apk/release/app-release.apk")
    args = parser.parse_args()
    if not args.skip_tests:
        check_tests()
    check_content()
    check_export_matches()
    check_no_secrets()
    check_apk_permissions(args.apk)
    check_version()
    print("RELEASE CHECK PASSED", flush=True)


if __name__ == "__main__":
    main()
