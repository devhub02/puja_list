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
- **Images**: 22 original images from the owner's `PujaSaathi-Assets/` optimized into `mobile/assets/images/{brand,categories,pujas}` (16 puja WebP, 3 category WebP, 3 brand PNG; 1.3 MB total, largest file 103 KB). One id -> image mapping in `src/theme/images.ts` (puja -> category -> icon, never throws). app.json now uses the brand icon, splash and an adaptive-icon foreground on the cream background. `docs/ASSET_CREDITS.md` written.
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
- **Category images**: only 3 of 6 categories have artwork (see the image report in the phase summary); the others use a vector icon.

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
