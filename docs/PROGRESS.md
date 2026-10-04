# Progress

Phases are defined in the project plan; this checklist tracks their status. Statuses are updated only after the work is done and its checks have been seen to pass.

- [x] **Phase 0 — Monorepo bootstrap and documentation** (done on branch `phase-0-setup`, not pushed)
- [x] **Phase 1 — Design system, navigation, i18n, settings** (done on branch `phase-1-foundation`, not pushed)
- [ ] Phase 2
- [ ] Phase 3
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
