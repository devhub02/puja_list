"""One test per validation rule (docs/CONTENT_SCHEMA.md section 6). Fixtures are TEST FIXTURE only."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.schemas import ContentBundle
from app.services.content_loader import load_content

from conftest import make_valid_content, write_content_dir


def messages(result) -> str:
    return "\n".join(str(i) for i in result.issues)


def test_valid_fixture_passes(tmp_path):
    result = load_content(write_content_dir(tmp_path, make_valid_content()))
    assert result.ok, messages(result)
    assert result.bundle is not None
    assert len(result.bundle.pujas) == 2


def test_empty_collections_are_valid(tmp_path):
    content = make_valid_content()
    content.update(festivals=[], samagri=[], pujas={}, calendar={})
    content["manifest"]["calendarYears"] = []
    assert load_content(write_content_dir(tmp_path, content)).ok


def test_repo_content_directory_is_valid():
    result = load_content()
    assert result.ok, messages(result)


def test_same_samagri_may_have_different_classification_per_puja(load_mutated):
    assert load_mutated(lambda c: None).ok


def test_bundle_model_accepts_valid_and_runs_cross_checks():
    content = make_valid_content()
    bundle = ContentBundle.model_validate(
        {
            "schemaVersion": 1,
            "contentVersion": 3,
            "languages": ["en", "hi"],
            "festivals": content["festivals"],
            "samagri": content["samagri"],
            "pujas": list(content["pujas"].values()),
            "calendar": list(content["calendar"].values()),
        }
    )
    assert bundle.content_version == 3
    content["pujas"]["puja_test_one"]["steps"][1]["stepNumber"] = 5
    with pytest.raises(ValidationError, match="stepNumber"):
        ContentBundle.model_validate(
            {
                "contentVersion": 3,
                "festivals": content["festivals"],
                "samagri": content["samagri"],
                "pujas": list(content["pujas"].values()),
                "calendar": list(content["calendar"].values()),
            }
        )


# ---- Rule 1: locale maps -------------------------------------------------------------------


def test_locale_map_without_en_is_rejected(load_mutated):
    def m(c):
        c["pujas"]["puja_test_one"]["name"] = {"hi": "केवल हिंदी"}

    r = load_mutated(m)
    assert not r.ok
    assert "pujas/puja_test_one.json: puja_test_one: name: " in messages(r)
    assert "'en'" in messages(r)


def test_locale_map_with_empty_value_is_rejected(load_mutated):
    r = load_mutated(lambda c: c["samagri"][0].update(name={"en": "  "}))
    assert "is empty" in messages(r)
    assert "samagri.json: sm_test_a: name" in messages(r)


def test_language_not_in_manifest_is_rejected(load_mutated):
    r = load_mutated(lambda c: c["festivals"][0]["name"].update(ta="தமிழ்"))
    assert "language 'ta' is not in the manifest languages" in messages(r)


def test_alternate_names_language_checked_against_manifest(load_mutated):
    r = load_mutated(lambda c: c["festivals"][0]["alternateNames"].update(ta=["x"]))
    assert "language 'ta'" in messages(r)


def test_bad_language_code_is_rejected(load_mutated):
    r = load_mutated(lambda c: c["festivals"][0]["name"].update({"EN-us!": "x"}))
    assert "invalid language code" in messages(r)


# ---- Rule 2: ids ---------------------------------------------------------------------------


@pytest.mark.parametrize("bad", ["Puja_Caps", "has space", "double__underscore", "_lead", "trail_", ""])
def test_invalid_id_format_is_rejected(load_mutated, bad):
    r = load_mutated(lambda c: c["samagri"][0].update(id=bad))
    assert not r.ok
    assert "samagri.json" in messages(r)


def test_duplicate_festival_id(load_mutated):
    def m(c):
        c["festivals"].append(dict(c["festivals"][0]))

    assert "duplicate festival id" in messages(load_mutated(m))


def test_duplicate_samagri_id(load_mutated):
    r = load_mutated(lambda c: c["samagri"].append(dict(c["samagri"][0])))
    assert "duplicate samagri id" in messages(r)


def test_duplicate_step_id_across_pujas(load_mutated):
    def m(c):
        c["pujas"]["puja_test_two"]["steps"] = [
            {"id": "step_test_one_1", "stepNumber": 1, "title": {"en": "x"}, "description": {"en": "x"}}
        ]

    assert "duplicate step id" in messages(load_mutated(m))


def test_duplicate_variation_id_across_pujas(load_mutated):
    def m(c):
        c["pujas"]["puja_test_two"]["variations"] = [
            {"id": "var_test_one_1", "regions": ["north"], "title": {"en": "x"}, "description": {"en": "x"}}
        ]

    assert "duplicate variation id" in messages(load_mutated(m))


def test_duplicate_checklist_id_across_pujas(load_mutated):
    def m(c):
        c["pujas"]["puja_test_two"]["preparationChecklist"] = [
            {"id": "chk_test_one_1", "text": {"en": "x"}, "daysBefore": 0}
        ]

    assert "duplicate checklist item id" in messages(load_mutated(m))


def test_duplicate_calendar_entry_id(load_mutated):
    def m(c):
        entry = dict(c["calendar"]["2031"]["entries"][0], date="2031-06-01", endDate=None)
        c["calendar"]["2031"]["entries"].append(entry)

    assert "duplicate calendar entry id" in messages(load_mutated(m))


def test_puja_file_name_must_match_id(tmp_path):
    root = write_content_dir(tmp_path, make_valid_content())
    (root / "pujas" / "puja_test_two.json").rename(root / "pujas" / "puja_other.json")
    assert "must match the file name" in messages(load_content(root))


# ---- Rule 4: classification ----------------------------------------------------------------


@pytest.mark.parametrize("bad", ["MANDATORY", "required", ["REQUIRED", "OPTIONAL"], None])
def test_invalid_classification_is_rejected(load_mutated, bad):
    r = load_mutated(lambda c: c["pujas"]["puja_test_one"]["samagri"][0].update(classification=bad))
    assert not r.ok
    assert "samagri[0].classification" in messages(r)


def test_missing_classification_is_rejected(load_mutated):
    r = load_mutated(lambda c: c["pujas"]["puja_test_one"]["samagri"][0].pop("classification"))
    assert "samagri[0].classification: Field required" in messages(r)


# ---- Rule 5 / 6 / 8: samagri references ----------------------------------------------------


def test_samagri_id_must_exist_in_catalogue(load_mutated):
    r = load_mutated(lambda c: c["pujas"]["puja_test_one"]["samagri"][0].update(samagriId="sm_missing"))
    assert "samagri 'sm_missing' does not exist in samagri.json" in messages(r)


def test_vidhi_step_samagri_must_exist_in_catalogue(load_mutated):
    r = load_mutated(lambda c: c["pujas"]["puja_test_one"]["steps"][0].update(relatedSamagriIds=["sm_missing"]))
    assert "samagri 'sm_missing' is not in this puja's samagri list" in messages(r)


def test_vidhi_step_samagri_must_belong_to_same_puja(load_mutated):
    # sm_test_c exists in the catalogue but puja_test_one does not use it
    r = load_mutated(lambda c: c["pujas"]["puja_test_one"]["steps"][0].update(relatedSamagriIds=["sm_test_c"]))
    assert "steps[step_test_one_1].relatedSamagriIds" in messages(r)
    assert "not in this puja's samagri list" in messages(r)


def test_duplicate_samagri_within_puja(load_mutated):
    def m(c):
        u = c["pujas"]["puja_test_one"]["samagri"]
        u.append(dict(u[0], sortOrder=9))

    assert "listed more than once" in messages(load_mutated(m))


def test_duplicate_sort_order_within_puja(load_mutated):
    r = load_mutated(lambda c: c["pujas"]["puja_test_one"]["samagri"][1].update(sortOrder=1))
    assert "sortOrder 1 is used more than once" in messages(r)


# ---- Rule 7: step numbers ------------------------------------------------------------------


@pytest.mark.parametrize("numbers", [[2, 3], [1, 3], [1, 1], [0, 1]])
def test_step_numbers_must_be_contiguous_from_one(load_mutated, numbers):
    def m(c):
        for step, n in zip(c["pujas"]["puja_test_one"]["steps"], numbers):
            step["stepNumber"] = n

    assert not load_mutated(m).ok


def test_step_numbers_gap_message(load_mutated):
    r = load_mutated(lambda c: c["pujas"]["puja_test_one"]["steps"][1].update(stepNumber=3))
    assert "stepNumber values must be exactly 1..2" in messages(r)


def test_unordered_but_complete_step_numbers_are_valid(load_mutated):
    def m(c):
        c["pujas"]["puja_test_one"]["steps"].reverse()

    assert load_mutated(m).ok


# ---- Rule 9: review fields -----------------------------------------------------------------


def test_invalid_review_status(load_mutated):
    r = load_mutated(lambda c: c["pujas"]["puja_test_one"].update(reviewStatus="approved"))
    assert "reviewStatus" in messages(r)


def test_missing_review_status(load_mutated):
    r = load_mutated(lambda c: c["pujas"]["puja_test_one"].pop("reviewStatus"))
    assert "reviewStatus: Field required" in messages(r)


def test_source_note_required_with_en(load_mutated):
    r = load_mutated(lambda c: c["pujas"]["puja_test_one"].pop("sourceNote"))
    assert "sourceNote: Field required" in messages(r)
    r = load_mutated(lambda c: c["pujas"]["puja_test_one"].update(sourceNote={"hi": "x"}))
    assert "sourceNote" in messages(r) and "'en'" in messages(r)


# ---- Rule 10: enums ------------------------------------------------------------------------


def test_invalid_category(load_mutated):
    assert "category" in messages(load_mutated(lambda c: c["pujas"]["puja_test_one"].update(category="shopping")))


def test_invalid_region_and_empty_regions(load_mutated):
    assert "regions[0]" in messages(load_mutated(lambda c: c["festivals"][0].update(regions=["mars"])))
    assert "regions" in messages(load_mutated(lambda c: c["festivals"][0].update(regions=[])))


# ---- Rule 11: festival links ---------------------------------------------------------------


def test_puja_festival_must_exist(load_mutated):
    r = load_mutated(lambda c: c["pujas"]["puja_test_two"].update(festivalId="fest_missing"))
    assert "festival 'fest_missing' does not exist" in messages(r)


def test_festival_puja_ids_must_exist(load_mutated):
    r = load_mutated(lambda c: c["festivals"][0].update(pujaIds=["puja_test_one", "puja_missing"]))
    assert "puja 'puja_missing' does not exist" in messages(r)


def test_festival_and_puja_links_must_agree(load_mutated):
    r = load_mutated(lambda c: c["festivals"][0].update(pujaIds=[]))
    assert "does not list this puja in pujaIds" in messages(r)
    r = load_mutated(lambda c: c["festivals"][0].update(pujaIds=["puja_test_one", "puja_test_two"]))
    assert "does not point back to this festival" in messages(r)


def test_replaced_by_must_exist(load_mutated):
    r = load_mutated(lambda c: c["samagri"][0].update(status="deprecated", replacedBy="sm_missing"))
    assert "samagri 'sm_missing' does not exist" in messages(r)


# ---- Regional variations -------------------------------------------------------------------


def test_variation_must_reference_steps_and_samagri_of_its_puja(load_mutated):
    r = load_mutated(lambda c: c["pujas"]["puja_test_one"]["variations"][0].update(affectsStepIds=["step_nope"]))
    assert "variations[var_test_one_1].affectsStepIds" in messages(r)
    r = load_mutated(lambda c: c["pujas"]["puja_test_one"]["variations"][0].update(affectsSamagriIds=["sm_test_c"]))
    assert "variations[var_test_one_1].affectsSamagriIds" in messages(r)


def test_variations_live_inside_a_puja_so_they_always_have_one(tmp_path):
    # A variation cannot exist without a parent puja: it is only accepted embedded in a puja file.
    root = write_content_dir(tmp_path, make_valid_content())
    (root / "variations.json").write_text("[]", encoding="utf-8")
    assert "unknown file" in messages(load_content(root))


# ---- Rule 12: calendar ---------------------------------------------------------------------


def test_calendar_festival_must_exist(load_mutated):
    r = load_mutated(lambda c: c["calendar"]["2031"]["entries"][0].update(festivalId="fest_missing"))
    assert "festival 'fest_missing' does not exist" in messages(r)


def test_calendar_certainty_must_be_valid_and_present(load_mutated):
    assert "certainty" in messages(load_mutated(lambda c: c["calendar"]["2031"]["entries"][0].update(certainty="sure")))
    assert "certainty: Field required" in messages(
        load_mutated(lambda c: c["calendar"]["2031"]["entries"][0].pop("certainty"))
    )


@pytest.mark.parametrize("bad", ["2031-13-01", "2031-02-30", "04/05/2031", "2031-5-4"])
def test_calendar_date_must_be_real_iso_date(load_mutated, bad):
    r = load_mutated(lambda c: c["calendar"]["2031"]["entries"][0].update(date=bad, endDate=None))
    assert "date" in messages(r)


def test_calendar_date_must_be_in_file_year(load_mutated):
    r = load_mutated(lambda c: c["calendar"]["2031"]["entries"][0].update(date="2032-01-01", endDate=None))
    assert "is not in the file's year 2031" in messages(r)


def test_calendar_end_date_not_before_date(load_mutated):
    r = load_mutated(lambda c: c["calendar"]["2031"]["entries"][0].update(endDate="2031-05-01"))
    assert "is before date" in messages(r)


def test_calendar_one_entry_per_festival_per_date(load_mutated):
    def m(c):
        e = c["calendar"]["2031"]["entries"]
        e.append(dict(e[0], id="cal_test_2031_beta"))

    assert "already has an entry on 2031-05-04" in messages(load_mutated(m))


def test_calendar_file_name_must_match_year(tmp_path):
    root = write_content_dir(tmp_path, make_valid_content())
    (root / "calendar" / "2031.json").rename(root / "calendar" / "2032.json")
    assert "does not match the file name" in messages(load_content(root))


def test_manifest_calendar_years_must_match_files(load_mutated):
    r = load_mutated(lambda c: c["manifest"].update(calendarYears=[2031, 2040]))
    assert "calendarYears" in messages(r)


# ---- Rule 14 / 15 and file-level problems --------------------------------------------------


def test_puja_content_version_not_above_bundle(load_mutated):
    r = load_mutated(lambda c: c["pujas"]["puja_test_one"].update(contentVersion=4))
    assert "greater than the bundle contentVersion 3" in messages(r)


def test_unknown_fields_are_rejected(load_mutated):
    r = load_mutated(lambda c: c["pujas"]["puja_test_one"].update(summry={"en": "typo"}))
    assert "summry: Extra inputs are not permitted" in messages(r)
    r = load_mutated(lambda c: c["festivals"][0].update(date="2031-01-01"))  # rule 13: no dates in festivals
    assert "date: Extra inputs are not permitted" in messages(r)


def test_negative_days_before_and_zero_step_number(load_mutated):
    r = load_mutated(lambda c: c["pujas"]["puja_test_one"]["preparationChecklist"][0].update(daysBefore=-1))
    assert "daysBefore" in messages(r)
    r = load_mutated(lambda c: c["pujas"]["puja_test_one"]["steps"][0].update(stepNumber=0))
    assert "stepNumber" in messages(r)


def test_invalid_json_reports_file_and_position(tmp_path):
    root = write_content_dir(tmp_path, make_valid_content())
    (root / "festivals.json").write_text("[{", encoding="utf-8")
    r = load_content(root)
    assert "festivals.json: invalid JSON at line 1" in messages(r)


def test_missing_required_files_and_missing_directory(tmp_path):
    root = write_content_dir(tmp_path, make_valid_content())
    (root / "samagri.json").unlink()
    assert "samagri.json: required file is missing" in messages(load_content(root))
    assert "does not exist" in messages(load_content(tmp_path / "nope"))
    (root / "content_manifest.json").unlink()
    assert "content_manifest.json: required file is missing" in messages(load_content(root))


def test_unsupported_schema_version(load_mutated):
    r = load_mutated(lambda c: c["manifest"].update(schemaVersion=2))
    assert "schemaVersion" in messages(r)


def test_manifest_languages_must_include_en(load_mutated):
    r = load_mutated(lambda c: c["manifest"].update(languages=["hi"]))
    assert "must include 'en'" in messages(r)


def test_all_problems_are_reported_together(load_mutated):
    def m(c):
        c["pujas"]["puja_test_one"]["steps"][1]["stepNumber"] = 7
        c["pujas"]["puja_test_one"]["samagri"][0]["samagriId"] = "sm_missing"
        c["calendar"]["2031"]["entries"][0]["festivalId"] = "fest_missing"

    assert len(load_mutated(m).issues) >= 3


def test_issue_format_has_file_entity_and_field(load_mutated):
    r = load_mutated(lambda c: c["pujas"]["puja_test_one"]["samagri"][0].update(samagriId="sm_missing"))
    assert str(r.issues[0]).startswith("pujas/puja_test_one.json: puja_test_one: samagri[0].samagriId: ")
