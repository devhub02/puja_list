# Puja Saathi — Project Context (read at the start of every session)

## Product
Android app (Hindi + English now; more Indian languages later) that guides users through pujas and festivals across ALL of India: significance, samagri (Required / Commonly Used / Optional), step-by-step vidhi, preparation checklists, local reminders.
Tagline: "Har Puja Ki Samagri, Vidhi Aur Taiyari".
NOT: pandal finder, social app, online shop, priest booking, login/account-based app.

## Connectivity model: offline-first
- ALL puja content is bundled in the app (mobile/assets/puja_data/). Every feature works with no internet.
- The mobile app uses the network ONLY for AdMob ads + UMP consent (added in the ads phase). No accounts, no Firebase, no user data sent to any server.
- Ads never block a feature. Offline -> ad slot collapses (no fake ads). No ads inside vidhi steps or during active preparation. No forced ads to unlock content.
- Backend (Python) is, for now, LOCAL TOOLING: validates and exports content. An optional Content API (app downloads newer content/calendar years) is a later phase and must never be required for the app to work. Bundled content always remains the fallback.
- New content ships via app updates until the optional Content API phase exists.

## Tech stack
Monorepo:
- mobile/: TypeScript, React Native + Expo (latest stable SDK), Expo Router, Zustand, expo-sqlite + Drizzle ORM (FTS5 for Hindi/English search), MMKV or AsyncStorage for settings only, i18next + react-i18next, expo-notifications (reminders), react-native-google-mobile-ads (ads phase only; needs a development build, not Expo Go), Jest + React Native Testing Library. Package manager: npm. Node LTS. TypeScript strict mode.
- backend/: Python 3.11+, FastAPI, Pydantic (content schema is enforced here), SQLAlchemy + Alembic, SQLite for local dev (PostgreSQL only when deploying), pytest.
- content/: source-of-truth JSON for all puja content and calendar data.
- scripts/: validate content (Pydantic) and export to mobile/assets/puja_data/.
- docs/: CONTENT_SCHEMA.md, DB_SCHEMA.md, PROGRESS.md.
Use latest stable versions and verify they install and run. Ask before adding dependencies outside this stack.

## Repo layout
mobile/ (app/ = Expo Router screens, src/{components,db,store,i18n,services,ads,notifications,theme,utils}, assets/puja_data/), backend/ (app/{api,models,schemas,services}, tests/, alembic/), content/, scripts/, docs/, CLAUDE.md.
Never create empty placeholder files.

## Data flow
content/*.json (source of truth) -> Pydantic validation -> exported JSON in mobile/assets/puja_data/ -> loaded into phone SQLite on first launch or when contentVersion changes. Re-seeding must refresh content tables only and never delete user data (saved pujas, checklist progress, custom samagri, reminders).

## Content rules (MOST IMPORTANT)
- Accuracy over quantity. NEVER invent mantras, scripture quotes, rituals or exact quantities. Unknown -> "as needed" or omit.
- Every samagri item is exactly one of REQUIRED | COMMON | OPTIONAL. Never auto-promote optional to required. Each puja has its own list.
- Every puja has reviewStatus: ai_drafted | cross_checked | expert_verified, plus sourceNote. The UI shows a visible label for anything not expert_verified.
- Write in our own words; do not copy text from websites or books.
- Show regional/family differences as variations, never as the universal rule. Standard disclaimer (Hindi): "Vidhi aur samagri region, family tradition, sampradaya aur puja ke tareeke ke hisaab se alag ho sakti hai. Apni family tradition ke anusaar changes karein."
- All user-visible content uses locale maps ({"en": "...", "hi": "..."}); adding a language must need only new strings/content, no code changes. Fallback: selected language -> English.
- Coverage is all-India, added in batches (North, East, South, West, Central, North-East, Tribal/Regional, Vrat, Household, Life-cycle). Never claim the list is exhaustive.

## Calendar rules
Year-specific dates are stored separately from festival metadata, bundled and verified. NEVER compute lunar/tithi dates in code. If a date is unavailable show "date not available". Each date has a certainty field.

## UI
All UI work must use the `ui-ux-pro-max` skill and follow docs/DESIGN_SYSTEM.md (CLAUDE.md palette wins; React Native, not web).
Warm cream background, saffron/orange accents, deep maroon headings, subtle gold, rounded cards. Light + dark theme. Bundle Noto Sans Devanagari. No copyrighted artwork. Accessible contrast, large touch targets. Test on a real Android device or emulator.

## Privacy
Collect minimal data, no login. AdMob + UMP consent. Never claim "no data collected".

## Android specifics
Application ID: com.pujasaathi.app (cannot change after Play Store publish). Reminders: use inexact/scheduled local notifications; do not use exact-alarm permissions unless truly necessary. INTERNET permission only comes with the ads phase.

## Workflow rules
- Do ONLY the phase I ask for. Do not start the next phase.
- After each phase run the relevant checks: in mobile/ `npx tsc --noEmit`, lint, `npm test`; in backend/ `pytest`; plus `npx expo start` / prebuild check when relevant. Never say something passes unless you ran it and saw it pass.
- Update docs/PROGRESS.md, then commit on branch `phase-N-short-name`. Do not push.
- No "TODO / implement later" stubs. If something can't be completed, say so and give the closest working version.