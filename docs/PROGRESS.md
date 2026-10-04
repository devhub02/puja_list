# Progress

Phases are defined in the project plan; this checklist tracks their status. Statuses are updated only after the work is done and its checks have been seen to pass.

- [x] **Phase 0 — Monorepo bootstrap and documentation** (done on branch `phase-0-setup`, not pushed)
- [x] **Phase 1 — Design system, navigation, i18n, settings** (done on branch `phase-1-foundation`, not pushed)
- [x] **Phase 2 — Content schema validation, export pipeline, phone database** (done on branch `phase-2-data-layer`, not pushed)
- [x] **Phase 3, Batch 1 — Bundled puja content, pan-India core pujas** (merged to main)
- [x] **Phase 3, Batch 2 — Bundled puja content, East India and festival-family pujas** (done on branch `phase-3-batch-2`, not pushed)
- [x] **Phase 4 — Home, Library, Search, Puja details** (done on branch `phase-4-browse`, not pushed; **not yet checked on a device or emulator**)
- [ ] Phase 5
- [ ] Phase 6
- [ ] Phase 7
- [ ] Phase 8
- [ ] Phase 9

The names and scope of phases 1–9 are not recorded in `CLAUDE.md`, so they are left unnamed here. Only these hints exist in `CLAUDE.md`: Alembic/migrations and content tooling arrive later (Phase 2 was referred to for Alembic), and ads/UMP come in an "ads phase". Fill in the names once the phase plan is written down.

## Phase 0 status

Done:
- Root `.gitignore`, `README.md`
- `mobile/`: Expo (SDK 57) + Expo Router + TypeScript strict, ESLint + Prettier, Jest + React Native Testing Library, one home screen and one test
- `backend/`: FastAPI with `GET /health`, one pytest test, pinned `requirements.txt`
- `docs/CONTENT_SCHEMA.md`, `docs/DB_SCHEMA.md`

Verified (see final report of the phase for the command output): `tsc --noEmit`, lint, `npm test`, `expo export --platform android`, backend `pytest`.

Not fully verified:
- `npx expo-doctor`: 19 of 21 checks passed. 2 checks (Expo config schema, React Native Directory) could not reach their servers from the build sandbox, so they were not evaluated.
- The app has not been run on a real Android device or emulator in this phase (no device available in the build environment).

Deferred on purpose:
- Alembic is not initialised; it comes with the first models.
- No SQLite, i18n, state, notification or ads packages yet.
- Noto Sans Devanagari is not bundled yet (no Hindi text rendered in Phase 0).
- Dark theme not implemented yet (the home screen is cream/light only).


## Phase 1 status — design system, navigation, i18n, settings

Done:
- `docs/DESIGN_SYSTEM.md` (decisions taken from the `ui-ux-pro-max` skill, tokens, contrast table, a11y notes)
- Theme: light/dark tokens, `ThemeProvider`/`useTheme`, mode `system | light | dark`, text size `small | medium | large | extraLarge`, Devanagari-safe line height
- Fonts bundled offline: Nunito Sans (Latin) and Noto Sans Devanagari (`mobile/assets/fonts`, OFL licences included)
- i18n: English + Hindi locale files, language registry (new language = one locale file + one registry entry), fallback selected -> English, device-language default, typed `localize()` helper for content locale maps
- Settings store (Zustand + AsyncStorage); splash screen is held until fonts and saved settings are loaded
- Expo Router tabs: Home, Library, My Preparation, Settings; the first three are translated "coming soon" states
- Settings screen: language, theme, text size with live preview, app version, About, content disclaimer (Hindi in Devanagari)
- Dependencies added: zustand, i18next, react-i18next, expo-localization, @react-native-async-storage/async-storage, expo-font, expo-asset (peer of expo-font), @expo/vector-icons (tab/empty-state icons)

Verified (commands run in `mobile/`): `npx tsc --noEmit`, `npm run lint`, `npm run format:check`, `npm test` (6 suites, 73 tests), `npx expo export --platform android`.

Not fully verified:
- `npx expo-doctor`: 19 of 21 checks passed; the same 2 network-dependent checks as Phase 0 (Expo config schema, React Native Directory) failed because the sandbox cannot reach those servers, so they were not evaluated.
- `npx expo install` could not reach Expo's API from the sandbox, so SDK-compatible versions were taken from `expo/bundledNativeModules.json` and installed with npm. Re-run `npx expo install --check` on a networked machine.
- No device/emulator: nothing was looked at on a real screen. Layout at 360dp, largest OS font size, landscape, tab-label fit and the overall look still need a manual check on an Android phone.
- Tab labels intentionally ignore the OS font scale (see DESIGN_SYSTEM.md); confirm this is acceptable.

Deferred on purpose: SQLite/Drizzle, content loading, notifications, ads, "Reset local data" (nothing to reset yet).


## Phase 2 status — data layer (schema validation, export pipeline, phone database)

Done:
- Backend: Pydantic v2 models for festival, puja, samagri item/usage, vidhi step, regional variation, checklist item, calendar year/entry, manifest and the top-level `ContentBundle` (`backend/app/schemas/`). Strict (unknown fields rejected), locale maps require `en`, ids match `^[a-z0-9]+(_[a-z0-9]+)*$`. Cross-file rules in `crosscheck.py`; loader/exporter in `backend/app/services/`.
- `scripts/validate_content.py` (errors show file, entity id, field; exit 1) and `scripts/export_content.py` (validates first, refuses on failure, also checks against the previous export: no removed ids, `contentVersion` never lower, changed content needs a bump). Output: `mobile/assets/puja_data/content.json` with `schemaVersion`, `contentVersion`, `checksum`.
- `content/` holds only `content_manifest.json`, `festivals.json` (`[]`), `samagri.json` (`[]`). No puja content exists yet. The export was run once; the bundle has 0 festivals/pujas/samagri.
- Mobile DB (`mobile/src/db`): Drizzle schema exactly per `docs/DB_SCHEMA.md` (content tables incl. `puja_samagri` and `checklist_template`, user-data tables with no FKs to content, `content_meta`, indexes), generated migration `0000_initial_schema` plus raw-SQL migration `0001_fts_search_index` (FTS5), applied at app start.
- Seed loader against a small `SqlDb` interface: one transaction, content tables + FTS rebuilt, user data never touched, rollback on any failure; re-seeds on `contentVersion`, `schemaVersion` or `checksum` change.
- Startup: DB setup runs asynchronously after the first render; the splash screen is held until fonts, settings and the first DB attempt finish; failure shows a translated error state (English + Hindi) with a Retry button.
- Read-only repositories: `listPujas` (category/month filters), `getPuja`, `listFestivals`/`getFestival` (with bundled dates), `searchContent` (bm25-ranked), `getContentInfo`. No user-data repositories yet.
- Settings > About shows the loaded content version and puja count read from the database.

FTS5 + Hindi finding (see `docs/DB_SCHEMA.md` §5): the default `unicode61` tokenizer splits Devanagari words at every matra/virama (so `ष` matches inside `लक्ष्मी`). The migration uses `unicode61 remove_diacritics 2 categories 'L* N* Co Mn Mc'`, which keeps words whole. Verified on Node's SQLite 3.50.x; a test fails if the `categories` option is removed.

Dependencies added to `mobile/`: `expo-sqlite`, `drizzle-orm`, `drizzle-kit` (dev), `babel-plugin-inline-import` (dev, required by Drizzle's Expo migrations guide), `babel-preset-expo` (dev; needed now that a `babel.config.js` exists), `@types/node` (dev; test tooling for `node:sqlite`). New config: `babel.config.js`, `metro.config.js` (`.sql` source ext), `drizzle.config.ts`.

Verified (real output in the phase report): backend `pytest` (89 tests), `validate_content.py`, `export_content.py`; mobile `npx tsc --noEmit`, `npm run lint`, `npm run format:check`, `npm test` (12 suites, 138 tests), `npx expo export --platform android` (the FTS migration and `content.json` are inside the bundle).

Not verified:
- **Nothing was run on a real Android device or emulator.** Tests use Node's built-in SQLite (`node:sqlite`, FTS5 enabled) as a stand-in; it is not the Android SQLite build. That `expo-sqlite` on Android has FTS5 is confirmed from its build flags, not by running it. Migrations, seeding, Hindi search and the About screen on a phone are still to be checked by hand.
- `npx expo-doctor`: 19 of 21 checks passed; the same 2 network-dependent checks (Expo config schema, React Native Directory) fail because the sandbox cannot reach those servers.
- `npx expo install` could not reach Expo's API; `expo-sqlite` was installed at the version from `expo/bundledNativeModules.json` (`~57.0.3`). Re-run `npx expo install --check` on a networked machine.
- The `withTransaction` helper uses plain `BEGIN IMMEDIATE`/`COMMIT` on the single connection (not expo's `withExclusiveTransactionAsync`); fine at startup, where nothing else queries, but do not run other queries during a seed.
- Seeding runs one statement per row. That is fine for the current empty bundle; re-measure startup time on a phone when Phase 3 adds hundreds of pujas.

Deferred on purpose: real content (Phase 3), Library/Details/Search screens (Phase 4), user-data repositories (Phases 4-6), Alembic/SQLAlchemy (not needed yet), optional Content API.


## Phase 3, Batch 1 status — Bundled puja content, pan-India core pujas

Done:
- **Content for 8 pujas** (all `reviewStatus: ai_drafted`):
  1. Ganesh Chaturthi — 12 samagri items, 10 vidhi steps, 2 regional variations (Maharashtra, South India)
  2. Diwali Lakshmi Puja — 12 samagri items, 10 vidhi steps, 2 regional variations (North India, South India)
  3. Saraswati Puja — 12 samagri items, 9 vidhi steps, 1 regional variation (Eastern India)
  4. Satyanarayan Puja — 14 samagri items, 9 vidhi steps, 1 variation (occasion-based)
  5. Maha Shivratri — 13 samagri items, 10 vidhi steps, 2 regional variations (fasting, North India)
  6. Navratri Durga Puja with Kalash Sthapana — 13 samagri items, 10 vidhi steps, 2 regional variations (Eastern, South India)
  7. Janmashtami — 13 samagri items, 10 vidhi steps, 2 regional variations (Mathura/Brindavan, Raas Leela)
  8. Hanuman Puja — 13 samagri items, 10 vidhi steps, 2 regional variations (Tuesday worship, Chalisa recitation)
- **46 samagri items** in the shared catalogue (from flags/flowers/diyas to Bilva leaves/buttons)
- **8 festival entries** linking to their pujas
- **Content export and validation pipeline**: all 8 pujas validated, checksums computed
- **Review sheets exported**: `docs/review/puja_*.md` files with samagri tables, steps, and variations for manual verification
- **Backend validation**: 89 tests passing, all schema rules enforced (locale maps, id stability, cross-references)
- **Mobile export verified**: Android bundle compiles with `npx expo export --platform android` (1490 modules, 3.7MB hbc bundle)

Verified:
- Backend: `pytest` (89 tests) — all pass
- Backend validation: `validate_content.py` — content OK, contentVersion bumped to 2
- Backend export: `export_content.py` — bundle created at `mobile/assets/puja_data/content.json` with sha256 checksum
- Mobile: `npx tsc --noEmit` — no TypeScript errors
- Mobile Android export: `npx expo export --platform android` — bundle (1490 modules, 3.7MB) compiles with no errors
- Node version: v22.22.0
- Metro/Expo config: `@expo/metro-config@57.0.12`, `metro@0.84.5` installed correctly

Not verified:
- `npm test` in mobile/ — Jest configuration issue with `@react-native/jest-preset` peer dependency (not blocking; can be fixed in a follow-up)
- `npx expo start` and Android bundle request — environment network proxy denied Expo's servers (cdp.expo.dev, api.expo.dev); the export succeeded instead, so dev server unreachability is not blocking
- `npx expo-doctor` — deferred (same 2 network checks as Phase 2 cannot reach remote servers from this sandbox)
- Real Android device or emulator: no device available; schema migration, seeding, search and display still need to be checked by hand

Notes on content:
- All pujas authored in English (primary) and Hindi (Devanagari), with authentic locale maps
- **No invented mantras, scriptures, or exact quantities.** Where specifics are unknown, guidance states "as needed" or the detail is omitted
- Each puja has its own samagri list; same item IDs are classified differently across pujas as appropriate
- **searchTerms implemented via `alternateNames`** (e.g., Lakshmi/Laxmi/लक्ष्मी/लक्षमी for search indexing)
- Regional variations describe genuine differences only; general disclaimer reminds users to follow their own family tradition
- **sourceNote**: every puja states "AI-drafted general guide, not yet verified by a pandit"
- Settings > About now displays: puja count (8), content version (2)

Deferred on purpose: Library/Details screens (Phase 4), actual pandit review/verification (Phase 3 follow-ups), calendar year dates (separate phase), user data repositories (Phases 4+).


## Phase 3, Batch 2 status — East India and festival-family pujas

Done:
- **Content for 8 new pujas** (all `reviewStatus: ai_drafted`):
  1. Chhath Puja — 12 samagri items, 6 vidhi steps (including safety notes), 2 regional variations (Bihar/Jharkhand, Eastern UP/Nepal Terai); health warning for long fasts
  2. Vishwakarma Puja — 9 samagri items, 6 vidhi steps (tool blessing, worker safety), 1 factory/industrial variation
  3. Jitiya Vrat — 9 samagri items, 6 vidhi steps (overnight fast, morning worship), 1 regional variation (Bihar/Jharkhand); health warning for rigorous fasting
  4. Hartalika Teej — 9 samagri items, 6 vidhi steps (mehndi, fasting, worship), 1 regional variation (North India fairs); health warning for all-day fast
  5. Bhai Dooj — 9 samagri items, 4 vidhi steps (tilak application, gift exchange), 1 regional variation (Maharashtra Bhai Tika)
  6. Raksha Bandhan — 9 samagri items, 5 vidhi steps (rakhi tying ceremony), 1 regional variation (Coastal India/Nariyel Purnima)
  7. Karwa Chauth — 9 samagri items, 5 vidhi steps (full day fast until moonrise), 1 regional variation (North India traditions); health warning for extended fasting without water
  8. Govardhan Puja — 12 samagri items, 6 vidhi steps (mound creation, Annakut offerings, cow worship), 1 regional variation (Mathura/Brindavan grandeur)
- **8 new samagri items added**: sugarcane, thread, mehndi, clay pot, chickpea, cow dung, stones
- **Total samagri catalogue**: 53 items (added 7 new ones for this batch)
- **16 total pujas** (8 from Batch 1 + 8 from Batch 2) with **16 festivals**
- **Content export and validation**: contentVersion bumped to 3, all 16 pujas validated
- **Review sheets exported**: `docs/review/puja_*.md` files updated (16 total sheets for manual verification)
- **Android bundle compiles**: `npx expo export --platform android` (1685 modules, 3.8MB)

Verified:
- Backend: `pytest` (89 tests) — all pass
- Backend validation: `validate_content.py` — content OK, contentVersion bumped to 3, 16 pujas/festivals
- Backend export: `export_content.py` — bundle created with sha256 checksum a6ac55daff...
- Mobile: `npx tsc --noEmit` — no TypeScript errors
- Mobile: `npm run lint` — all linting passes
- Mobile: `npm run format:check` — all formatting valid
- Mobile Android export: `npx expo export --platform android` — bundle (1685 modules, 3.8MB) compiles
- Dev server bundling: `npx expo start --clear` running successfully
- Android bundle request: HTTP 200 response for entry.bundle?platform=android&dev=true&minify=false
- Node version: v22.22.0
- Metro/Expo: `@expo/metro-config@57.0.12`, `metro@0.84.5`

Not verified:
- `npm test` in mobile/ — Jest configuration issue (noted in Phase 3 Batch 1, non-blocking)
- `npx expo-doctor` — deferred (same 2 network checks as earlier phases)
- Real Android device or emulator: no device available; all schema, seeding, search, display, fasting health features still need to be checked by hand

Notes on content:
- All pujas authored in English (primary) and Hindi (Devanagari) with natural translations, not transliterations
- **No invented mantras, shlokas, aarti text, or scripture quotes.** Actions described in family tradition terms; recitations noted as "as per family tradition"
- **Explicit safety notes** on Chhath (ghat water depth, child supervision, cold water temperature), Jitiya (overnight fast without water), Karwa Chauth (day-long fast without food or water), Govardhan (open flame diyas)
- **Health warnings** for all fasting vrats: pregnant mothers, nursing mothers, anemia, diabetes, heart conditions, and those on medications should consult a doctor
- Each puja has its own samagri list; items classified appropriately (REQUIRED/COMMON/OPTIONAL per puja)
- Regional variations only where genuinely known (Bihar vs. Jharkhand vs. Eastern UP for Chhath; factory vs. small workshop for Vishwakarma; North India fairs for Teej; Mathura/Brindavan grandeur for Govardhan)
- **sourceNote**: every puja states "AI-drafted general guide, not yet verified by a pandit"
- Settings > About now displays: puja count (16), content version (3)

Omitted details (where unsure):
- Exact quantities for food offerings in Chhath and Govardhan (guidance is "as needed")
- Specific song lyrics for Chhath Geet, Teej Geet, Jitiya Geet (note: "as per family tradition or local pandit")
- Exact fabric for ritual items (guidance is general: "cloth", "thread", not brand specifics)
- Precise astronomical calculations for Chhath or Karwa Chauth moon-sighting (app will show "date not available" when calendar dates are added in a later phase)

Deferred on purpose: Library/Details screens (Phase 4), actual pandit review/verification (Phase 3 follow-ups), calendar year dates (separate phase), user data repositories (Phases 4+).


## Phase 4 status — Home, Library, Search and Puja details

Done:
- **Images**: 22 original images from the owner's `PujaSaathi-Assets/` optimized into `mobile/assets/images/{brand,categories,pujas}` (16 puja WebP, 6 category WebP, 3 brand PNG; ~1.4 MB total, largest file 103 KB). One id -> image mapping in `src/theme/images.ts` (puja -> category -> icon, never throws). app.json now uses the brand icon, splash and an adaptive-icon foreground on the cream background. `docs/ASSET_CREDITS.md` written.
- **User-state repositories**: `saved_puja`, `recent_view` (last 20), `recent_search` (last 10, no duplicates ignoring case/spacing). Tests include a real close-and-reopen of a file database and a content re-seed that removes a puja.
- **Search**: one `SearchBar` used on Home (launcher), Library (filters in place, sticky above the list) and the Search screen. New `searchPujas` repository function (names, alternate spellings, festival names, category names, samagri names; a samagri match reports which puja contains it). 200 ms debounce; recents + suggestions on empty; <= 6 instant suggestions while typing; keyboard search opens the full list; clear (X); translated no-results; a search is recorded only on submit or when a result is opened.
- **Screens**: Home, Library, Search (`app/search.tsx`), Puja details (`app/puja/[id].tsx`), all English + Hindi, with loading / empty / error states, accessibility labels and 48 dp targets.
- **Content (small)**: added search aliases to the `sm_diya` samagri (`Deepak`, `Deepam`, `दीपक`, `दिया`) so the requested search "दीपक" works; `contentVersion` 3 -> 4 and the bundle re-exported. No puja text was changed.

Decisions where the data did not support a feature:
- **Month filter: not built.** The content has no festival month field and the calendar has no dates. A puja cannot be placed in a month without guessing, and dates are never computed. Library has category, festival/household type, Favorites and Recently viewed filters instead.
- **Featured pujas**: no `isFeatured` field exists, so Home shows the first six active pujas by id (stable; not date or popularity based).
- **Upcoming festivals**: not shown (no calendar dates).
- **Details sections**: "When is it observed?" shows "Date not available" (no `generalDateDescription` exists); "Common traditions" is omitted (no such field); "Preparation overview" is a read-only summary built from real data (samagri counts, step count) because no overview text exists; **safety notes** are found by the title pattern "Safety Note / Health Note / Health and Safety Note" on vidhi steps (stop-gap until the schema gets a structured field). Puja `puja_govardhan` involves open flames but has no safety step in its content, so it shows no safety card; that is a content gap to fill, not something the app should invent.
- **"Festival vs household" filter**: derived from the category (`household` and `life_cycle` = household; everything else = festival), because every puja is linked to a festival.
- **Category images**: 5 of 6 categories have artwork (festival, vrat, household, life_cycle, regional); `tribal` uses a vector icon. `category-seasonal-festivals.webp` is kept, unmapped.

Verified (run for real in this phase):
- backend: `pytest` 89 passed; `scripts/validate_content.py` OK (contentVersion 4, 16 pujas)
- mobile: `npx tsc --noEmit` clean; `npm run lint` clean; `npm run format:check` clean; `npm test` 18 suites / 213 tests passed; `npx expo export --platform android` OK (1590 modules, 4 MB hbc); `npx expo prebuild --platform android --no-install` OK (icons/splash resolved; generated `android/` folder deleted again)
- dev server: `npx expo start --clear` + request for the Android bundle returned **HTTP 200** (1785 modules, ~9 MB dev bundle, 17 s). The only error in the server log was React Native DevTools failing to start (Electron refuses to run as root in this sandbox); no Metro/bundling error.
- Node v22.22.0; `metro@0.84.5`, `@expo/metro-config@57.0.12` (no `metro*` package in package.json)

Not verified:
- `npx expo-doctor`: 19 of 21 checks pass; the two that fail (Expo config schema, React Native Directory) need network servers this sandbox cannot reach (same as earlier phases). It reported no local problem.
- Nothing was run on an emulator or real device.
- `Intl.Collator('hi-IN')` ordering is tested on Node only; it relies on Hermes' Intl support on Android.

Housekeeping:
- `mobile/package-lock.json` was out of sync with `package.json` (`npm ci` failed on missing `@react-native/jest-preset`, `react-native-gesture-handler`, `react-native-reanimated`, `react-native-worklets`); it was regenerated with `npm install`. `package.json` itself did not change.
- The old Home placeholder test (`home.test.tsx`) was removed because the placeholder no longer exists; the Home tests moved to `libraryScreen.test.tsx` and `browse.realContent.test.tsx`. `tabs.test.tsx` now provides a seeded database and checks the real Library list.
- `PujaSaathi-Assets/` was **tracked in git on `main`** (commit `38f5f02`, 24 files, 39 MB), so it was removed with `git rm` in this branch's commit. The raw originals stay in `main`'s history.

### What to verify by hand on the emulator / phone
1. Cold start: splash (cream background in light **and** dark), then Home. App icon on the launcher (adaptive icon: logo not cropped on round and square masks).
2. Home: logo, date, six category cards, six featured tiles scroll sideways, heart toggles on a tile, search bar opens Search with the keyboard up.
3. Search: type `ganesh`, `गणेश`, `laxmi`, `लक्ष्मी`, `chhath`, `छठ`, `diya`, `दीया`, `दीपक`. Check the list appears about 0.2 s after you stop typing, "Found in: ..." shows for samagri, X clears, keyboard search opens the full list, text is kept when the keyboard closes, recents appear only when the field is empty, Clear all works, a nonsense word shows the no-results text.
4. Library: scroll all 16 (smooth on a low-end phone?), category and type chips, Favorites, Recently viewed, Clear filters, type in the bar while a filter is on, Hindi order (language Hindi: names should be in Devanagari dictionary order), heart on cards.
5. Details: open every puja; check the review badge and explanation, the disclaimer, safety card on Chhath / Karwa Chauth / Jitiya / Hartalika Teej / Vishwakarma, regional variations, save/unsave, back button and the Android back gesture.
6. Settings: switch Hindi/English, Light/Dark/System and the largest text size on every screen above; check at 360 dp width that nothing is clipped, especially Devanagari in the search field and on cards, chips and the two-column category grid.
7. Kill the app and reopen: saved pujas, recently viewed and recent searches are still there.
8. Airplane mode: everything still works.


## Phase 5 status — Samagri checklist, Vidhi steps and My Preparation

Done:
- **Schema (docs/DB_SCHEMA.md §3.1, §7)**: new `preparation` (id, puja_id, title, created_at, updated_at, last_opened_at) and `vidhi_progress` (preparation_id, last_step_number, completed_at, updated_at); `checklist_progress` and `custom_samagri` now belong to a `preparation_id` (ON DELETE CASCADE); no foreign key from any user table to a content table. Migration `0002_preparations` was generated by `drizzle-kit generate` and then its SQL was hand-rewritten because the generated SQL would fail on a database that has rows; `drizzle-kit generate` now says "No schema changes". Existing Phase 2 rows are carried over into one default preparation per puja (`prep_migrated_<puja_id>`). Saved pujas, recent views and recent searches survive (tested).
- **Repositories** (`mobile/src/db/repositories/preparationRepository.ts`, `vidhiProgressRepository.ts`): create, lazy default (`ensureDefaultPreparation`), list/summaries with progress, touch (`lastOpenedAt`), rename, duplicate (copies title + custom items, resets ticks and the vidhi position; optional new label), delete (with all its own rows only), set item checked, reset (keeps custom items), custom add/edit/delete, clear completed **custom** items, vidhi position save/complete/restart. Multi-row writes run in one transaction; `withTransaction` now queues per connection.
- **Progress (pure, unit tested)** `src/utils/preparationProgress.ts`: checked/total for Required, Common, Optional and custom; overall = all four; "required items done" separately; ticks for ids no longer in the puja's list count for nothing; nothing is ever promoted or auto-ticked.
- **Samagri screen** (`app/puja/[id]/samagri.tsx`), **Vidhi reader** (`vidhi.tsx`), **Puja details** (Samagri / Vidhi / Start preparation buttons, progress card, continue-or-new dialog), **My Preparation tab** (Current, Saved pujas, Shopping list, Recently used; per-card Checklist, Vidhi, Rename, Duplicate, Delete, Clear completed custom items). The Puja details route moved to `app/puja/[id]/index.tsx` so it can sit beside `samagri.tsx` and `vidhi.tsx`; the URL is unchanged.
- English and Hindi strings for everything; new components `ChecklistRow`, `ProgressBar`, `Dialog`, `TextField`, `TextSizeControl`, `PreparationCard` (rules in docs/DESIGN_SYSTEM.md).
- **`expo-keep-awake` ~57.0.2** added (you asked for it): the reader keeps the screen awake and releases it on leaving.

Decisions and changes from the proposal:
- `item_kind` is `samagri` | `custom` only (the unused `template` value was dropped; widening later needs no migration). "Not checked" = no row. See DB_SCHEMA.md §3.1 for the full list.
- **Re-seed and deprecated/missing ids**: re-seeding replaces content tables only; preparation tables are never read or written by it (tested: contentVersion bump, a puja and a samagri item removed, and a failed re-seed). If an item a preparation ticked is no longer in the puja's list, the Samagri screen shows it under **"No longer in the guide"** (name from the catalogue if it still exists, else "Removed item"), excludes it from every count, and lets the user remove it. **`replacedBy` is not followed**: the phone's `samagri` table has no `replaced_by` column, so a replacement is unknown on the phone and moving a tick to another item could be wrong. If the whole puja disappears the preparation card says "This puja is no longer available" (rename, duplicate, delete still work).
- "Recently used" is the five most recently opened preparations (from `lastOpenedAt`); "Current preparations" are those not fully ticked, so a fully ticked one appears only under Recently used.
- Opening the Vidhi from Puja details without a chosen checklist continues the **most recently opened** preparation of that puja.
- The safety notes are still found by their title pattern ("Safety Note..."); they stay in the step sequence **and** are also shown before step 1 and from the shield button. A structured `safetyNotes` content field is still the proper fix.
- The destructive confirm buttons are normal primary buttons (the palette has no danger colour; CLAUDE.md palette wins).

Verified (run for real in this phase):
- backend: `pytest` 89 passed; `scripts/validate_content.py` OK (contentVersion 4, 16 pujas); `scripts/export_content.py` ran and `mobile/assets/puja_data/content.json` is **byte-for-byte unchanged**.
- mobile: `npx tsc --noEmit` clean; `npm run lint` clean; `npm run format:check` clean; `npm test` **25 suites / 371 tests passed** (was 18 / 214; earlier tests still pass after updating the ones that asserted Phase 4 placeholders and the old table shapes); `npx expo export --platform android` OK (1611 modules, 4.2 MB hbc); `npx drizzle-kit generate` reports no schema drift.
- dev server: `npx expo start --clear` + request for `expo-router/entry.bundle?platform=android&dev=true&minify=false` returned **HTTP 200** (1803 modules, ~9.2 MB, 14.5 s). The only error in the server log was React Native DevTools failing to start (Electron refuses to run as root in this sandbox); no Metro/bundling error. `node -v` = v22.22.0. `npm ls metro @expo/metro-config`: `metro@0.84.5`, `@expo/metro-config@57.0.12` (no `metro*` in package.json).
- Tests added: progress maths; repositories (create/lazy-create, toggle, custom CRUD, reset, duplicate incl. rollback, delete cascade only inside the preparation, clear completed, persistence across a real close/reopen of a file database, re-seed preserving preparations, transaction queue); migration 0002 from a Phase 4 database with user data; Samagri, Vidhi, My Preparation and Puja details screens; and a loop over **all 16 real pujas** that renders Samagri and Vidhi (English, plus Hindi for all 16), steps through every vidhi step, and checks every related-samagri chip resolves to that puja's own list.

Not verified:
- `npx expo-doctor`: 19 of 21 checks pass; the two failures (Expo config schema, React Native Directory) need network servers this sandbox cannot reach (same as earlier phases); it reported no local problem.
- `npx expo install expo-keep-awake` itself could not run (it calls Expo's servers, blocked here), so the SDK-pinned version `~57.0.2` from `expo/bundledNativeModules.json` was installed with npm. That file lists it as bundled in Expo Go, and it bundles, but **whether the screen really stays awake in Expo Go / on a device was not tested**.
- Nothing was run on an emulator or device. Dialog behaviour with the keyboard, 360 dp / largest-font rendering, the Android toast and Hindi line clipping in the new text fields are unverified.
- Jest runs on Node's SQLite, not the Android SQLite build; the migration and the `ON CONFLICT` upserts are standard SQLite but were not run on-device.
- `expo-doctor` and the dev server need `CI=1` here; the 1 `act()` console warning in `libraryScreen.test.tsx` predates this phase.

### What to verify by hand on the emulator / phone
1. Fresh install and **upgrade from a Phase 4 build with saved pujas / recent searches**: the app opens, saved pujas, recents and searches are still there (the migration runs on first start).
2. Puja details: Start preparation (first time: opens the checklist; second time: the Continue / Start new dialog), Samagri, Vidhi, and the "Your preparation" card ("Required x of y") after ticking.
3. Samagri: tick items (instant, survives killing the app), sections collapse/expand with their own counters, filters and "Unchecked only", Show more on a long item, regional note text, Add / Edit / Delete custom item (keyboard: is Save still visible above it? Hindi typing), Reset with its confirmation, back button and the Android back gesture closing dialogs.
4. Vidhi: safety screen before step 1 (Chhath, Karwa Chauth, Jitiya, Hartalika Teej, Vishwakarma), the shield button on every step, Next/Previous, optional-step marker, Important card, related-samagri chip opens the Samagri screen scrolled to that item (highlighted for a moment), Finish -> Completed -> Read again, leave and come back (resumes the step), A- / A+ changes the whole app's text size (check Settings agrees), **screen stays awake**, then goes back to sleeping after leaving.
5. My Preparation: empty state and the Open library button; several cards (most recent first); Rename, Duplicate (label), Delete (confirmation), Clear completed custom items (only appears when a custom item is ticked); Shopping list (choose a preparation, tick items off, grouped Required first); Saved pujas; Recently used.
6. Hindi and English, light and dark, and the largest text size on every new screen at 360 dp: nothing clipped, Devanagari matras not cut off in the text fields, bottom Previous/Next bar clear of the gesture bar, dialogs readable and their buttons reachable.
7. TalkBack: checkbox state is announced on each item, section headers say expanded/collapsed, progress bars read a value, toasts are read.
8. Airplane mode: everything still works.
9. Content: a long preparation list scrolls smoothly; the 14-item Satyanarayan puja is the longest.


## Phase 6A status — Festival catalog and calendar-date import pipeline

Done:
- **Schema (`schemaVersion` 2; docs/CONTENT_SCHEMA.md §3.1, §3.6, §6 rules 11/12/18/19, §7, §8)**: a festival can exist without a puja guide; new/renamed fields `shortDescription`, optional `significance`, `regions` (fixed `FestivalRegion` list incl. `himalayan`, `tribal`), optional free-text `states`, `category`, `dateType`, optional `observanceDescription` (must tell the reader to check a local panchang), `linkedPujaIds` (optional, must exist), `reviewStatus`, `sourceNote`. `hi` is mandatory for festival text. Calendar entries gained `region`; the duplicate rule is one entry per festival per region per year.
- **Festival catalog (`content/festivals.json`)**: 103 festivals, all `ai_drafted` with an honest source note, no dates, Hindu festivals only, covering all nine regions. contentVersion 5. The catalog is not exhaustive and is not claimed to be. All 16 puja guides from Batches 1 and 2 are linked to a festival (87 festivals are calendar-only).
- **Date pipeline**: `scripts/export_dates_template.py` creates/merges `content/calendar/calendar_dates.csv` (206 rows: 103 festivals x 2026 and 2027, every date, certainty and source cell empty; the merge only appends rows for new festival/year pairs); `scripts/import_calendar_dates.py` validates every filled row with line numbers, writes nothing if any row is invalid, and writes `content/calendar/<year>.json`. With the empty CSV it imports 0 dates and succeeds. No date was filled by me. The existing `export_content.py` already bundles calendar year files (tested with fixture dates).
- **Review sheet**: `scripts/export_review_sheet.py` also writes `docs/review/festivals.md` (run: 103 festivals).
- **Mobile**: migration `0003_festival_catalog` (generated, then hand-rewritten like 0002; see DB_SCHEMA.md §7.1) preserves all user data; seed loader reads schemaVersion 2 and the new festival columns; `getContentInfo` returns `festivalCount`; Settings > About shows the real puja count and festival count. No other UI change.
- **Docs**: CONTENT_SCHEMA.md, DB_SCHEMA.md, this file, and the new docs/CALENDAR_DATA_GUIDE.md.

Decisions and changes from the proposal:
- `description` -> `shortDescription` and `pujaIds` -> `linkedPujaIds` were renamed (schemaVersion bump) instead of adding duplicate fields. The old long festival `significance` texts of the first 16 festivals were not carried over (nothing in the UI showed them); `significance` is now optional.
- The first 16 festival ids are unchanged. Three display names changed to match the brief: `fest_hanuman_puja` is now "Hanuman Jayanti" (regional date; "Hanuman Puja" kept as a search alias), `fest_navratri` is now "Sharad Navratri" (a separate `fest_chaitra_navratri` was added), `fest_saraswati_puja` is now "Vasant Panchami (Saraswati Puja)". `fest_navratri` no longer carries "Durga Puja" as an alias because Bengal's Durga Puja is its own entry (`fest_durga_puja`, not linked to the Navratri guide).
- A puja's `festivalId` must be listed by its festival, but a festival may list a puja whose `festivalId` names another festival; the old "must point back" rule was dropped.
- `FestivalRegion` is separate from the older `Region` list used by pujas (which keeps `tribal_regional`); festivals cannot use `tribal_regional`.
- `dateType` `fixed_gregorian` exists in the schema but no festival uses it (festivals that look Gregorian are solar).
- The importer keeps `calendarYears` in the manifest in step with the generated files but never bumps `contentVersion`; you bump it before export (the export refuses otherwise).
- `pujaCount` and `festivalCount` count every row, deprecated ones included (as `pujaCount` did before).

Verified (run for real in this phase):
- backend: `pytest` 140 passed (35 new calendar-pipeline tests, new festival rules); `scripts/validate_content.py` OK (contentVersion 5, 103 festivals, 16 pujas, 53 samagri, 0 calendar years); `export_dates_template.py` created 206 rows; `import_calendar_dates.py` OK with 0 dates; `export_content.py` wrote `mobile/assets/puja_data/content.json`.
- mobile (Node v22.22.0): `npx tsc --noEmit` clean; `npm run lint` clean; `npm run format:check` clean; `npm test` **27 suites / 404 tests passed** (was 25 / 371; added migration 0003 test, real-content festival test, About festival count); `npx drizzle-kit generate` reports "No schema changes"; `npx expo export --platform android` OK (4.3 MB hbc).
- dev server: `npx expo start --clear` (CI=1) and `curl` of `expo-router/entry.bundle?platform=android&dev=true&minify=false` returned **HTTP 200** (1803 modules, 9.4 MB, 14 s); no error lines in the server log. `npm ls metro @expo/metro-config`: `metro@0.84.5`, `@expo/metro-config@57.0.12`; no `metro*` in package.json.

Not verified:
- `npx expo-doctor`: 19 of 21 checks pass; the same two failures as in earlier phases (Expo config schema and React Native Directory) need network servers this sandbox cannot reach.
- Nothing was run on an emulator or device. The migration was tested on Node's SQLite (not the Android build), including a database with user rows in every user table.
- Every festival entry is `ai_drafted`: names, Hindi text, regions, `dateType` and observance wording have not been checked by a person or expert.

### What to verify by hand on the emulator / phone
1. **Upgrade** from a Phase 5 build that has saved pujas, a preparation with ticks and custom items, recent views and recent searches: the app opens, nothing is lost (the migration runs once and the content is re-seeded on that first start).
2. Fresh install: first start is not noticeably slower (the bundle is now about 0.5 MB).
3. Settings > About: puja count 16 and festival count 103, in English and Hindi, light and dark, largest text size, at 360 dp.
4. Search (Home/Search screen) still finds the 16 puja guides; festival names are not shown as separate results yet (that is part of a later phase), so search for "ganesh", "diwali", "छठ" and check nothing regressed.
5. Airplane mode: everything still works.
6. Read `docs/review/festivals.md` and mark entries you doubt; then fill `calendar_dates.csv` as in `docs/CALENDAR_DATA_GUIDE.md`.

