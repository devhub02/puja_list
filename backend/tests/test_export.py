"""Export behaviour. Uses TEST FIXTURE content in tmp dirs only (never content/ or the mobile bundle)."""

from __future__ import annotations

import copy
import json
import subprocess
import sys
from pathlib import Path

import pytest

from app.services.content_export import ExportError, compute_checksum, export_content

from conftest import make_valid_content, write_content_dir

REPO = Path(__file__).resolve().parents[2]


def exported(path: Path) -> dict:
    return json.loads((path / "content.json").read_text(encoding="utf-8"))


def test_export_writes_bundle_with_versions_and_checksum(tmp_path):
    src = write_content_dir(tmp_path / "src", make_valid_content())
    result = export_content(src, tmp_path / "out")
    data = exported(tmp_path / "out")
    assert data["schemaVersion"] == 2
    assert data["contentVersion"] == 3
    assert data["languages"] == ["en", "hi"]
    assert data["checksum"] == result.checksum
    assert [p["id"] for p in data["pujas"]] == ["puja_test_one", "puja_test_two"]
    assert data["pujas"][0]["samagri"][0]["classification"] == "REQUIRED"
    assert data["calendar"][0]["year"] == 2031
    assert result.counts == {"festivals": 2, "pujas": 2, "samagri": 3, "calendar": 1}


def test_checksum_matches_payload_and_hindi_is_not_escaped(tmp_path):
    src = write_content_dir(tmp_path / "src", make_valid_content())
    export_content(src, tmp_path / "out")
    raw = (tmp_path / "out" / "content.json").read_text(encoding="utf-8")
    assert "परीक्षण पूजा एक" in raw
    data = json.loads(raw)
    checksum = data.pop("checksum")
    assert compute_checksum(data) == checksum


def test_export_is_deterministic(tmp_path):
    src = write_content_dir(tmp_path / "src", make_valid_content())
    export_content(src, tmp_path / "a")
    export_content(src, tmp_path / "b")
    assert (tmp_path / "a" / "content.json").read_bytes() == (tmp_path / "b" / "content.json").read_bytes()


def test_export_omits_null_optionals(tmp_path):
    src = write_content_dir(tmp_path / "src", make_valid_content())
    export_content(src, tmp_path / "out")
    puja_two = exported(tmp_path / "out")["pujas"][1]
    assert "festivalId" not in puja_two and "disclaimer" not in puja_two


def test_export_refuses_invalid_content_and_writes_nothing(tmp_path):
    content = make_valid_content()
    content["pujas"]["puja_test_one"]["steps"][1]["stepNumber"] = 9
    src = write_content_dir(tmp_path / "src", content)
    with pytest.raises(ExportError) as err:
        export_content(src, tmp_path / "out")
    assert "stepNumber" in str(err.value)
    assert not (tmp_path / "out").exists()


def test_invalid_content_does_not_overwrite_previous_export(tmp_path):
    src = write_content_dir(tmp_path / "src", make_valid_content())
    export_content(src, tmp_path / "out")
    before = (tmp_path / "out" / "content.json").read_bytes()
    bad = make_valid_content()
    bad["manifest"]["contentVersion"] = 4
    bad["samagri"][0]["name"] = {}
    with pytest.raises(ExportError):
        export_content(write_content_dir(tmp_path / "bad", bad), tmp_path / "out")
    assert (tmp_path / "out" / "content.json").read_bytes() == before


def test_reexport_of_unchanged_content_is_allowed(tmp_path):
    src = write_content_dir(tmp_path / "src", make_valid_content())
    first = export_content(src, tmp_path / "out")
    assert export_content(src, tmp_path / "out").checksum == first.checksum


def test_content_change_requires_version_bump(tmp_path):
    export_content(write_content_dir(tmp_path / "v1", make_valid_content()), tmp_path / "out")
    changed = make_valid_content()
    changed["samagri"][2]["name"] = {"en": "Renamed display text"}
    with pytest.raises(ExportError, match="bump it"):
        export_content(write_content_dir(tmp_path / "v2", changed), tmp_path / "out")
    changed["manifest"]["contentVersion"] = 4
    export_content(write_content_dir(tmp_path / "v3", changed), tmp_path / "out")
    assert exported(tmp_path / "out")["contentVersion"] == 4


def test_content_version_cannot_go_down(tmp_path):
    export_content(write_content_dir(tmp_path / "v1", make_valid_content()), tmp_path / "out")
    lower = make_valid_content()
    lower["manifest"]["contentVersion"] = 2
    lower["pujas"]["puja_test_two"]["contentVersion"] = 2
    with pytest.raises(ExportError, match="lower than the previously exported 3"):
        export_content(write_content_dir(tmp_path / "v0", lower), tmp_path / "out")


@pytest.mark.parametrize(
    "removal",
    ["samagri", "puja", "festival", "checklist"],
)
def test_removing_an_id_between_releases_is_refused(tmp_path, removal):
    export_content(write_content_dir(tmp_path / "v1", make_valid_content()), tmp_path / "out")
    nxt = copy.deepcopy(make_valid_content())
    nxt["manifest"]["contentVersion"] = 4
    if removal == "samagri":
        nxt["samagri"] = [s for s in nxt["samagri"] if s["id"] != "sm_test_c"]
    elif removal == "puja":
        del nxt["pujas"]["puja_test_two"]
    elif removal == "festival":
        nxt["festivals"] = []
        nxt["calendar"] = {}
        nxt["manifest"]["calendarYears"] = []
        nxt["pujas"]["puja_test_one"]["festivalId"] = None
    else:
        nxt["pujas"]["puja_test_one"]["preparationChecklist"] = []
    with pytest.raises(ExportError, match="removed or renamed"):
        export_content(write_content_dir(tmp_path / "v2", nxt), tmp_path / "out")


def test_deprecating_instead_of_removing_is_allowed(tmp_path):
    export_content(write_content_dir(tmp_path / "v1", make_valid_content()), tmp_path / "out")
    nxt = make_valid_content()
    nxt["manifest"]["contentVersion"] = 4
    nxt["samagri"][2]["status"] = "deprecated"
    export_content(write_content_dir(tmp_path / "v2", nxt), tmp_path / "out")


def test_broken_previous_export_does_not_block(tmp_path):
    (tmp_path / "out").mkdir()
    (tmp_path / "out" / "content.json").write_text("{not json", encoding="utf-8")
    export_content(write_content_dir(tmp_path / "src", make_valid_content()), tmp_path / "out")
    assert exported(tmp_path / "out")["contentVersion"] == 3


def _run(script: str, *args: str) -> subprocess.CompletedProcess:
    return subprocess.run(
        [sys.executable, str(REPO / "scripts" / script), *args], capture_output=True, text=True, cwd=REPO
    )


def test_validate_script_exit_codes(tmp_path):
    ok = _run("validate_content.py", "--content", str(write_content_dir(tmp_path / "ok", make_valid_content())))
    assert ok.returncode == 0 and "Content OK" in ok.stdout
    bad_content = make_valid_content()
    bad_content["pujas"]["puja_test_one"]["steps"][1]["stepNumber"] = 9
    bad = _run("validate_content.py", "--content", str(write_content_dir(tmp_path / "bad", bad_content)))
    assert bad.returncode == 1
    assert "pujas/puja_test_one.json: puja_test_one: steps" in bad.stderr


def test_export_script_exit_codes(tmp_path):
    src = write_content_dir(tmp_path / "src", make_valid_content())
    ok = _run("export_content.py", "--content", str(src), "--out", str(tmp_path / "out"))
    assert ok.returncode == 0 and (tmp_path / "out" / "content.json").exists()
    bad_content = make_valid_content()
    bad_content["samagri"].append(dict(bad_content["samagri"][0]))
    bad = _run("export_content.py", "--content", str(write_content_dir(tmp_path / "bad", bad_content)),
               "--out", str(tmp_path / "out2"))
    assert bad.returncode == 1 and "Export REFUSED" in bad.stderr
    assert not (tmp_path / "out2").exists()


def test_committed_mobile_bundle_is_in_sync_with_content():
    """The checked-in bundle must equal a fresh export of content/ (run scripts/export_content.py)."""
    from app.services.content_export import DEFAULT_OUT_DIR, build_payload
    from app.services.content_loader import load_content

    result = load_content()
    assert result.bundle is not None
    committed = json.loads((DEFAULT_OUT_DIR / "content.json").read_text(encoding="utf-8"))
    expected = build_payload(result.bundle)
    assert committed.pop("checksum") == compute_checksum(expected)
    assert committed == expected
