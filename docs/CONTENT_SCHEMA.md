# Content Schema (bundled JSON)

Status: design for Phase 0. Source of truth lives in `content/`; Pydantic (backend) enforces it; the validated export is bundled in `mobile/assets/puja_data/`.

## 1. Conventions

### 1.1 Locale maps
Every user-visible string is a **locale map**: an object whose keys are BCP-47-style language codes and whose values are strings.

```json
{ "en": "Water for achaman", "hi": "आचमन के लिए जल" }
```

- `en` is **mandatory** in every locale map. Other languages are optional.
- Fallback order at display time: selected language -> `en`.
- Adding a language (for example `ta`, `bn`) means adding new keys to the maps and a language entry in the app's language list. It must need **no code changes** to the content model.
- Locale-map fields are written below as `LocaleMap`. Optional ones are `LocaleMap?`.

### 1.2 Stable ids
- Every entity has an `id`: a lowercase ASCII string matching `^[a-z0-9]+(_[a-z0-9]+)*$` (snake_case), for example `ganesh_chaturthi`, `sm_modak`.
- Ids are referenced by user data (saved pujas, checklist progress, custom samagri, reminders, history). **An id is never renamed and never reused**, even after the entity is removed. To retire an entity, set `"status": "deprecated"` (optionally with `replacedBy`) instead of deleting it.
- Recommended prefixes (conventions, not enforced beyond uniqueness): festivals `fest_`, pujas `puja_`, samagri `sm_`, vidhi steps `step_`, variations `var_`.
- Ids are unique **per entity type** across the whole content set.

### 1.3 Shared enums

| Enum | Values |
|------|--------|
| `Classification` (samagri) | `REQUIRED`, `COMMON`, `OPTIONAL` |
| `ReviewStatus` | `ai_drafted`, `cross_checked`, `expert_verified` |
| `DateCertainty` | `confirmed`, `provisional`, `varies_by_region` |
| `EntityStatus` | `active`, `deprecated` |
| `Region` | `north`, `east`, `south`, `west`, `central`, `north_east`, `tribal_regional`, `pan_india` |
| `PujaCategory` | `festival`, `vrat`, `household`, `life_cycle`, `regional`, `tribal` |

`Region` and `PujaCategory` are closed lists in the validator; extending them is a small, reviewed schema change.

### 1.4 Meaning of classification
- `REQUIRED`: the puja is generally not performed without it according to the cited tradition.
- `COMMON`: widely used, but families/regions differ.
- `OPTIONAL`: customary extras. **Never auto-promoted** to a higher class by any code path.

Each puja owns its own samagri list; the same item id may be classified differently in different pujas (see §3.3).

## 2. Files

```
content/
  content_manifest.json     # contentVersion, language list, file list
  festivals.json            # Festival[]
  pujas/<puja_id>.json      # one Puja per file (embeds samagri usage, steps, variations)
  samagri.json              # SamagriItem[]  (shared catalogue: name, description)
  calendar/<year>.json      # CalendarYear (year-specific dates, kept separate)
```

Exported bundle (`mobile/assets/puja_data/`) mirrors this layout after validation.

### 2.1 Manifest

```json
{
  "contentVersion": 1,
  "schemaVersion": 1,
  "languages": ["en", "hi"],
  "calendarYears": [2026]
}
```

- `contentVersion` (integer, increases on every content release) drives re-seeding in the app.
- `schemaVersion` is bumped only when the JSON structure itself changes.

## 3. Entities

### 3.1 Festival

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | stable id |
| `name` | LocaleMap | |
| `alternateNames` | LocaleMap-like list: `{ "en": ["..."], "hi": ["..."] }` (optional) | alternate spellings, used for search |
| `description` | LocaleMap | short, own words |
| `significance` | LocaleMap | own words |
| `regions` | Region[] | at least one |
| `pujaIds` | string[] | pujas performed for this festival |
| `status` | EntityStatus | default `active` |

Festival metadata contains **no year-specific dates**. Dates live only in the calendar files (§3.6).

### 3.2 Puja (one file per puja)

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | stable id |
| `festivalId` | string? | optional link to a festival |
| `name` | LocaleMap | |
| `alternateNames` | `{lang: string[]}` (optional) | alternate spellings for search |
| `category` | PujaCategory | |
| `regions` | Region[] | at least one |
| `summary` | LocaleMap | |
| `significance` | LocaleMap | own words |
| `samagri` | SamagriUsage[] | see §3.3 |
| `steps` | VidhiStep[] | see §3.4 |
| `variations` | RegionalVariation[] | see §3.5 |
| `preparationChecklist` | ChecklistItem[] (optional) | `{ id, text: LocaleMap, daysBefore: int>=0 }` |
| `disclaimer` | LocaleMap (optional) | defaults to the standard disclaimer (§5) |
| `reviewStatus` | ReviewStatus | required; UI labels anything not `expert_verified` |
| `sourceNote` | LocaleMap | where/how the content was prepared and checked; required |
| `contentVersion` | integer | the `contentVersion` in which this puja was last changed |
| `status` | EntityStatus | default `active` |

### 3.3 Samagri (shared catalogue + per-puja usage)

Catalogue entry (`samagri.json`), puja-independent:

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | stable id |
| `name` | LocaleMap | |
| `alternateNames` | `{lang: string[]}` (optional) | search spellings |
| `description` | LocaleMap (optional) | what the item is |
| `status` | EntityStatus | |

Per-puja usage (`SamagriUsage`, inside a puja file), puja-specific:

| Field | Type | Notes |
|-------|------|-------|
| `samagriId` | string | must exist in the catalogue |
| `classification` | `REQUIRED` \| `COMMON` \| `OPTIONAL` | exactly one value |
| `purpose` | LocaleMap | why it is used in this puja |
| `quantityGuidance` | LocaleMap (optional) | **never invented**; unknown -> omit or "as needed" |
| `preparationNote` | LocaleMap (optional) | |
| `regionalNote` | LocaleMap (optional) | regional/family difference stated as a difference |
| `sortOrder` | integer | ordering within the puja's list |

### 3.4 Vidhi step

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | stable id (unique across all pujas) |
| `stepNumber` | integer >= 1 | consecutive within the puja, starting at 1 |
| `title` | LocaleMap | |
| `description` | LocaleMap | own words |
| `relatedSamagriIds` | string[] | each must appear in this puja's `samagri` |
| `isOptional` | boolean | |
| `importantNote` | LocaleMap (optional) | |

Mantras/verses are **not** part of Phase 0. If added later they must be a separate, sourced field; text is never invented.

### 3.5 Regional variation

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | stable id |
| `regions` | Region[] | where this practice is common |
| `title` | LocaleMap | |
| `description` | LocaleMap | presented as "in some regions/families", never as the universal rule |
| `affectsStepIds` | string[] (optional) | steps in this puja |
| `affectsSamagriIds` | string[] (optional) | samagri in this puja |

### 3.6 Calendar dates (separate file per year)

`content/calendar/<year>.json`:

```json
{
  "year": 2026,
  "entries": [
    {
      "id": "cal_2026_example",
      "festivalId": "fest_example",
      "date": "2026-01-01",
      "endDate": null,
      "certainty": "provisional",
      "regionNote": { "en": "Date can differ by region/panchang." },
      "source": "verified panchang reference name"
    }
  ]
}
```

| Field | Type | Notes |
|-------|------|-------|
| `id` | string | stable id |
| `festivalId` | string | must exist in festivals |
| `date` | `YYYY-MM-DD` | the date as bundled and verified; **never computed in code** |
| `endDate` | `YYYY-MM-DD` or null | for multi-day observances |
| `certainty` | DateCertainty | required |
| `regionNote` | LocaleMap (optional) | |
| `source` | string | where the date was verified |

If a festival has no entry for a year, the app shows "date not available". The app and tooling never derive tithi/lunar dates.

## 4. Example (schema example only, not authoritative content)

> **Schema example only, not authoritative content.** The names, steps and values below are placeholders to show the shape. They are not real puja guidance and must not be shipped.

```json
{
  "id": "puja_example",
  "festivalId": null,
  "name": { "en": "Example Puja", "hi": "उदाहरण पूजा" },
  "category": "household",
  "regions": ["pan_india"],
  "summary": { "en": "Placeholder summary." },
  "significance": { "en": "Placeholder significance." },
  "samagri": [
    {
      "samagriId": "sm_example_item",
      "classification": "OPTIONAL",
      "purpose": { "en": "Placeholder purpose." },
      "sortOrder": 1
    }
  ],
  "steps": [
    {
      "id": "step_example_1",
      "stepNumber": 1,
      "title": { "en": "Placeholder step" },
      "description": { "en": "Placeholder description." },
      "relatedSamagriIds": ["sm_example_item"],
      "isOptional": true
    }
  ],
  "variations": [],
  "reviewStatus": "ai_drafted",
  "sourceNote": { "en": "Schema example only." },
  "contentVersion": 1,
  "status": "active"
}
```

## 5. Standard disclaimer

Shown on every puja unless overridden. Hindi text (from project rules):

> Vidhi aur samagri region, family tradition, sampradaya aur puja ke tareeke ke hisaab se alag ho sakti hai. Apni family tradition ke anusaar changes karein.

It is stored as a locale map (`en` + `hi`) in the app's string resources, not duplicated in each puja.

## 6. Validation rules (enforced by Pydantic in `scripts/` / `backend/`)

1. **Locale maps**: every `LocaleMap` is an object with at least the key `en`, and every value is a non-empty string. Keys must be in the manifest `languages` list.
2. **Unique ids**: ids are unique within their entity type across all files (festival, puja, samagri, step, variation, checklist item, calendar entry). Id format matches `^[a-z0-9]+(_[a-z0-9]+)*$`.
3. **Id stability**: a release must not remove or rename an id present in the previous release. Removed entities must remain with `status: deprecated`. (Checked against the previous exported snapshot.)
4. **Classification**: each `SamagriUsage.classification` is exactly one of `REQUIRED | COMMON | OPTIONAL`. No other value, no list, no missing value.
5. **Samagri references**: every `samagriId` in a puja exists in the catalogue; every `relatedSamagriIds` entry in a step exists in **that puja's** `samagri` list; every `affectsSamagriIds` / `affectsStepIds` in a variation exists in that puja.
6. **No duplicate samagri** within one puja (`samagriId` appears at most once).
7. **Step numbering**: `stepNumber` values in a puja are exactly 1..N with no gaps or duplicates.
8. **Sort order**: `sortOrder` is an integer, unique within a puja's samagri list.
9. **Review fields**: `reviewStatus` is one of the three enum values; `sourceNote` is present with an `en` entry.
10. **Regions/category**: values come from the closed enums; `regions` is non-empty.
11. **Festival references**: `festivalId` on a puja and `pujaIds` on a festival point to existing entities and agree with each other.
12. **Calendar**: `festivalId` exists; `date` (and `endDate`) is a valid ISO date within the file's `year`; `endDate >= date`; `certainty` present; at most one entry per festival per `date`.
13. **No year-specific dates outside calendar files** (festival/puja files contain none).
14. **Content version**: `contentVersion` on each puja is an integer `<=` the manifest `contentVersion`.
15. **Unknown fields are rejected** (strict models) so typos do not silently pass.

Rules about *meaning* (not invented mantras, no copied text, quantities not guessed) cannot be machine-checked; they are enforced by review via `reviewStatus` and `sourceNote`.
