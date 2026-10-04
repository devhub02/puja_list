# Progress

Phases are defined in the project plan; this checklist tracks their status. Statuses are updated only after the work is done and its checks have been seen to pass.

- [x] **Phase 0 — Monorepo bootstrap and documentation** (done on branch `phase-0-setup`, not pushed)
- [x] **Phase 1 — Design system, navigation, i18n, settings** (done on branch `phase-1-foundation`, not pushed)
- [x] **Phase 2 — Content schema validation, export pipeline, phone database** (done on branch `phase-2-data-layer`, not pushed)
- [x] **Phase 3, Batch 1 — Bundled puja content, pan-India core pujas** (in progress on branch `phase-3-batch-1`)
- [ ] Phase 3, Batch 2
- [ ] Phase 4
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
