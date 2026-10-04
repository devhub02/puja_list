"""Top-level content bundle: everything the app ships, validated as one unit."""

from __future__ import annotations

from typing import Annotated

from pydantic import Field, model_validator

from .common import SCHEMA_VERSION, ContentModel
from .crosscheck import cross_validate
from .entities import CalendarYear, Festival, Puja, SamagriItem


class ContentBundle(ContentModel):
    schema_version: Annotated[int, Field(ge=1)] = SCHEMA_VERSION
    content_version: Annotated[int, Field(ge=1)]
    languages: Annotated[list[str], Field(min_length=1)] = ["en", "hi"]
    festivals: list[Festival] = []
    pujas: list[Puja] = []
    samagri: list[SamagriItem] = []
    calendar: list[CalendarYear] = []

    @model_validator(mode="after")
    def _cross_checks(self) -> ContentBundle:
        if "en" not in self.languages:
            raise ValueError("languages must include 'en'")
        if self.schema_version != SCHEMA_VERSION:
            raise ValueError(
                f"unsupported schemaVersion {self.schema_version} (this tooling supports {SCHEMA_VERSION})"
            )
        issues = cross_validate(self)
        if issues:
            raise ValueError("\n" + "\n".join(f"  - {issue}" for issue in issues))
        return self
