# Phone Database Schema (design only)

Status: designed in Phase 0, implemented in Phase 2 (`mobile/src/db/schema.ts`, migrations in `mobile/drizzle/`); the preparation tables were redesigned in Phase 5 (§3.1); the `festival` table and `calendar_date.region` changed in Phase 6A (migration `0003_festival_catalog`, §7). `expo-sqlite` with Drizzle ORM (FTS5 for search). The database lives on the phone only.

## 1. Principles

1. **Content tables and user-data tables are separate.** Content tables are rebuilt from the bundled JSON. User-data tables are never touched by seeding.
2. **User data references content by stable string id, with no foreign keys to content tables and no cascading deletes from content.** (User-data tables that belong to a preparation do have a foreign key to `preparation`, with cascade, so deleting a preparation deletes its own rows and nothing else; see §3.1.) If a content row is removed or replaced during re-seeding, user rows stay intact. The app resolves ids at read time and handles "content no longer exists" gracefully (see §6).
3. All user-visible content text is stored as locale-map JSON (text columns holding `{"en": "...", "hi": "..."}`). Language selection and the fallback to `en` happen in app code, so adding a language needs no schema change.
4. Primary keys of content tables are the stable ids from `CONTENT_SCHEMA.md`.
5. Timestamps are integer epoch milliseconds (UTC).

## 2. Content tables (replaced on re-seed)

| Table | Columns (all `TEXT` unless noted) |
|-------|-----------------------------------|
| `festival` | `id` PK, `name_json`, `alt_names_json`, `short_description_json`, `significance_json` (nullable), `regions_json`, `states_json` (nullable), `category`, `date_type`, `observance_json` (nullable), `linked_puja_ids_json` (default `'[]'`), `review_status`, `source_note_json`, `status` |
| `puja` | `id` PK, `festival_id` (nullable), `name_json`, `alt_names_json`, `category`, `regions_json`, `summary_json`, `significance_json`, `review_status`, `source_note_json`, `disclaimer_json`, `content_version` INTEGER, `status` |
| `samagri` | `id` PK, `name_json`, `alt_names_json`, `description_json`, `status` |
| `puja_samagri` | `puja_id`, `samagri_id`, `classification` (`REQUIRED`/`COMMON`/`OPTIONAL`), `purpose_json`, `quantity_guidance_json`, `preparation_note_json`, `regional_note_json`, `sort_order` INTEGER; PK (`puja_id`, `samagri_id`) |
| `vidhi_step` | `id` PK, `puja_id`, `step_number` INTEGER, `title_json`, `description_json`, `related_samagri_ids_json`, `is_optional` INTEGER (0/1), `important_note_json` |
| `regional_variation` | `id` PK, `puja_id`, `regions_json`, `title_json`, `description_json`, `affects_step_ids_json`, `affects_samagri_ids_json` |
| `calendar_date` | `id` PK, `festival_id`, `year` INTEGER, `date` (ISO), `end_date` (ISO, nullable), `region` (`all` or a festival region, default `'all'`), `certainty`, `region_note_json`, `source` |
| `content_meta` | `key` PK, `value` — holds `content_version`, `schema_version`, `checksum`, `seeded_at` |

Content tables may use real foreign keys **among themselves** (for example `vidhi_step.puja_id -> puja.id`) because they are always rebuilt together in one transaction. `puja_samagri` and `checklist` template rows (if the puja has `preparationChecklist`) follow the same rule. `festival.linked_puja_ids_json` is a JSON array of puja ids and may be empty (calendar-only festival); there is deliberately no foreign key on it, and `puja.festival_id` stays the primary-festival link. `festival_id` columns on user tables are unchanged. A `checklist_template` table (`id` PK, `puja_id`, `text_json`, `days_before`) is included in the content set for the preparation checklist.

## 3. User-data tables (never touched by seeding)

None of these has a foreign key to a content table. The three tables that belong to a preparation (`checklist_progress`, `custom_samagri`, `vidhi_progress`) have a foreign key to `preparation` only.

| Table | Columns | Notes |
|-------|---------|-------|
| `saved_puja` | `puja_id` PK, `saved_at` INTEGER | bookmark |
| `preparation` | `id` PK (generated, prefix `prep_`), `puja_id` (content id, no FK), `title` (nullable user label), `created_at`, `updated_at`, `last_opened_at` INTEGER | one checklist for one puja and occasion; a puja can have several (Phase 5) |
| `checklist_progress` | `preparation_id` (FK -> `preparation`, ON DELETE CASCADE), `item_kind` (`samagri`/`custom`), `item_ref` (samagri id or custom item id), `checked` INTEGER, `updated_at` INTEGER; PK (`preparation_id`, `item_kind`, `item_ref`) | ticks of one preparation; **no row = not checked** |
| `custom_samagri` | `id` PK (generated, prefix `usr_`), `preparation_id` (FK -> `preparation`, ON DELETE CASCADE), `name`, `note` (nullable), `created_at` INTEGER | free-text items of one preparation; plain text, not locale maps |
| `vidhi_progress` | `preparation_id` PK (FK -> `preparation`, ON DELETE CASCADE), `last_step_number` INTEGER, `completed_at` INTEGER (nullable), `updated_at` INTEGER | reading position in the vidhi, one row per preparation |
| `reminder` | `id` PK (generated), `puja_id` (nullable), `festival_id` (nullable), `title`, `fire_at` INTEGER, `notification_id` (nullable, from expo-notifications), `created_at` INTEGER | local notifications, inexact |
| `recent_view` | `puja_id` PK, `viewed_at` INTEGER | upserted on view; trimmed to the latest N |
| `recent_search` | `query` PK, `searched_at` INTEGER | trimmed to the latest N |
| `app_setting` | `key` PK, `value` | **not created**: settings live in AsyncStorage (Phase 1). Add it by a migration only if that changes. |

Implemented in Phase 4 (repositories in `mobile/src/db/repositories/`): `saved_puja` (save / unsave / list), `recent_view` (record / list, newest 20 kept) and `recent_search` (record / list / clear, newest 10 kept, one row per search ignoring case and extra spaces). Implemented in Phase 5: `preparation`, `checklist_progress`, `custom_samagri` and `vidhi_progress` (§3.1). `reminder` still has no repository (Phase 6).

### 3.1 Preparations (Phase 5 design)

The product needs several checklists per puja (for example one for Diwali at home and one for a sister's home), duplicating a checklist, custom items, per-checklist progress and a saved reading position. The model:

```
preparation 1 --- * checklist_progress   (ticks; no row = unchecked)
            1 --- * custom_samagri       (the user's own items)
            1 --- 0..1 vidhi_progress    (resume step, completion)
```

- `preparation.puja_id` is a plain content id with **no foreign key and no cascade from content**. Re-seeding never touches a preparation.
- Everything owned by a preparation is deleted with it (`ON DELETE CASCADE`, and the repository also deletes explicitly inside one transaction so it stays correct if foreign keys were off). Deleting one preparation never touches another preparation of the same puja, `saved_puja`, `recent_view` or `recent_search`.
- A custom item's tick lives in `checklist_progress` (`item_kind = 'custom'`), so one toggle function serves both kinds. Deleting a custom item deletes its tick in the same transaction.
- `lastOpenedAt` orders "most recent first" everywhere; `updated_at` changes with every edit; opening a screen only touches `last_opened_at`.
- Ids: `prep_` / `usr_` + time + counter + random digits (no crypto dependency). The prefixes keep user ids from ever colliding with content ids.
- Limits enforced in the repository: label 60 characters, custom item name 80, note 200. Text is trimmed; an empty label is stored as NULL; an empty item name is rejected.

**Changes from the proposed model** (and why):
1. `item_kind` is `samagri` | `custom` only. The Phase 2 enum also allowed `template` (the content's day-by-day `preparationChecklist`); Phase 5 does not use it and an unused value would be a stub. Adding it later needs no migration (the column is plain text with no CHECK constraint).
2. "Not checked" is the **absence** of a row, and Reset deletes the rows. The `checked` column can still hold 0 (a row that was ticked and then unticked), so the code reads `checked = 1`.
3. Existing Phase 2 rows are migrated, not dropped (§7): each distinct `puja_id` becomes a default preparation `prep_migrated_<puja_id>`.
4. Writes that touch more than one row run in one transaction, and `withTransaction` now queues transactions per connection, so two taps in quick succession cannot interleave (a second `BEGIN` on the same connection would fail, and one caller's statements would land inside the other's transaction).

**Lazy creation.** A preparation is created only by an action, never by viewing: the first tick or custom item in the Samagri screen, the first move past step 1 (or finishing) in the Vidhi screen, or "Start preparation". `ensureDefaultPreparation(pujaId)` returns the most recently opened preparation of the puja, or creates one inside a transaction (two simultaneous calls create one row).

**Progress** is computed in pure functions (`mobile/src/utils/preparationProgress.ts`), never stored: per group (REQUIRED, COMMON, OPTIONAL, custom) `checked/total`; overall = checked / total of all four groups; "required items done" is REQUIRED only. Nothing is ever auto-checked or promoted: an optional item cannot raise the required count.

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
- `preparation(puja_id)`, `preparation(last_opened_at)`
- `checklist_progress(preparation_id)`
- `custom_samagri(preparation_id)`
- `vidhi_progress`: primary key `preparation_id`
- `reminder(fire_at)`, `reminder(puja_id)`
- `recent_view(viewed_at)`, `recent_search(searched_at)`

## 5. Search (FTS5, Hindi + English)

One FTS5 virtual table, `search_index`, rebuilt as part of seeding (it is derived content, so it is a content table).

Columns: `entity_type` (UNINDEXED: `puja`/`festival`/`samagri`), `entity_id` (UNINDEXED), `names`, `alt_names`, `extra`.

What goes in each row:
- **puja / festival rows**: `names` = every language of `name` in one string; `alt_names` = all alternate spellings (for example transliterations such as "Ganesh/Ganesha/गणेश"); `extra` = samagri names for pujas so a search for a samagri finds pujas that use it.
- **samagri rows**: `names` and `alt_names` of the item.

Tokenizer: `unicode61 remove_diacritics 2 categories 'L* N* Co Mn Mc'`. Prefix queries (`"term"*`) support type-ahead.

Why `categories` is needed (tested in Phase 2): the default `unicode61` token categories are `L* N* Co`. Devanagari vowel signs (matras, category Mc) and the virama/anusvara (Mn) are not in that list, so the default tokenizer **splits Hindi words at every matra**: `लक्ष्मी` becomes `लक`, `ष`, `म`, which makes a query like `ष` match inside unrelated words. Adding `Mn Mc` keeps whole words intact. `remove_diacritics 2` still folds Latin accents. The trigram tokenizer was rejected because it needs at least 3 characters (many Hindi words and type-ahead prefixes are shorter).

Hindi/English specifics:
- Alternate **Roman spellings of Hindi words** (Latin transliteration) are stored in `alt_names`, because users often type Hindi in Latin letters. These come from content (`alternateNames`), not from code-based transliteration.
- Devanagari combining marks (matras) are token characters (see above). Text and queries are normalised to NFC and stripped of zero-width joiners in app code, identically on both sides. The content authoring rule is to include common spelling variants in `alternateNames` rather than depend on fuzzy matching.
- A user query becomes `"word1"* "word2"*`: every word is a prefix term and all must match. User input is stripped of FTS syntax characters before use.
- Deprecated entities are kept in the content tables but get no search row. A puja's `extra` contains the names **and alternate spellings** of its samagri.
- Ranking: `bm25` with column weights favouring `names` over `alt_names` over `extra`.

Puja-centred search (`searchPujas`, Phase 4): a puja matches when the query hits its names/alternate spellings (FTS column filter `{names alt_names}`), its festival's name, a category the caller resolved from the UI's translated category names (category names are UI strings, not indexed), or a samagri item it uses (`samagri` rows joined to `puja_samagri`, so the UI can say "found in: <puja>").

FTS5 availability: `expo-sqlite`'s Android build compiles SQLite with `-DSQLITE_ENABLE_FTS5=1` (verified in `node_modules/expo-sqlite/android/build.gradle`, SQLite 3.50.x), and the migration creates the table at startup, so a build without FTS5 would fail loudly at the first launch rather than silently mis-search. Behaviour of the tokenizer was verified in unit tests on Node's SQLite 3.50.x; confirming it on a real Android device is still a manual step. There is deliberately no `LIKE` fallback code.

Recent searches are stored in `recent_search`; the FTS index holds no user data.

## 6. Seeding plan

Trigger: on first launch (no `content_meta` rows), or when the bundled `contentVersion`, `schemaVersion` or `checksum` differs from the stored `content_version`, `schema_version` or `checksum`. (The checksum also catches a rebuilt bundle whose version was not bumped. "Tables are empty" is not used as a trigger because an empty content set is valid.)

Steps (all inside one SQLite transaction):
1. Read the bundled `content.json` (a bundle with a `schemaVersion` newer than the app supports is refused before anything is written).
2. `BEGIN IMMEDIATE`, then `DELETE` rows from **content tables only** (including `search_index`), children before parents. `PRAGMA foreign_keys = ON` is set at open; content tables use real foreign keys among themselves (no cascades).
3. `INSERT` the new rows (batched), rebuild `search_index`.
4. Update `content_meta` (`content_version`, `schema_version`, `checksum`, `seeded_at`).
5. `COMMIT`. If any step fails, `ROLLBACK`: the previous content stays in place and the app keeps working with it. The next launch retries.

User-data tables are not part of the transaction's writes. After seeding, orphan handling is read-time only:
- A saved/checked/reminder row whose content id no longer exists is shown as "no longer available" (or hidden), never deleted automatically.
- **Preparations after a content update (Phase 5):**
  - *A samagri id a preparation ticked is no longer in the puja's list* (removed from the puja, or the item was deprecated and dropped from it): the tick row is kept. The Samagri screen shows it under "No longer in the guide" (with its catalogue name if that still exists, else "Removed item") and lets the user remove it. It counts for nothing: it is not in the total and not in the checked count. `replacedBy` is **not** followed: the `samagri` content table has no `replaced_by` column, so a replacement cannot be known on the phone, and silently moving a tick to a different item could be wrong. (If that is wanted later it needs a content-schema and content-table change first.)
  - *The puja itself disappears or is deprecated*: the preparation stays. My Preparation shows it as "This puja is no longer available" (progress hidden; rename, duplicate and delete still work; opening is disabled), and the Shopping list says its items cannot be shown.
  - *A step disappears or the vidhi gets shorter*: the saved step number is matched against the current steps; if it no longer exists the reader starts from the beginning (the safety notes if the puja has any, else step 1).
- Because ids are never reused or renamed (`CONTENT_SCHEMA.md` §1.2), an old id never silently points at different content.

The bundle is a single JSON file (CONTENT_SCHEMA.md §2.2) read into memory at once; revisit if it grows to many megabytes. The seed does not use the network.

## 7. Migration plan (schema changes)

Two kinds of change, handled differently:

**Content-table changes** (new column, new table):
- Content tables are disposable. A schema change is a normal migration that drops and recreates the affected content tables **and deletes the `content_meta` rows**, so the seed runs again right after (the missing meta triggers it). No data migration is needed.

**User-data-table changes** (`0002_preparations`, Phase 5, is the worked example):
- Use versioned, forward-only migrations (Drizzle migrations generated at build time with `npx drizzle-kit generate`, committed in `mobile/drizzle/`, applied at app start before seeding). Drizzle's own `__drizzle_migrations` table tracks what was applied; `PRAGMA user_version` is not used. Raw SQL (such as the FTS5 table) goes in a `drizzle-kit generate --custom` migration.
- Migrations only `ALTER TABLE ... ADD COLUMN` or create new tables when possible; destructive changes copy data to a new table inside a transaction first.
- Each migration runs in a transaction; on failure it rolls back and the app shows a recoverable error rather than losing data.
- Every migration is covered by a test that opens a database at the previous version with sample user data and checks that the data survives.
- `0002_preparations` was generated by `drizzle-kit generate`, then the SQL body was **rewritten by hand**: the generated SQL added a `NOT NULL` column to a table that might hold rows and copied columns that did not exist yet, which fails or loses data on a database with rows. The hand-written version creates `preparation` and `vidhi_progress`, renames the two old tables, creates one default preparation per distinct `puja_id` found in them, copies their rows into the new tables, and drops the old ones. The Drizzle snapshot is the generated one, so `drizzle-kit generate` reports "No schema changes". `saved_puja`, `recent_view`, `recent_search` and `reminder` are not touched; the migration test checks that saved pujas, recent views and recent searches survive (there is no `reminder` row in that test because nothing writes reminders yet).

Order at startup: run user-data migrations -> check `contentVersion` -> seed content if needed.

### 7.1 `0003_festival_catalog` (Phase 6A, a content-table change)

Changes: the `festival` table gets the new festival columns (§2; `description_json` became `short_description_json`, `significance_json` became nullable) and `calendar_date` gets `region TEXT NOT NULL DEFAULT 'all'`.

- Generated by `drizzle-kit generate` (it asks about renaming columns; answer "create"), then **the SQL body was rewritten by hand**: the generated SQL copies columns that do not exist in the old `festival` table into the new one, which fails on a database that has rows. The hand-written version follows the content-table rule above: it empties every content table (children before parents, plus `search_index`), deletes the `content_meta` rows, drops and recreates `festival`, and adds the `region` column. The Drizzle snapshot is the generated one, so `drizzle-kit generate` reports "No schema changes".
- **No user-data table is touched**: `saved_puja`, `preparation`, `checklist_progress`, `custom_samagri`, `vidhi_progress`, `reminder`, `recent_view` and `recent_search` keep every row. The migration test (`mobile/__tests__/db.migration0003.test.ts`) builds a Phase 5 database with a row in every user table plus old-shape content, applies the migration, and checks that the user rows are byte-for-byte unchanged, the content tables and `content_meta` are empty, the new columns exist, and the next seed (schemaVersion 2 content) refills the content while the user rows still resolve.
- Because `content_meta` is deleted, the seed runs on the very next start, and the seed loader now reads `schemaVersion` 2 content (`SUPPORTED_SCHEMA_VERSION = 2`).
- `getContentInfo` also returns `festivalCount` (every row of `festival`, like `pujaCount` for `puja`), shown in Settings > About.
- `calendar_date.source` stays `NOT NULL`. A bundled calendar entry without a `source` is stored as the empty string and read back as "no source" (`undefined`); an entry without `region` is stored as `all`. No migration was needed for this.

## 8. Calendar reads (Phase 6B, no schema change)

No table or migration changed. `mobile/src/db/repositories/calendarRepository.ts` reads `calendar_date` joined to active `festival` rows (the `calendar_date(year, date)` and `(festival_id, year)` indexes cover these):

- `listDatesForMonth(year, month)`: rows with `date <= month end AND COALESCE(end_date, date) >= month start` (so a festival that began in the previous month is included), by start date then English name.
- `listNextDates(today)` / `listUpcomingFestivals(today, limit)`: rows with `COALESCE(end_date, date) >= today` (an ongoing festival has `date <= today <= end_date` and is included), one row per festival (its earliest remaining date), soonest first.
- `getNextDate(festivalId, today)`: the first such row of one festival, or null.
- `listFestivalsWithoutDate(year)`: active festivals with no `calendar_date` row in that year.

`today` is the device-local date as `YYYY-MM-DD` (`localIsoDate`). Dates are compared as strings (the format sorts like a date) and are never converted through a time zone. `end_date` equal to `date`, or null, means a single-day festival. Deprecated festivals never appear.

