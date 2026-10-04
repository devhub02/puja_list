# Progress

Phases are defined in the project plan; this checklist tracks their status. Statuses are updated only after the work is done and its checks have been seen to pass.

- [x] **Phase 0 — Monorepo bootstrap and documentation** (done on branch `phase-0-setup`, not pushed)
- [ ] Phase 1
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
