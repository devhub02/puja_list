"""Calendar-date pipeline tests (template merge, CSV import, export).

TEST FIXTURE, not real dates: every date, source and certainty below is made up to exercise the code. The
fixtures live in tmp dirs and are never written to content/ or the mobile bundle.
"""

from __future__ import annotations

import csv
import json
import subprocess
import sys
from pathlib import Path

import pytest

from app.services.calendar_dates import (
    CSV_COLUMNS,
    SUPPORTED_YEARS,
    csv_path,
    export_template,
    import_dates,
)
from app.services.content_export import export_content
from app.services.content_loader import load_content

from conftest import make_valid_content, write_content_dir

REPO = Path(__file__).resolve().parents[2]
FIXTURE_SOURCE = "TEST FIXTURE, not a real source"


def content_dir(tmp_path: Path) -> Path:
    """Valid TEST FIXTURE content without any calendar year, so the pipeline starts from nothing."""
    content = make_valid_content()
    content["calendar"] = {}
    content["manifest"]["calendarYears"] = []
    return write_content_dir(tmp_path / "content", content)


def row(**kw: str) -> dict[str, str]:
    base = {
        "festival_id": "fest_test_alpha",
        "festival_name_en": "Test Festival Alpha",
        "year": "2031",
        "date": "",
        "end_date": "",
        "region": "all",
        "certainty": "",
        "source_note": "",
    }
    base.update(kw)
    return base


def write_csv(root: Path, rows: list[dict[str, str]]) -> Path:
    path = csv_path(root)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_COLUMNS, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
    return path


def filled(**kw: str) -> dict[str, str]:
    base = {"date": "2031-05-04", "certainty": "provisional", "source_note": FIXTURE_SOURCE}
    base.update(kw)
    return row(**base)


def errors(root: Path) -> str:
    result = import_dates(root)
    assert not result.ok
    return "\n".join(str(i) for i in result.issues)


# ---------------------------------------------------------------- template


def test_template_has_one_empty_row_per_festival_per_supported_year(tmp_path):
    root = content_dir(tmp_path)
    result = export_template(root)
    assert result.created and result.total_rows == 2 * len(SUPPORTED_YEARS) == result.added_rows
    with csv_path(root).open(encoding="utf-8", newline="") as handle:
        reader = csv.DictReader(handle)
        assert tuple(reader.fieldnames or ()) == CSV_COLUMNS
        rows = list(reader)
    assert {(r["festival_id"], r["year"]) for r in rows} == {
        (f, str(y)) for f in ("fest_test_alpha", "fest_test_beta") for y in SUPPORTED_YEARS
    }
    for r in rows:  # nothing is ever filled by the tool
        assert r["date"] == r["end_date"] == r["certainty"] == r["source_note"] == ""
        assert r["region"] == "all"
    assert {r["festival_name_en"] for r in rows} == {"Test Festival Alpha", "Test Festival Beta"}


def test_template_merge_never_overwrites_filled_rows_and_adds_new_festivals_only(tmp_path):
    root = content_dir(tmp_path)
    export_template(root)
    rows = list(csv.DictReader(csv_path(root).open(encoding="utf-8", newline="")))
    for r in rows:
        if (r["festival_id"], r["year"]) == ("fest_test_alpha", "2026"):
            r.update(date="2026-03-03", end_date="2026-03-04", certainty="confirmed", source_note=FIXTURE_SOURCE,
                     festival_name_en="Hand edited name, keep me")
    write_csv(root, rows)
    before = csv_path(root).read_text(encoding="utf-8")

    # no new festival: nothing changes at all
    again = export_template(root)
    assert again.added_rows == 0 and not again.created
    assert csv_path(root).read_text(encoding="utf-8") == before

    # a new festival appears in festivals.json: only its rows are added
    festivals = json.loads((root / "festivals.json").read_text(encoding="utf-8"))
    festivals.append(dict(festivals[1], id="fest_test_gamma", name={"en": "Test Gamma", "hi": "परीक्षण गामा"}))
    (root / "festivals.json").write_text(json.dumps(festivals, ensure_ascii=False), encoding="utf-8")
    merged = export_template(root)
    assert merged.added_rows == len(SUPPORTED_YEARS)
    after = csv_path(root).read_text(encoding="utf-8")
    assert after.startswith(before)  # old rows are byte-for-byte what the person left
    assert "2026-03-03,2026-03-04,all,confirmed" in after
    assert "Hand edited name, keep me" in after
    assert after.count("fest_test_gamma") == len(SUPPORTED_YEARS)


def test_template_merge_keeps_a_regional_row_without_adding_an_all_row(tmp_path):
    root = content_dir(tmp_path)
    write_csv(root, [filled(region="south", year="2026", date="2026-04-01")])
    export_template(root)
    rows = list(csv.DictReader(csv_path(root).open(encoding="utf-8", newline="")))
    alpha_2026 = [r for r in rows if r["festival_id"] == "fest_test_alpha" and r["year"] == "2026"]
    assert [r["region"] for r in alpha_2026] == ["south"]


def test_template_reads_a_file_saved_by_excel_with_bom_and_crlf(tmp_path):
    root = content_dir(tmp_path)
    csv_path(root).parent.mkdir(parents=True, exist_ok=True)
    text = ",".join(CSV_COLUMNS) + "\r\n" + ",".join(
        ["fest_test_alpha", "Test Festival Alpha", "2026", "2026-03-03", "", "all", "confirmed", FIXTURE_SOURCE]) + "\r\n"
    csv_path(root).write_bytes(b"\xef\xbb\xbf" + text.encode("utf-8"))
    export_template(root)
    assert import_dates(root).ok


# ---------------------------------------------------------------- import: success


def test_empty_csv_still_succeeds_with_zero_dates(tmp_path):
    root = content_dir(tmp_path)
    export_template(root)
    result = import_dates(root)
    assert result.ok and result.dated_rows == 0 and result.ignored_rows == 2 * len(SUPPORTED_YEARS)
    assert not (root / "calendar" / "2026.json").exists()
    assert load_content(root).ok


def test_valid_import_writes_the_calendar_format_and_stays_valid(tmp_path):
    root = content_dir(tmp_path)
    write_csv(root, [
        row(date="2031-05-04", end_date="2031-05-05", certainty="confirmed", source_note=FIXTURE_SOURCE),
        row(region="south", date="2031-05-06", certainty="varies_by_region", source_note=FIXTURE_SOURCE),
        row(festival_id="fest_test_beta", festival_name_en="Test Festival Beta", date="2031-01-20",
            certainty="provisional", source_note=FIXTURE_SOURCE),
        row(festival_id="fest_test_beta", festival_name_en="Test Festival Beta", year="2032"),  # no date: ignored
    ])
    result = import_dates(root)
    assert result.ok and result.dated_rows == 3 and result.ignored_rows == 1 and result.years_written == [2031]
    data = json.loads((root / "calendar" / "2031.json").read_text(encoding="utf-8"))
    assert data == {
        "year": 2031,
        "entries": [
            {"id": "cal_2031_test_beta", "festivalId": "fest_test_beta", "date": "2031-01-20", "region": "all",
             "certainty": "provisional", "source": FIXTURE_SOURCE},
            {"id": "cal_2031_test_alpha", "festivalId": "fest_test_alpha", "date": "2031-05-04",
             "endDate": "2031-05-05", "region": "all", "certainty": "confirmed", "source": FIXTURE_SOURCE},
            {"id": "cal_2031_test_alpha_south", "festivalId": "fest_test_alpha", "date": "2031-05-06",
             "region": "south", "certainty": "varies_by_region", "source": FIXTURE_SOURCE},
        ],
    }
    assert not (root / "calendar" / "2032.json").exists()
    manifest = json.loads((root / "content_manifest.json").read_text(encoding="utf-8"))
    assert manifest["calendarYears"] == [2031]
    assert load_content(root).ok


def test_import_is_idempotent_and_copies_dates_verbatim(tmp_path):
    root = content_dir(tmp_path)
    write_csv(root, [filled(date="2031-12-31")])
    import_dates(root)
    first = (root / "calendar" / "2031.json").read_bytes()
    import_dates(root)
    assert (root / "calendar" / "2031.json").read_bytes() == first
    assert json.loads(first)["entries"][0]["date"] == "2031-12-31"


def test_year_without_dates_removes_its_generated_file_but_other_years_stay(tmp_path):
    root = content_dir(tmp_path)
    write_csv(root, [filled(), row(year="2032", date="2032-02-02", certainty="provisional", source_note=FIXTURE_SOURCE)])
    import_dates(root)
    assert (root / "calendar" / "2031.json").exists() and (root / "calendar" / "2032.json").exists()
    write_csv(root, [row(), row(year="2032", date="2032-02-02", certainty="provisional", source_note=FIXTURE_SOURCE)])
    result = import_dates(root)
    assert result.files_removed == [2031]
    assert not (root / "calendar" / "2031.json").exists() and (root / "calendar" / "2032.json").exists()
    assert json.loads((root / "content_manifest.json").read_text(encoding="utf-8"))["calendarYears"] == [2032]


def test_export_includes_the_imported_calendar_years(tmp_path):
    root = content_dir(tmp_path)
    write_csv(root, [filled()])
    import_dates(root)
    result = export_content(root, tmp_path / "out")
    bundle = json.loads((tmp_path / "out" / "content.json").read_text(encoding="utf-8"))
    assert result.counts["calendar"] == 1
    assert bundle["calendar"][0]["year"] == 2031
    assert bundle["calendar"][0]["entries"][0]["date"] == "2031-05-04"


def test_export_with_an_empty_csv_has_no_calendar(tmp_path):
    root = content_dir(tmp_path)
    export_template(root)
    import_dates(root)
    export_content(root, tmp_path / "out")
    assert json.loads((tmp_path / "out" / "content.json").read_text(encoding="utf-8"))["calendar"] == []


# ---------------------------------------------------------------- import: every validation failure


def check_fails(tmp_path, rows, expected, line=2):
    root = content_dir(tmp_path)
    write_csv(root, rows)
    message = errors(root)
    assert expected in message
    assert f"line {line}:" in message
    assert not (root / "calendar" / "2031.json").exists()  # all-or-nothing


def test_unknown_festival_id(tmp_path):
    check_fails(tmp_path, [filled(festival_id="fest_nope")], "festival_id 'fest_nope' does not exist")


@pytest.mark.parametrize("bad", ["2031-02-30", "2031-13-01", "31-05-2031", "2031/05/04", "May 4", "2031-5-4"])
def test_invalid_date(tmp_path, bad):
    check_fails(tmp_path, [filled(date=bad)], "is not a real calendar date")


def test_year_column_must_match_date(tmp_path):
    check_fails(tmp_path, [filled(year="2032")], "year column is 2032 but date 2031-05-04 is in 2031")


def test_year_must_be_a_number(tmp_path):
    check_fails(tmp_path, [filled(year="next")], "year 'next' is not a number")


def test_end_date_before_date(tmp_path):
    check_fails(tmp_path, [filled(end_date="2031-05-01")], "end_date 2031-05-01 is before date 2031-05-04")


def test_end_date_must_be_a_real_date(tmp_path):
    check_fails(tmp_path, [filled(end_date="2031-06-31")], "end_date '2031-06-31' is not a real calendar date")


def test_end_date_must_stay_in_the_year(tmp_path):
    check_fails(tmp_path, [filled(date="2031-12-31", end_date="2032-01-02")], "is not in 2031")


def test_invalid_region(tmp_path):
    check_fails(tmp_path, [filled(region="mars")], "region 'mars' is not one of all, pan_india")


def test_blank_region_means_all(tmp_path):
    root = content_dir(tmp_path)
    write_csv(root, [filled(region="")])
    assert import_dates(root).ok
    assert json.loads((root / "calendar" / "2031.json").read_text(encoding="utf-8"))["entries"][0]["region"] == "all"


def test_certainty_required_when_date_present(tmp_path):
    check_fails(tmp_path, [filled(certainty="")], "certainty is required when a date is given")


def test_certainty_must_be_an_enum_value(tmp_path):
    check_fails(tmp_path, [filled(certainty="sure")], "certainty 'sure' is not one of confirmed, provisional, varies_by_region")


def test_source_note_required_when_date_present(tmp_path):
    check_fails(tmp_path, [filled(source_note="")], "source_note is required when a date is given")


def test_duplicate_festival_year_region(tmp_path):
    check_fails(tmp_path, [filled(), filled(date="2031-06-01")],
                "duplicate festival/year/region: fest_test_alpha 2031 'all' already filled on line 2", line=3)


def test_same_festival_year_with_different_regions_is_not_a_duplicate(tmp_path):
    root = content_dir(tmp_path)
    write_csv(root, [filled(), filled(region="north", date="2031-06-01")])
    assert import_dates(root).ok


def test_all_problems_are_reported_with_their_line_numbers(tmp_path):
    root = content_dir(tmp_path)
    write_csv(root, [filled(festival_id="fest_nope"), row(), filled(certainty="")])
    message = errors(root)
    assert "line 2:" in message and "line 4:" in message and "line 3:" not in message


def test_filling_only_certainty_without_a_date_is_ignored(tmp_path):
    root = content_dir(tmp_path)
    write_csv(root, [row(certainty="confirmed", source_note="half filled")])
    result = import_dates(root)
    assert result.ok and result.dated_rows == 0 and result.ignored_rows == 1


def test_missing_csv_and_missing_columns_are_reported(tmp_path):
    root = content_dir(tmp_path)
    assert "does not exist" in errors(root)
    csv_path(root).parent.mkdir(parents=True, exist_ok=True)
    csv_path(root).write_text("festival_id,date\nfest_test_alpha,2031-05-04\n", encoding="utf-8")
    message = errors(root)
    assert "line 1:" in message and "missing column(s)" in message and "certainty" in message


def test_a_stray_comma_is_reported(tmp_path):
    root = content_dir(tmp_path)
    export_template(root)
    with csv_path(root).open("a", encoding="utf-8") as handle:
        handle.write(f"fest_test_alpha,Name,2031,2031-05-04,,all,confirmed,{FIXTURE_SOURCE},extra\n")
    assert "more cells than the header" in errors(root)


# ---------------------------------------------------------------- scripts


def _run(script: str, *args: str) -> subprocess.CompletedProcess:
    return subprocess.run([sys.executable, str(REPO / "scripts" / script), *args],
                          capture_output=True, text=True, cwd=REPO)


def test_scripts_end_to_end_on_fixture_content(tmp_path):
    root = content_dir(tmp_path)
    template = _run("export_dates_template.py", "--content", str(root))
    assert template.returncode == 0 and "Created" in template.stdout
    empty = _run("import_calendar_dates.py", "--content", str(root))
    assert empty.returncode == 0 and "0 date(s) imported" in empty.stdout

    rows = list(csv.DictReader(csv_path(root).open(encoding="utf-8", newline="")))
    rows[0].update(date=f"{rows[0]['year']}-02-02", certainty="provisional", source_note=FIXTURE_SOURCE)
    write_csv(root, rows)
    ok = _run("import_calendar_dates.py", "--content", str(root))
    assert ok.returncode == 0 and "1 date(s) imported" in ok.stdout and "bump contentVersion" in ok.stdout

    rows[0]["certainty"] = "sure"
    write_csv(root, rows)
    bad = _run("import_calendar_dates.py", "--content", str(root))
    assert bad.returncode == 1 and "line 2:" in bad.stderr and "nothing was written" in bad.stderr


def test_real_content_calendar_csv_is_in_step_with_the_catalogue():
    """The committed CSV has a row for every festival and supported year (dates themselves are the owner's)."""
    real = load_content()
    assert real.bundle is not None
    rows = list(csv.DictReader(csv_path(Path(REPO / "content")).open(encoding="utf-8-sig", newline="")))
    have = {(r["festival_id"], r["year"]) for r in rows}
    want = {(f.id, str(y)) for f in real.bundle.festivals for y in SUPPORTED_YEARS}
    assert want <= have
