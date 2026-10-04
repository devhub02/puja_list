"""Shared fixtures.

TEST FIXTURE, not real content: every name, step and date below is a made-up placeholder that exists
only to exercise the validator. It is built in memory / in tmp dirs and never written to content/ or
to the mobile bundle.
"""

from __future__ import annotations

import copy
import json
from pathlib import Path
from typing import Any, Callable

import pytest

from app.services.content_loader import LoadResult, load_content


def make_valid_content() -> dict[str, Any]:
    """TEST FIXTURE, not real content."""
    return {
        "manifest": {
            "contentVersion": 3,
            "schemaVersion": 1,
            "languages": ["en", "hi"],
            "calendarYears": [2031],
        },
        "festivals": [
            {
                "id": "fest_test_alpha",
                "name": {"en": "Test Festival Alpha", "hi": "परीक्षण पर्व अल्फ़ा"},
                "alternateNames": {"en": ["Test Fest Alfa"]},
                "description": {"en": "TEST FIXTURE, not real content."},
                "significance": {"en": "TEST FIXTURE, not real content."},
                "regions": ["pan_india"],
                "pujaIds": ["puja_test_one"],
            }
        ],
        "samagri": [
            {"id": "sm_test_a", "name": {"en": "Test Item A", "hi": "परीक्षण वस्तु क"}},
            {"id": "sm_test_b", "name": {"en": "Test Item B"}},
            {"id": "sm_test_c", "name": {"en": "Test Item C"}},
        ],
        "pujas": {
            "puja_test_one": {
                "id": "puja_test_one",
                "festivalId": "fest_test_alpha",
                "name": {"en": "Test Puja One", "hi": "परीक्षण पूजा एक"},
                "alternateNames": {"en": ["Test Pooja One"], "hi": ["परीक्षण पुजा एक"]},
                "category": "festival",
                "regions": ["north", "south"],
                "summary": {"en": "TEST FIXTURE, not real content."},
                "significance": {"en": "TEST FIXTURE, not real content."},
                "samagri": [
                    {"samagriId": "sm_test_a", "classification": "REQUIRED",
                     "purpose": {"en": "fixture"}, "sortOrder": 1},
                    {"samagriId": "sm_test_b", "classification": "OPTIONAL",
                     "purpose": {"en": "fixture"}, "sortOrder": 2},
                ],
                "steps": [
                    {"id": "step_test_one_1", "stepNumber": 1, "title": {"en": "Fixture step 1"},
                     "description": {"en": "fixture"}, "relatedSamagriIds": ["sm_test_a"]},
                    {"id": "step_test_one_2", "stepNumber": 2, "title": {"en": "Fixture step 2"},
                     "description": {"en": "fixture"}, "relatedSamagriIds": [], "isOptional": True},
                ],
                "variations": [
                    {"id": "var_test_one_1", "regions": ["south"], "title": {"en": "Fixture variation"},
                     "description": {"en": "fixture"}, "affectsStepIds": ["step_test_one_2"],
                     "affectsSamagriIds": ["sm_test_b"]},
                ],
                "preparationChecklist": [
                    {"id": "chk_test_one_1", "text": {"en": "fixture"}, "daysBefore": 1},
                ],
                "reviewStatus": "ai_drafted",
                "sourceNote": {"en": "TEST FIXTURE, not real content."},
                "contentVersion": 2,
            },
            "puja_test_two": {
                "id": "puja_test_two",
                "name": {"en": "Test Puja Two"},
                "category": "household",
                "regions": ["pan_india"],
                "summary": {"en": "TEST FIXTURE, not real content."},
                "significance": {"en": "TEST FIXTURE, not real content."},
                "samagri": [
                    # same catalogue item, different classification: allowed per puja
                    {"samagriId": "sm_test_a", "classification": "COMMON",
                     "purpose": {"en": "fixture"}, "sortOrder": 1},
                ],
                "steps": [],
                "variations": [],
                "reviewStatus": "cross_checked",
                "sourceNote": {"en": "TEST FIXTURE, not real content."},
                "contentVersion": 3,
            },
        },
        "calendar": {
            "2031": {
                "year": 2031,
                "entries": [
                    {"id": "cal_test_2031_alpha", "festivalId": "fest_test_alpha", "date": "2031-05-04",
                     "endDate": "2031-05-05", "certainty": "provisional",
                     "regionNote": {"en": "fixture"}, "source": "TEST FIXTURE"},
                ],
            }
        },
    }


def write_content_dir(root: Path, content: dict[str, Any]) -> Path:
    root.mkdir(parents=True, exist_ok=True)
    (root / "content_manifest.json").write_text(json.dumps(content["manifest"]), encoding="utf-8")
    (root / "festivals.json").write_text(json.dumps(content["festivals"], ensure_ascii=False), encoding="utf-8")
    (root / "samagri.json").write_text(json.dumps(content["samagri"], ensure_ascii=False), encoding="utf-8")
    if content["pujas"]:
        (root / "pujas").mkdir(exist_ok=True)
    for pid, puja in content["pujas"].items():
        (root / "pujas" / f"{pid}.json").write_text(json.dumps(puja, ensure_ascii=False), encoding="utf-8")
    if content["calendar"]:
        (root / "calendar").mkdir(exist_ok=True)
    for year, cal in content["calendar"].items():
        (root / "calendar" / f"{year}.json").write_text(json.dumps(cal, ensure_ascii=False), encoding="utf-8")
    return root


@pytest.fixture
def valid_content() -> dict[str, Any]:
    return make_valid_content()


Mutator = Callable[[dict[str, Any]], None]


@pytest.fixture
def load_mutated(tmp_path: Path) -> Callable[[Mutator], LoadResult]:
    """Apply a mutation to a fresh valid fixture, write it to a tmp dir, load it."""
    counter = {"n": 0}

    def _load(mutate: Mutator) -> LoadResult:
        content = copy.deepcopy(make_valid_content())
        mutate(content)
        counter["n"] += 1
        return load_content(write_content_dir(tmp_path / f"c{counter['n']}", content))

    return _load
