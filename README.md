# Puja Saathi

*Har Puja Ki Samagri, Vidhi Aur Taiyari*

Puja Saathi is an Android app (Hindi and English) that helps you prepare for pujas and festivals: samagri lists
grouped as Required, Commonly used and Optional, step-by-step vidhi, saved checklists, a festival calendar and local
reminders. It works offline.

**Status:** version 1.0.0 is prepared for release but **not yet published**. The content is AI-drafted and not yet
checked by a pandit or expert. See [docs/KNOWN_LIMITATIONS.md](docs/KNOWN_LIMITATIONS.md) and
[docs/CONTENT_REVIEW_STATUS.md](docs/CONTENT_REVIEW_STATUS.md).

## Offline-first model

- All puja and festival content is bundled in the app. Every feature works with no internet.
- **Internet is used only by the ads SDK** (Google AdMob and its consent SDK, UMP). Ads appear on two screens, Home and
  Library. Ads need internet; when offline the space stays empty. No feature needs an ad.
- No accounts, no login, no analytics, and no server of ours that receives your data. Your checklists, reminders and
  settings stay on your phone. See [docs/privacy-policy/index.md](docs/privacy-policy/index.md).
- v1 release builds have **no real ad IDs yet**, so ads are off in release until they are set
  ([docs/ADS_GO_LIVE.md](docs/ADS_GO_LIVE.md)).

## Stack

- Mobile: TypeScript, React Native with Expo (SDK 57), Expo Router, Zustand, expo-sqlite with Drizzle ORM (FTS5 search),
  i18next, expo-notifications, react-native-google-mobile-ads (ads only), Jest and React Native Testing Library.
- Backend tooling (local only, not deployed): Python 3.11+, Pydantic (content schema), pytest. In v1 the backend only
  validates and exports content.
- Content: JSON source files in `content/`, validated by Pydantic and exported to `mobile/assets/puja_data/`.

## Repository layout

| Path | What is in it |
|---|---|
| `mobile/` | The Expo app: `app/` (screens), `src/` (components, db, store, i18n, ads, notifications, theme), `assets/` |
| `mobile/plugins/` | Expo config plugin for release signing, R8 and permissions |
| `backend/` | Python: content schemas, loader, exporter, tests |
| `content/` | Source of truth: pujas, festivals, samagri, calendar |
| `scripts/` | Validate, export, calendar import, review status, release check |
| `docs/` | Design, schemas, release, store, privacy and progress documents |
| `.github/workflows/ci.yml` | CI: mobile and backend checks on push and pull request |

## Setup

Requirements:
- **Node.js 22 LTS** and npm.
- **JDK 17** (for Gradle builds).
- **Android SDK** with platform 36 and build-tools; set `ANDROID_HOME`. Android Studio is the easiest way to get them.
- **Python 3.11 or newer** for the backend tooling.
- A phone or an emulator. Expo Go cannot run this app because of the ads SDK, so use a development build.

```bash
cd mobile
npm ci
npx expo run:android          # first build of the development client, on a connected device or emulator
npx expo start --dev-client   # day to day, after the first build
```

After changing native configuration (app.json plugins, permissions, the release plugin), regenerate the Android project:

```bash
cd mobile
npx expo prebuild --platform android --clean
```

`mobile/android/` and `mobile/ios/` are generated and git-ignored. Never commit them.

Backend tooling:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate          # Windows (use source .venv/bin/activate elsewhere)
pip install -r requirements.txt
python -m pytest -q
```

### Commands (in `mobile/`)

| Command | What it does |
|---|---|
| `npm start` | Start the Expo dev server |
| `npm run android` | Start Expo and open on a connected device or emulator |
| `npm test` | Jest and React Native Testing Library |
| `npm run typecheck` | `tsc --noEmit` (strict) |
| `npm run lint` | ESLint |
| `npm run format` / `npm run format:check` | Prettier write / check |
| `npm run db:generate` | After editing `src/db/schema.ts`: generate a Drizzle migration (commit it) |

## Content workflow

1. Edit the source files in `content/` (format: [docs/CONTENT_SCHEMA.md](docs/CONTENT_SCHEMA.md)).
2. Validate: `python scripts/validate_content.py` (prints file, entity and field; exits 1 on errors).
3. Export: `python scripts/export_content.py`. It validates first, refuses on failure, and writes
   `mobile/assets/puja_data/content.json`. Bump `contentVersion` in `content/content_manifest.json` first when the
   content changes; the app re-seeds its database when it sees a new version.
4. Regenerate the review status: `python scripts/generate_review_status.py`.

**Calendar dates** are not written by hand in code. They are filled in `content/calendar/calendar_dates.csv` from sources
you keep **outside the repository** (the CSV has no source column on purpose). Then run
`python scripts/import_calendar_dates.py`. See [docs/CALENDAR_DATA_GUIDE.md](docs/CALENDAR_DATA_GUIDE.md).

## Tests and checks

```bash
cd mobile && npm ci && npx tsc --noEmit && npm run lint && npm run format:check && npm test
cd backend && python -m pytest -q
cd .. && python scripts/validate_content.py
```

`scripts/release-check.py` runs the tests, the content checks, the export match, the secrets scan, the review-status
check, the APK permission check and the version rule. Run it after a release build.

## Debug and release builds

- **Debug:** `npx expo run:android`. It uses Google's test ad IDs only.
- **Release (Play upload, AAB):** signing comes from Gradle properties you set yourself; see [docs/RELEASE.md](docs/RELEASE.md).
  Build from `mobile/android`: `./gradlew :app:bundleRelease`.
- **Release (local test APK):** `./gradlew :app:assembleRelease`, signed with your own key.

## CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every push and pull request: the mobile checks (npm ci,
tsc, lint, format check, tests) and the backend checks (pytest, content validation). CI runs only after the branch is
pushed; no CI run has been seen for this branch yet.

## Documentation

- [docs/RELEASE.md](docs/RELEASE.md): versions, signing, build, permissions, Play requirements, release check
- [docs/KNOWN_LIMITATIONS.md](docs/KNOWN_LIMITATIONS.md): what v1 does not do, and what is not verified
- [docs/ROADMAP.md](docs/ROADMAP.md): candidate next steps (planning, not promises)
- [docs/STORE_LISTING.md](docs/STORE_LISTING.md): store text, graphics plan, release notes
- [docs/PLAY_CONSOLE_CHECKLIST.md](docs/PLAY_CONSOLE_CHECKLIST.md): Play Console steps for a new personal account
- [docs/ADS_SETUP.md](docs/ADS_SETUP.md) and [docs/ADS_GO_LIVE.md](docs/ADS_GO_LIVE.md): AdMob setup and go-live
- [docs/PRIVACY_AND_ADS.md](docs/PRIVACY_AND_ADS.md): data handling, permissions, Data safety draft
- [docs/privacy-policy/](docs/privacy-policy/): the privacy policy (English and Hindi) and how to publish it
- [docs/CONTENT_REVIEW_STATUS.md](docs/CONTENT_REVIEW_STATUS.md): review status of every guide and festival
- [docs/CONTENT_SCHEMA.md](docs/CONTENT_SCHEMA.md), [docs/CALENDAR_DATA_GUIDE.md](docs/CALENDAR_DATA_GUIDE.md), [docs/DB_SCHEMA.md](docs/DB_SCHEMA.md)
- [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md): colours, type, components, the button-row rule, accessibility
- [docs/PROGRESS.md](docs/PROGRESS.md): what was built and verified, phase by phase
- [docs/ASSET_CREDITS.md](docs/ASSET_CREDITS.md): artwork sources
- [CLAUDE.md](CLAUDE.md): project rules

## Licensing (decision pending)

No licence has been chosen. Until one is chosen, the code is **all rights reserved by default**: others may not copy,
modify or distribute it. The options to decide between:

- **All rights reserved** (no licence file): you keep every right, and nobody may reuse the code without your permission.
- **An open-source licence** (for example MIT or Apache-2.0): others may reuse the code under its conditions. Choose this
  only if you are happy for the code to be reused.
- **Keep the repository private:** publishing the repository does not grant any licence, but it makes the code visible
  to everyone. The artwork and the content are copyright unless you say otherwise.

Dependencies carry their own licences; see [THIRD_PARTY_LICENSES.md](THIRD_PARTY_LICENSES.md).

## Android

Application ID: `com.pujasaathi.india`. Languages: Hindi and English.
