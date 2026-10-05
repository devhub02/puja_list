<div align="center">

# 🪔 Puja Saathi

**Har Puja Ki Samagri, Vidhi Aur Taiyari**

An offline-first Android app (Hindi + English, more Indian languages later) that guides you through pujas and
festivals across India: significance, samagri, step-by-step vidhi, preparation checklists and local reminders.

![Expo SDK 57](https://img.shields.io/badge/Expo%20SDK-57-000020?logo=expo)
![React Native](https://img.shields.io/badge/React%20Native-0.86-61dafb?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white)
![Platform](https://img.shields.io/badge/platform-Android-3ddc84?logo=android&logoColor=white)

</div>

> Not a pandal finder, social app, online shop, priest-booking service or login-based app.

## Status

| Phase | State |
|---|---|
| 0 - Monorepo bootstrap and docs | Done |
| 1 - Design system, navigation, i18n, settings | Done (branch `phase-1-foundation`) |
| 2 - Content schema validation, export pipeline, phone database | Done (branch `phase-2-data-layer`) |
| 3+ - Real content, screens, reminders, ads | Not started |

The app currently has four tabs (Home, Library, My Preparation, Settings). Settings is fully working (language,
theme, text size, About, disclaimer). The other tabs are honest "coming soon" screens; there is **no puja content
yet**. Details and what was verified: [docs/PROGRESS.md](docs/PROGRESS.md).

## Features so far

- Hindi and English UI (Devanagari rendered with Noto Sans Devanagari), with English fallback
- Light, dark or system theme; four text sizes with a live preview
- Warm cream / saffron / maroon / gold design system ([docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md))
- Works fully offline; fonts are bundled, no network code, no `INTERNET` permission

## Quick start (mobile app)

Requirements: **Node 22 LTS**, npm 10+, git. For a device: the **Expo Go** app on an Android phone, or Android
Studio with an emulator.

```bash
git clone https://github.com/devhub02/puja_list.git
cd puja_list/mobile
npm install
npm start
```

`npm start` opens the Expo dev server. Then either scan the QR code with Expo Go (phone and computer on the same
Wi-Fi), or press `a` for a running Android emulator.

**From Phase 7 onward, `react-native-google-mobile-ads` is a native dependency, so Expo Go can no longer run this
app.** Use a development build instead (see [docs/ADS_SETUP.md](docs/ADS_SETUP.md) for the full workflow and release
checklist):

```bash
npx expo run:android          # first build only (or after any native dependency change); needs Android Studio/SDK
npx expo start --dev-client   # daily work after that
```

| Command (in `mobile/`) | What it does |
|---|---|
| `npm start` | Start the Expo dev server |
| `npm run android` | Start Expo and open on a connected Android device/emulator |
| `npm test` | Jest + React Native Testing Library |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm run lint` | ESLint |
| `npm run format` / `npm run format:check` | Prettier write / check |
| `npx expo export --platform android` | Build the Android bundle (smoke check; output in `dist/`, git-ignored) |
| `npx expo-doctor` | Check the project setup (needs internet for two of its checks) |
| `npm run db:generate` | After editing `src/db/schema.ts`: generate a Drizzle migration into `mobile/drizzle/` (commit it). Raw SQL: `npx drizzle-kit generate --custom --name=<name>` |

If the app looks stale after changing dependencies or config, restart with a clean cache: `npx expo start -c`.

Later phases add native modules (ads) that need a **development build** instead of Expo Go.

## Quick start (backend tooling)

The Python backend is local tooling for now (content validation/export). It is never required for the app to work.

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload    # then open http://127.0.0.1:8000/health
pytest
```

`GET /health` returns `{"status": "ok"}`.

## Content pipeline (validate and export)

Source of truth is `content/` (format: [docs/CONTENT_SCHEMA.md](docs/CONTENT_SCHEMA.md)). Run from the repo root with the
backend virtualenv active (it needs `pydantic`):

```bash
python scripts/validate_content.py   # checks every file and cross-reference; prints file / entity id / field; exit 1 on errors
python scripts/export_content.py     # validates first, refuses on failure, then writes mobile/assets/puja_data/content.json
```

The export carries `schemaVersion`, `contentVersion` and a checksum. Bump `contentVersion` in
`content/content_manifest.json` whenever content changes; the app re-seeds its phone database when it sees a new version.
Neither script invents content. Phase 2 ships empty collections; real content arrives in Phase 3.

## Project structure

```
mobile/                Expo + React Native app (TypeScript strict, Expo Router)
  app/                 Screens: (tabs)/index, library, preparation, settings; root _layout
  src/
    components/        Shared UI: AppText, Card, EmptyState, ScreenContainer, SectionHeader, SegmentedControl
    db/                Drizzle schema, seed loader, FTS5 search, read-only repositories
    i18n/              Locale files (en, hi), language registry, locale-map helper, date format
    store/             Zustand settings store (persisted with AsyncStorage)
    theme/             Design tokens, ThemeProvider/useTheme, fonts, contrast helper
  drizzle/             Generated + raw SQL migrations (committed, applied at app start)
  assets/puja_data/    Exported content bundle (written by scripts/export_content.py)
  assets/fonts/        Bundled Nunito Sans + Noto Sans Devanagari (SIL OFL)
  __tests__/           Jest tests
backend/               FastAPI service and content tooling (Python): app/schemas (Pydantic content models), app/services (loader, export), tests/
content/               Source-of-truth JSON for puja and calendar data (empty collections for now)
scripts/               validate_content.py, export_content.py
docs/                  CONTENT_SCHEMA.md, DB_SCHEMA.md, DESIGN_SYSTEM.md, PROGRESS.md
CLAUDE.md              Project rules and context
```

## Adding a language

1. Create `mobile/src/i18n/locales/<code>.ts` typed as `Translations` (the compiler lists missing keys).
2. Add one entry to `mobile/src/i18n/registry.ts`.
3. If the language uses a new script, bundle a font for it and map it in `mobile/src/theme/fonts.ts`.

Content strings use locale maps (`{"en": "...", "hi": "..."}`) and fall back to English via `localize()`.

## Offline-first model

- All puja content is bundled in the app (`mobile/assets/puja_data/`), so every feature works without internet.
- The network is used only for AdMob ads and the UMP consent form (`mobile/src/ads/`). Ads never block a feature:
  offline or a failed ad load collapses that ad slot to nothing. No accounts, no login, no analytics.
- An optional content API may come later; bundled content always remains the fallback.

## Content note

Vidhi and samagri differ by region, family tradition, sampradaya and the way a puja is performed. Content is written
in our own words, never presented as the only correct way, and labelled with a review status until verified by an
expert.

## Documentation

- [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md): colours, typography, spacing, components, accessibility
- [docs/CONTENT_SCHEMA.md](docs/CONTENT_SCHEMA.md): bundled JSON content format and validation rules
- [docs/DB_SCHEMA.md](docs/DB_SCHEMA.md): on-device SQLite design
- [docs/ADS_SETUP.md](docs/ADS_SETUP.md): AdMob/UMP setup, test IDs, dev-build workflow, release checklist
- [docs/PRIVACY_AND_ADS.md](docs/PRIVACY_AND_ADS.md): what is stored/processed, Data safety form checklist, privacy policy template
- [docs/PROGRESS.md](docs/PROGRESS.md): phase checklist and verification notes
- [CLAUDE.md](CLAUDE.md): project rules

## Android

Application ID: `com.pujasaathi.app`.
