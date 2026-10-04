# Phone Database Schema (design only)

Status: design for Phase 0. No code yet. Target: `expo-sqlite` with Drizzle ORM (FTS5 for search). The database lives on the phone only.

## 1. Principles

1. **Content tables and user-data tables are separate.** Content tables are rebuilt from the bundled JSON. User-data tables are never touched by seeding.
2. **User data references content by stable string id, with no foreign keys to content tables and no cascading deletes.** If a content row is removed or replaced during re-seeding, user rows stay intact. The app resolves ids at read time and handles "content no longer exists" gracefully (see §6).
3. All user-visible content text is stored as locale-map JSON (text columns holding `{"en": "...", "hi": "..."}`). Language selection and the fallback to `en` happen in app code, so adding a language needs no schema change.
4. Primary keys of content tables are the stable ids from `CONTENT_SCHEMA.md`.
5. Timestamps are integer epoch milliseconds (UTC).

## 2. Content tables (replaced on re-seed)

| Table | Columns (all `TEXT` unless noted) |
|-------|-----------------------------------|
| `festival` | `id` PK, `name_json`, `alt_names_json`, `description_json`, `significance_json`, `regions_json`, `status` |
| `puja` | `id` PK, `festival_id` (nullable), `name_json`, `alt_names_json`, `category`, `regions_json`, `summary_json`, `significance_json`, `review_status`, `source_note_json`, `disclaimer_json`, `content_version` INTEGER, `status` |
| `samagri` | `id` PK, `name_json`, `alt_names_json`, `description_json`, `status` |
| `puja_samagri` | `puja_id`, `samagri_id`, `classification` (`REQUIRED`/`COMMON`/`OPTIONAL`), `purpose_json`, `quantity_guidance_json`, `preparation_note_json`, `regional_note_json`, `sort_order` INTEGER; PK (`puja_id`, `samagri_id`) |
| `vidhi_step` | `id` PK, `puja_id`, `step_number` INTEGER, `title_json`, `description_json`, `related_samagri_ids_json`, `is_optional` INTEGER (0/1), `important_note_json` |
| `regional_variation` | `id` PK, `puja_id`, `regions_json`, `title_json`, `description_json`, `affects_step_ids_json`, `affects_samagri_ids_json` |
| `calendar_date` | `id` PK, `festival_id`, `year` INTEGER, `date` (ISO), `end_date` (ISO, nullable), `certainty`, `region_note_json`, `source` |
| `content_meta` | `key` PK, `value` — holds `content_version`, `schema_version`, `seeded_at` |

Content tables may use real foreign keys **among themselves** (for example `vidhi_step.puja_id -> puja.id`) because they are always rebuilt together in one transaction. `puja_samagri` and `checklist` template rows (if the puja has `preparationChecklist`) follow the same rule. A `checklist_template` table (`id` PK, `puja_id`, `text_json`, `days_before`) is included in the content set for the preparation checklist.

## 3. User-data tables (never touched by seeding)

None of these has a foreign key to a content table.

| Table | Columns | Notes |
|-------|---------|-------|
| `saved_puja` | `puja_id` PK, `saved_at` INTEGER | bookmark |
| `checklist_progress` | `puja_id`, `item_ref` (samagri id, checklist-template id, or custom-samagri id), `item_kind` (`samagri`/`template`/`custom`), `checked` INTEGER, `updated_at` INTEGER; PK (`puja_id`, `item_kind`, `item_ref`) | progress per puja |
| `custom_samagri` | `id` PK (generated uuid, prefix `usr_`), `puja_id`, `name`, `note` (nullable), `created_at` INTEGER | free-text user items; plain text, not locale maps |
| `reminder` | `id` PK (generated), `puja_id` (nullable), `festival_id` (nullable), `title`, `fire_at` INTEGER, `notification_id` (nullable, from expo-notifications), `created_at` INTEGER | local notifications, inexact |
| `recent_view` | `puja_id` PK, `viewed_at` INTEGER | upserted on view; trimmed to the latest N |
| `recent_search` | `query` PK, `searched_at` INTEGER | trimmed to the latest N |
| `app_setting` | `key` PK, `value` | only if settings are not kept in MMKV/AsyncStorage |

Rules:
- `puja_id`, `festival_id`, `item_ref` are plain strings holding stable content ids.
- Deleting or replacing a content row never deletes rows here.
- The `usr_` prefix keeps user-generated ids from ever colliding with content ids.

## 4. Indexes

Content:
- `puja(festival_id)`, `puja(category)`, `puja(status)`
- `puja_samagri(puja_id, sort_order)`, `puja_samagri(samagri_id)`
- `vidhi_step(puja_id, step_number)` UNIQUE
- `regional_variation(puja_id)`
- `calendar_date(festival_id, year)`, `calendar_date(year, date)`
- `checklist_template(puja_id)`

User data:
- `saved_puja(saved_at)`
- `checklist_progress(puja_id)`
- `custom_samagri(puja_id)`
- `reminder(fire_at)`, `reminder(puja_id)`
- `recent_view(viewed_at)`, `recent_search(searched_at)`

## 5. Search (FTS5, Hindi + English)

One FTS5 virtual table, `search_index`, rebuilt as part of seeding (it is derived content, so it is a content table).

Columns: `entity_type` (UNINDEXED: `puja`/`festival`/`samagri`), `entity_id` (UNINDEXED), `names`, `alt_names`, `extra`.

What goes in each row:
- **puja / festival rows**: `names` = every language of `name` in one string; `alt_names` = all alternate spellings (for example transliterations such as "Ganesh/Ganesha/गणेश"); `extra` = samagri names for pujas so a search for a samagri finds pujas that use it.
- **samagri rows**: `names` and `alt_names` of the item.

Tokenizer: `unicode61` with `remove_diacritics 2`. This handles Devanagari word boundaries and folds Latin accents. Prefix queries (`term*`) support type-ahead.

Hindi/English specifics:
- Alternate **Roman spellings of Hindi words** (Latin transliteration) are stored in `alt_names`, because users often type Hindi in Latin letters. These come from content (`alternateNames`), not from code-based transliteration.
- Devanagari combining marks (matras) are kept as-is by `unicode61`; the content authoring rule is to include common spelling variants in `alternateNames` rather than depend on fuzzy matching.
- Ranking: `bm25` with column weights favouring `names` over `alt_names` over `extra`.

Fallback: if FTS5 is not available in the bundled SQLite build, fall back to `LIKE` over `name_json`/`alt_names_json`. This must be checked on a real device in the phase that adds the database; until then it is an assumption, not a verified fact.

Recent searches are stored in `recent_search`; the FTS index holds no user data.

## 6. Seeding plan

Trigger: on first launch, or when the bundled manifest's `contentVersion` (or `schemaVersion`) differs from `content_meta.content_version`.

Steps (all inside one SQLite transaction):
1. Read the bundled JSON and manifest.
2. `DELETE` rows from **content tables only** (including `search_index`), in dependency order.
3. `INSERT` the new rows (batched), rebuild `search_index`.
4. Update `content_meta` (`content_version`, `schema_version`, `seeded_at`).
5. `COMMIT`. If any step fails, `ROLLBACK`: the previous content stays in place and the app keeps working with it. The next launch retries.

User-data tables are not part of the transaction's writes. After seeding, orphan handling is read-time only:
- A saved/checked/reminder row whose content id no longer exists is shown as "no longer available" (or hidden), never deleted automatically.
- Because ids are never reused or renamed (`CONTENT_SCHEMA.md` §1.2), an old id never silently points at different content.

Large JSON is processed per file to limit memory use. The seed does not use the network.

## 7. Migration plan (schema changes)

Two kinds of change, handled differently:

**Content-table changes** (new column, new table):
- Content tables are disposable. A schema change is applied by dropping and recreating the affected content tables, then re-seeding in the same transaction. No data migration is needed.

**User-data-table changes**:
- Use versioned, forward-only migrations (Drizzle migrations generated at build time, applied at app start before seeding). `PRAGMA user_version` tracks the applied version.
- Migrations only `ALTER TABLE ... ADD COLUMN` or create new tables when possible; destructive changes copy data to a new table inside a transaction first.
- Each migration runs in a transaction; on failure it rolls back and the app shows a recoverable error rather than losing data.
- Every migration is covered by a test that opens a database at the previous version with sample user data and checks that the data survives.

Order at startup: run user-data migrations -> check `contentVersion` -> seed content if needed.
