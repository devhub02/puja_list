# Progress

## Release preparation (master run, branch `phase-8-release`)

NEXT: stage 6 (final documentation). Stage 5 done; see the Stage 5 block. Open Stage 3 checks remain (see the Stage 3 block).

### Stage 0 — preflight: DONE
- `main` contains Phase 7 incl. fix `783d06a` (merge `58a453f`). `phase-8-release` created from `main`.
- node v24.19.0, JDK 17.0.20, ANDROID_HOME set, emulator-5554 online (Android SDK 35), Gradle/Maven/npm hosts reachable (HTTP 200).

### Stage 1 — package rename `com.pujasaathi.app` -> `com.pujasaathi.india` (in progress)
Done and verified:
- Search: class (a) hits changed in `mobile/app.json` (`android.package`), `README.md`, `CLAUDE.md`, `docs/PRIVACY_AND_ADS.md` (adb command). Not changed: display name, `pujasaathi` URL scheme, notification channel `reminders`, content ids, DB names, AdMob test IDs. Historical entries in this file keep the old ID on purpose.
- `npx expo prebuild --platform android --clean`: `namespace`/`applicationId` = `com.pujasaathi.india`; Kotlin dirs `com/pujasaathi/india`; nothing in `android/` references the old ID.
- Debug build `npx expo run:android --variant debug`: BUILD SUCCESSFUL (6m 10s). `aapt dump badging`: `package: name='com.pujasaathi.india' versionCode='1' versionName='1.0.0'`, label "Puja Saathi". `pm list packages`: new ID installed. Old app uninstalled (`Success`).
- First-launch check (fresh install, `pm clear` twice): splash -> Home with real content (Next festival Sharad Navratri, featured pujas, category row) on both runs. See the first-launch note below.
- CLEAN INSTALL: `rm -rf node_modules && npm ci` EXIT 0.
- `npx tsc --noEmit`: exit 0.
- `npm run lint`: exit 0 (after excluding the git-ignored local `.verify/` folder, see below).
- `npm run format:check`: exit 0 (after `endOfLine: auto`, see below).
- `npm test`: 51 suites / 697 tests passed (run alone; an earlier run under load had 14 timeouts, not logic failures).
- backend `pytest`: 139 passed (after the subprocess fix below). `scripts/validate_content.py`: content OK (contentVersion 6, 103 festivals, 16 pujas, 53 samagri, 1 calendar year).
- Dev-server bundle: `GET /node_modules/expo-router/entry.bundle?platform=android&dev=true&minify=false` -> HTTP 200, 10,563,390 bytes, 18.1 s, no Metro errors in the log. `npm ls metro @expo/metro-config`: `metro@0.84.5`, `@expo/metro-config@57.0.12`; no `metro*` in package.json.

Fixes made during Stage 1 (small, each justified):
- `backend/tests/test_export.py`, `backend/tests/test_calendar_dates.py`: the subprocess helpers pass `stdin=subprocess.DEVNULL`. Without it 3 tests failed on Windows with `WinError 6: The handle is invalid` (pytest's capture handed the child an invalid stdin handle). Same failure from PowerShell and Bash.
- `mobile/eslint.config.js`: ignore `.verify/*` (git-ignored local verification folder with a 10 MB bundle; it produced about 33,000 lint errors).
- `mobile/.prettierrc`: `"endOfLine": "auto"`. The repo stores LF but this Windows checkout has CRLF (`core.autocrlf=true`), so every file failed `format:check` with LF-only rules.
- `.gitignore`: `scratch-screens/` (emulator screenshots).

First-launch note (the "splash hang" investigated during Stage 1):
- It was NOT an app first-launch bug. The debug build loads JS from Metro. Metro on 8081 was hung (HTTP 000) after the first run, and the `adb reverse tcp:8081 tcp:8081` forward had been dropped. With a working Metro and forward the app logged `Running "main"`, requested the bundle and rendered Home (`isMetroRunning(): true`, `loadJSBundleFromMetro()`).
- Not done: the bisect with the old ID (old APK no longer built or installed). No reproduction on the new ID after a clean start, so there is nothing to bisect.
- Observed: Home showed "Loading..." in the featured area for a short time on the first run, then content. Not investigated further.

Not yet verified (Stage 1 remaining):
- Reminder check: PASSED on the emulator. Bhai Dooj, Start preparation -> Samagri -> Remind me -> 6 Oct 2026, 2:55 am (set about 1.5 minutes before the fire time, not the 2 minutes asked for) -> app permission explainer -> Android notification permission Allow -> "Reminder saved", switch On. App sent to the background. The alarm fired late: at device time 02:56 (it was due 02:55, and it was still pending and overdue at 02:55:40). Notification shown: "Puja Saathi - Bhai Dooj - Time to check your samagri checklist." Tapping it opened the Bhai Dooj Samagri checklist (0 of 9 checked, Required 0 of 4). Caveat: the emulator clock runs slower than wall time, so the one-minute delay is not confirmed as a real-device behaviour; inexact alarms can be delayed, which the app already warns about.
- Splash hang, root cause (verified): NOT an app bug. The debug build loads JS from Metro. Metro on 8081 had hung (HTTP 000 after the first run) and the `adb reverse tcp:8081 tcp:8081` forward had been dropped, so the app never got its bundle and the splash stayed up. With Metro answering and the forward set, the app logged `Running "main"` and rendered Home. No code fix was needed for this cause.
- Splash hardening (code change, separate from the cause): the splash gate waited on fonts, settings and the database with no time limit, so a stalled database open would hold the splash forever on any device. `useDatabaseInit` now times out after `DB_SETUP_TIMEOUT_MS` (20 s, `mobile/src/db/DatabaseProvider.tsx`): the hook moves to the error state, the splash clears and the translated Retry screen shows. Test: `__tests__/startup.test.tsx` > "useDatabaseInit timeout". Mutation check: with the timeout wrapper removed, that test fails (1 failed); with it, the file passes (8 of 8).
- Splash size fix: `imageWidth` 200 -> 140 in `mobile/app.json`. On Android 12+ only a circle of about 192 dp is visible; the artwork's opaque pixels reached 125 dp at 200 dp (cut off) and reach 87.5 dp at 140 dp (inside). Verified on the emulator: the full "PujaSaathi" wordmark is visible on cold start (screenshot taken 2 s after launch).
- Splash image: the splash now uses the owner's original `splash-icon.png` (1254 x 1254 RGBA, 1.5 MB) from commit `38f5f02`, not the optimised 64 KB copy. `docs/DESIGN_SYSTEM.md` records this as the one exception to the 150 KB image rule. `expo prebuild` regenerated the Android splash resources from it.
### Stage 3 — release build (in progress; NEXT: stage 3, continue)
Done and verified (run and seen):
- Release signing without secrets: `mobile/plugins/withPujaRelease.js` (Expo config plugin, survives `prebuild --clean`). Without the four Gradle properties, `assembleRelease` exits 1 with the names of the missing properties (ran, seen). Test builds were signed with a THROWAWAY key generated in `%TEMP%/puja-throwaway-keystore` (outside the repo). That folder is to be deleted at the end of Stage 3; passwords were only in that folder.
- Release build: `bundleRelease` and `assembleRelease` BUILD SUCCESSFUL (final build 22 min 22 s). versionCode 1, versionName 1.0.0, targetSdk 36, not debuggable. R8 (minify) and resource shrink enabled via plugin; mapping.txt produced (72.6 MB).
- Sizes (final build): APK `mobile/android/app/build/outputs/apk/release/app-release.apk` = 109,065,082 bytes (universal, 4 ABIs). AAB `.../bundle/release/app-release.aab` = 82,134,799 bytes.
- Permissions in the final release APK (`aapt dump permissions`): ACCESS_NETWORK_STATE, INTERNET, POST_NOTIFICATIONS, RECEIVE_BOOT_COMPLETED, WAKE_LOCK, com.google.android.gms.permission.AD_ID (all on the allowed list), plus accepted findings: ACCESS_ADSERVICES_AD_ID, ACCESS_ADSERVICES_ATTRIBUTION, ACCESS_ADSERVICES_TOPICS (from the Google Mobile Ads SDK / play-services-ads-api), FOREGROUND_SERVICE (from WorkManager), and our own DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION. Blocked via `android.blockedPermissions` (23 in the manifest, plus 3 more = 26): SYSTEM_ALERT_WINDOW, VIBRATE, READ_APP_BADGE, c2dm RECEIVE, launcher badge permissions, READ/WRITE_EXTERNAL_STORAGE, install-referrer binding. RECEIVE_BOOT_COMPLETED was NOT removed.
- AD_ID: confirmed present in the final merged release manifest and the built APK (source: play-services-ads-api via the Google Mobile Ads SDK). PRIVACY_AND_ADS.md still needs the "inferred / VERIFY" wording replaced (see Stage 4 items).
- 16 KB pages: `zipalign -c -P 16 4` on the APK: "Verification successful". ELF LOAD segments with llvm-readelf: all 64-bit libraries (arm64-v8a, x86_64) are 16 KB-aligned (0x4000). The 4 KB-aligned segments are only in 32-bit libraries (armeabi-v7a, x86), which the requirement does not cover.
- Play target API: read developer.android.com (2026-10-06): new apps and updates must target API 36 from 31 Aug 2026. Our targetSdk is 36.
- Fresh install, network ON, run 1: `pm clear`, `am start -W` TotalTime 10,993 ms (first launch after install; median of 5 NOT yet taken). Home appears (`rel_online_run1_after_wait.png`). An emulator "System UI isn't responding" dialog appeared and was dismissed with Wait (system process, not ours). Logcat FATAL EXCEPTIONs in this window belong to com.android.phone, networkstack, com.google.android.gms, systemui and quicksearchbox: none to com.pujasaathi.india.
- Scripts: `scripts/release-check.py` written (tests, content, export match, secret scan, APK permissions vs allowed + accepted, versionCode rule). NOT RUN END-TO-END YET.

Release measurements and checks (added after the first status block; release APK installed with `install -r`, debug app uninstalled first):
- Cold start with `am start -W` after `pm clear` + force-stop, network ON: 10,993 ms (first launch after install), 3,461, 7,744, 5,428, 3,674, 4,056 ms. Median of the six: 4,742 ms. Network OFF: 3,219 and 3,566 ms. Emulator numbers only (Pixel 9a AVD); a real phone will differ.
- Memory (`dumpsys meminfo` TOTAL PSS): baseline 169,701 KB; after a scripted 5-minute session (swipes and tab taps, network OFF) 206,430 KB (+36.7 MB). One run only; not a leak test.
- Fresh install with network OFF (`pm clear` then launch): Home appears (`rel_offline_run2.png`).
- Offline PASS on release: Library and English search "ganesh" (`rel_off_02_search.png`); Puja Details, Start preparation, samagri tick (`rel_off_04_samagri_tick.png`); Calendar month view (`rel_off_06_calendar.png`, no ad).
- Reminder on release, offline: set for 6 Oct 2026 10:05 AM at device 10:01 (about 4 minutes ahead, not 2: the picker's minute dial steps are 5 minutes). Alarm registered. The notification appeared about a minute late (device 10:06), "Ganesh Chaturthi Puja: Time to check your samagri checklist" (`rel_off_13_notif.png`). Tapping it opened the Ganesh samagri checklist with the earlier tick kept (`rel_off_14_notif_tapped.png`). So the reminder path works with VIBRATE and c2dm blocked.
- Logcat (release, this session): fatal exceptions were in system and Google processes only (com.android.phone, networkstack, com.google.android.gms, systemui, quicksearchbox), not in com.pujasaathi.india. An emulator "System UI isn't responding" dialog appeared once and was dismissed with Wait.
- Ads on release with network ON: Home showed no ad slot in the visible area (`rel_online_run1_after_wait.png`). Not yet checked by scrolling to the bottom of Home or Library, and not yet checked in logcat for ad messages.
- NOT yet verified on release: Vidhi reader offline (screenshot `rel_off_05_vidhi.png` taken, not yet reviewed), share sheet, Reset local data, Hindi, large text, 360 dp, TalkBack; debug dev menu still present (needs a debug rebuild); scripts/release-check.py run end to end; CLEAN INSTALL and the other checks; deletion of the throwaway keystore folder.

Decisions and investigations (Stage 3, second pass):
- Permissions: ACCESS_ADSERVICES_* (3), FOREGROUND_SERVICE and our DYNAMIC_RECEIVER permission are accepted; sources in docs/PRIVACY_AND_ADS.md. VIBRATE is UNBLOCKED (reminders vibrate). Release-check allowed list now includes VIBRATE. Still to do: rebuild the release APK with this change and re-test the 2-minute reminder on release.
- SIZE (measured on the current release APK/AAB, before any change):
  - APK 109,065,082 bytes: native libs 75.2 MB raw across 4 ABIs (x86 23.1, x86_64 22.6, arm64-v8a 22.1, armeabi-v7a 15.2); dex 20.3 MB raw (8.3 compressed); JS bundle (Hermes) 3.9 MB; images 3.1 MB; fonts 5.8 MB raw (2.8 compressed); resources 2.2 MB.
  - AAB 82,134,799 bytes: includes BUNDLE-METADATA with native debug symbols (*.so.sym, about 10 MB raw per ABI, about 11 MB compressed in total) and proguard.map (6.8 MB compressed). These are Play crash-symbolication metadata and are NOT delivered to devices. Not removed: removing them would make Play crash reports unreadable.
  - Fonts: 26 files. Our text fonts are Nunito Sans and Noto Sans Devanagari (about 1.1 MB raw, kept). The rest is icon fonts from @expo/vector-icons (about 4.3 MB raw, 14 icon sets; we use Material Community Icons) and Material Symbols from expo-google-fonts (0.97 MB raw). Trimming those needs a dependency or plugin change: NOT done, needs your decision.
  - ABI restriction to arm64-v8a and armeabi-v7a: NOT applied globally, because the x86_64 emulator used for testing needs x86_64 libraries. Option: release-only ABI split, to decide.
  - bundletool: not installed here, so per-device sizes are NOT measured. Rough estimate for an arm64 phone from the APK parts: about 42 MB compressed (not measured).
  - Before/after: no size change was applied in this pass.
Final-build results (third pass, 2026-10-06):
- FONT TRIM: applied, measured, then REVERTED. Measured in the AAB: raw 5.77 MB -> 3.13 MB (saving 2.64 MB), but compressed (what Play downloads) 2.77 MB -> 1.39 MB (saving 1.38 MB), below the 2 MB rule. Icon screenshots (Library, Calendar, Settings, Samagri, Puja Details, search, Vidhi, Home tab bar) showed no broken icons, but the rule failed, so the change was reverted (`mobile/app`, `mobile/src`: restored to HEAD).
- ABI PLUGIN: DROPPED as decided. The release plugin is back to its committed version (signing and R8 and blocked permissions only). Build docs for the two build commands removed. The `ndk.abiFilters` and packaging excludes did not filter the core React Native libraries (six per ABI remained), so they were not kept.
- Final release build (clean prebuild, default ABIs): `bundleRelease` BUILD SUCCESSFUL (17 min 5 s); `assembleRelease` BUILD SUCCESSFUL (1 min 36 s).
  - AAB `mobile/android/app/build/outputs/bundle/release/app-release.aab`: 82,134,821 bytes; ABIs arm64-v8a, armeabi-v7a, x86, x86_64.
  - APK `mobile/android/app/build/outputs/apk/release/app-release.apk`: 109,065,094 bytes; same four ABIs.
  - Permissions in the final APK (aapt): INTERNET, ACCESS_NETWORK_STATE, WAKE_LOCK, POST_NOTIFICATIONS, RECEIVE_BOOT_COMPLETED, VIBRATE, AD_ID (allowed list); ACCESS_ADSERVICES_AD_ID, ACCESS_ADSERVICES_ATTRIBUTION, ACCESS_ADSERVICES_TOPICS, FOREGROUND_SERVICE, DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION (accepted). Nothing else. Blocked: SYSTEM_ALERT_WINDOW, READ_APP_BADGE, c2dm RECEIVE, launcher badges, storage, install referrer.
  - 16 KB: `zipalign -c -P 16 -v 4` on the final APK: "Verification successful".
  - targetSdkVersion 36; versionCode 1; versionName 1.0.0.
- Per-device download size: `bundletool get-size total` NOT run (bundletool is not installed here; COULD-NOT-VERIFY). The commands are in docs/RELEASE.md.

Stage 3 closing verification (final build, 2026-10-06):
- release-check.py (--skip-tests; tests run separately below): PASSED. Content OK; exported content.json matches the committed bundle; no secret-like files tracked; 12 APK permissions, all allowed or accepted; versionCode 1 (no previous release recorded).
- Clean install: `rm -rf node_modules && npm ci` exit 0; tsc exit 0; lint exit 0; format:check exit 0 (after formatting plugins/withPujaRelease.js); npm test: 709 of 709 PASSED when run with --runInBand. Parallel run had 16 timeouts (5 s Jest limit under load), no assertion failures.
- Backend: pytest 139 passed; validate_content.py OK (contentVersion 6, 103 festivals, 16 pujas, 53 samagri).
- Dev-server bundle: `expo start --clear` (CI=1); Android entry bundle HTTP 200, 10,563,390 bytes. node v24.19.0; metro@0.84.5, @expo/metro-config@57.0.12.
- Throwaway keystore: folder and props file deleted; no PUJA_RELEASE_* variables set in the environment.
- Button-row fix: My Preparation and Samagri header/action row use ButtonRow; 8 tests pass (buttonRows, samagriButtonRows), each failing on the old layout. Rule recorded in docs/DESIGN_SYSTEM.md. Before/after device screenshots: NOT taken on the final build.
- NOT verified in this stage: reminder re-test with VIBRATE (attempt to set the time via the picker failed; no reminder was saved); startup runs (5 ON, 5 OFF) and phase breakdown; fresh-install repeats; offline review (Vidhi, share, reset, Hindi, large text, 360 dp, TalkBack); ads check on Home and Library; debug dev menu check; reminder sheet and Vidhi audit. These stay open for the next session.

NOT yet done on the final build: reminder re-test with VIBRATE unblocked, startup runs (5 ON, 5 OFF) and phase breakdown, fresh installs twice ON and OFF, offline review (Vidhi, share, reset, Hindi, large text, 360 dp, TalkBack), ads check on Home and Library, debug dev menu, release-check.py, CLEAN INSTALL checks, throwaway keystore deletion, Stage 4.
Layout defect found (not fixed): My Preparation buttons "Checklist" and "Vidhi" wrap mid-word at the current text size (screenshot icon_06_my_prep.png). Open issue.

Not done yet in Stage 3 (continue here):
1. Fresh install run 2 with network ON; then both runs with network OFF (`svc wifi disable; svc data disable`), with `pm clear` each time and `am start -W`. Median of 5 cold starts; `dumpsys meminfo` after a 5-minute session.
2. OFFLINE review on the release build: Library, search EN and HI, Puja Details, samagri ticks, vidhi, calendar, create a preparation, a reminder 2 minutes ahead (fires and opens the checklist; the release build also needs the reminder re-test because blocked permissions include VIBRATE and c2dm), share sheet, Reset local data. Ad slots must be absent.
3. ONLINE on release: ads must stay disabled (empty real IDs): no test ad, no placeholder, no crash.
4. Debug build keeps its dev menu: verify (blockedPermissions also apply to debug manifests; not checked yet).
5. Accessibility on release: large text, 360 dp, TalkBack labels; fix cheap clear problems; list the rest.
6. Run `python scripts/release-check.py` end-to-end; plus CLEAN INSTALL, tsc, lint, format:check, npm test, pytest, validate_content, dev-server bundle check.
7. Delete the throwaway keystore folder and the props file after the last test build.
8. Open decisions for the owner: keep or block ACCESS_ADSERVICES_* and FOREGROUND_SERVICE (ads / WorkManager); the reminder vibration pattern no longer vibrates without VIBRATE (behaviour change, no code change made).
### Stage 2 — CI and quality pass (in progress)
Done:
- `.github/workflows/ci.yml` (mobile: npm ci, tsc, lint, format:check, npm test on Node 22; backend: pip install, pytest, validate_content on Python 3.12). Not run on GitHub: it runs after the branch is pushed. Locally: backend steps passed in a fresh venv (139 tests, content OK) on Python 3.14 only; the 3.12 and Node 22 runs are unverified locally.
- `mobile/.prettierignore`: `android`, `ios`, `.verify` added. Formatting was NOT rewritten repo-wide: `format:check` passes without changes.
- `mobile/__tests__/repoSecrets.test.ts`: fails if a `.keystore`, `.jks` or `google-services.json` is tracked, or a real AdMob publisher id is in any tracked text file. Verified by tracking a fake keystore and a fake id: both reported, then removed.
- Splash: see the splash entries above.
Coverage review (areas from the brief): covered by existing tests: content pipeline (seed, bundled content, export), DB and migrations 0002-0004, search, preparation/checklist, vidhi, calendar, reminders, share (My Preparation and Samagri dialogs), reset (`resetLocalData.test.ts`), ads (consent, placement, forbidden screens, offline fail-closed), settings, startup. Gaps not covered by automated tests: 360 dp layout and largest OS font (visual only, not automated); TalkBack behaviour (labels asserted in component tests, not read by a screen reader); Hindi typing in the search field on the emulator (adb cannot type Devanagari); real notification delivery timing (see the reminder check).
Emulator review, network OFF (debug build): NOT VERIFIED. The debug build could not load its JavaScript with Wi-Fi and mobile data off ("Unable to load script", Metro unreachable), even with `adb reverse tcp:8081 tcp:8081` set. With Wi-Fi back on it loads Home normally. So the offline check of the app itself must use a release build (no Metro), in Stage 3.
Emulator review, network ON (debug build): Home loads with the test ad slot labelled "ADVERTISEMENT". Not yet walked through every screen.
Online walk-through, debug build, Wi-Fi on (screenshots in the git-ignored `scratch-screens/`, each one looked at):
- Home (light): PASS. `t05_home_scrolled.png`: "ADVERTISEMENT" label above Google's test banner.
- Home (dark): PASS for the palette. `t18_home_dark.png`: the test banner is white (that is Google's creative, not our styling).
- Library (light): PASS for content. `t02_library.png`, `t03_library_scrolled.png`: no ad seen in rows 1-16 that were scrolled through. NOT VERIFIED: the inline ad after row 8 never appeared, so its cadence is unconfirmed (no-fill or a bug is not established).
- Library (dark): PASS. `t19_library_dark.png`.
- Puja Details: PASS, no ad in the visible area. `t09_puja_details.png` (rest of page not scrolled).
- Vidhi reader: PASS, no ad. `t10_vidhi.png`.
- Samagri checklist: PASS, no ad. `29_tapped_notif.png`.
- My Preparation: PASS, no ad (empty state, data had been cleared). `t11_my_preparation.png`.
- Reminder sheet: PASS, no ad. `11_reminder_sheet.png`. Manage reminders screen: COULD-NOT-VERIFY (not opened in this pass).
- Settings (English): PASS, no ad; About ads card present. `t14_settings_en_scrolled.png`. Settings (Hindi): COULD-NOT-VERIFY (not switched).
- Calendar (month): PASS, no ad. `t12_calendar.png`. All festivals: PASS, no ad. `t16_festival_details.png`.
- Festival Details (Mysuru Dasara): PASS, no ad. `t17_festival_row_tap.png`. Dark view was checked on screen, but its screenshot file was overwritten by the Home dark capture: not kept as evidence.
- Hindi on Home and Library: COULD-NOT-VERIFY (language not switched in this pass).
- Large text size on Home and Library: COULD-NOT-VERIFY (not set in this pass).
- Ad rule ("no ad except Home and Library"): every screen above that was checked shows no ad. The forbidden-screen source test (`noAdsInForbiddenScreens.test.ts`) also passes.

Logcat for this session (debug build):
- No `FATAL EXCEPTION` for `com.pujasaathi.india`.
- One ANR for `com.pujasaathi.india` (`MainActivity`) at 03:32:40, during the network-off attempt when the debug build could not reach Metro. Not reproduced online.
- ReactNativeJS warnings "Cannot connect to Expo CLI" at 03:32 (same offline attempt).
- ANRs for the launcher, System UI and input (emulator processes, not ours) at 03:31-03:32.
- AdMob/UMP: no ad load error for our app was visible in logcat. The Home test banner rendered, which means the ad loaded. The AdSlot shows its label only after a successful load.

Cheap accessibility fixes: none made in this pass (no defect was found in the screens above). Not checked in this pass: touch-target sizes below 48 dp, TalkBack labels on each control, text clipping at the largest size. These stay open for Stage 3.

Backend and Python (CI uses 3.12, local tests ran on 3.14): `backend/requirements.txt` pins every package exactly (alembic 1.20.0, fastapi 0.142.2, httpx 0.28.1, pydantic 2.13.5, pytest 9.1.1, SQLAlchemy 2.1.3, uvicorn 0.54.0). A fresh venv from those pins installed and passed (139 tests, content OK) on 3.14. I did not audit the code for 3.14-only features, and I did not run 3.12 locally. Nothing found so far depends on 3.14 behaviour; CI is the first real 3.12 run, after the push.

Moved to Stage 3 (explicit): (1) the OFFLINE review on the RELEASE build (no Metro); (2) the fresh-install check on the release build: `adb shell pm clear com.pujasaathi.india`, launch, Home appears, twice in a row, with network ON and OFF; (3) cold start (`am start -W`), memory after a long session and APK/AAB size, all on the release build. No cold-start, memory or size numbers were taken on the debug build. (4) Accessibility items left open above.

Still to do in Stage 2: the rest of the emulator review (screens, logcat FATAL/ANR, ad errors), performance (cold start with `am start -W`, memory, APK size) and accessibility checks.
- Stage 1 status: COMPLETE. All Stage 1 checks passed (see above) and the reminder check passed with the caveat.

Phases are defined in the project plan; this checklist tracks their status. Statuses are updated only after the work is done and its checks have been seen to pass.

- [x] **Phase 0 — Monorepo bootstrap and documentation** (done on branch `phase-0-setup`, not pushed)
- [x] **Phase 1 — Design system, navigation, i18n, settings** (done on branch `phase-1-foundation`, not pushed)
- [x] **Phase 2 — Content schema validation, export pipeline, phone database** (done on branch `phase-2-data-layer`, not pushed)
- [x] **Phase 3, Batch 1 — Bundled puja content, pan-India core pujas** (merged to main)
- [x] **Phase 3, Batch 2 — Bundled puja content, East India and festival-family pujas** (done on branch `phase-3-batch-2`, not pushed)
- [x] **Phase 4 — Home, Library, Search, Puja details** (done on branch `phase-4-browse`, not pushed; **not yet checked on a device or emulator**)
- [x] **Phase 5 — Samagri checklist, Vidhi steps and My Preparation** (see its section below)
- [x] **Phase 6A — Festival catalog and calendar-date import pipeline** (merged to main)
- [x] **Phase 6B — Calendar tab, Home upcoming festivals, next-date display** (done on branch `phase-6b-calendar`, not pushed; **not yet checked on a device or emulator**)
- [x] **Phase 6C — Local reminders, notification settings, reset local data, share checklist** (merged to main)
- [x] **Phase 7 — AdMob + UMP consent** (done on branch `phase-7-ads`, not pushed; verification pass below: real debug build installed and launched on an emulator; the banner itself has not been seen rendering yet)
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

### Phase 6A follow-up: 6-column calendar CSV (`phase-6a-csv-simplify`)
- `calendar_dates.csv` now has `festival_id, festival_name_en, year, date, end_date, certainty`. The template and importer use it; `region` is always `all` in the generated year files and no `source` is written. Duplicate rule: one filled row per festival and year. Legacy `region`/`source_note` columns are ignored if present.
- Schema: `CalendarEntry.source` is optional. Mobile: `source` is optional in the types; the seed stores a missing source as `''` (the column is NOT NULL, no migration) and the repository returns it as `undefined`; a missing `region` is stored as `all`.
- The filled CSV uses certainty values `high`/`medium`/`low`/`regional_variation`, which are not in the `DateCertainty` enum (`confirmed`, `provisional`, `varies_by_region`), so the import rejects those 25 rows. No value was remapped.


## Phase 6B status — Calendar tab, Home upcoming festivals, next-date display

### Data decision (made by you, applied by me)
`content/calendar/calendar_dates.csv` used certainty values outside the schema enum, so the import rejected all 25 filled rows. **You decided this mapping** (the schema enum was NOT changed) and I applied it to the `certainty` column only (date, end_date, festival_id and year were not touched; checked row by row against `git show HEAD:...`):

| In the CSV before | Now | Rows |
|---|---|---|
| `high` | `confirmed` | 16 (18 `high` rows, 2 overridden below) |
| `medium`, `low` | `provisional` | 6 (5 `medium` + 1 `low`) |
| `regional_variation` | `varies_by_region` | 1 (`fest_durga_puja`) |
| `high` overridden to `provisional` | `provisional` | 2 |

**Overridden rows** (your rule: if the mapped value conflicts with the guide, use the more conservative `provisional` and list it). Section 4 of `CALENDAR_DATA_GUIDE.md` says a festival that is kept on different days in different regions, and festivals without a single annual date, should not be presented as a plain confirmed date:
- `fest_karthigai_deepam` (2026-11-24): `high` -> `provisional`, because its catalog `dateType` is `regional` (set by a regional calendar).
- `fest_tulsi_vivah` (2026-11-21): `high` -> `provisional`, because its catalog `dateType` is `variable` (no single annual rule; the guide says such festivals "often have no single date").

Not a conflict, but you should know: the guide defines `confirmed` as "checked against a named authoritative source". The repository stores no source (by design), so I could not check that for any of the 16 `confirmed` rows; that rests on your decision that `high` means that. Several `confirmed` rows are for `lunar` festivals that some regions keep on another day (for example `fest_mysuru_dasara`, `fest_navratri`, `fest_dussehra`); if you know any of them differs by region, change that cell to `varies_by_region` or `provisional` and re-run the import.

Import result: **25 dates imported, all in 2026; none in 2027** (the 2027 rows are empty). Month range with data: **October 2026 (first date 2026-10-11) to December 2026 (last date 2026-12-23)**; by start month: October 7, November 15, December 3 (dates entered by you, not checked by me). `contentVersion` bumped 5 -> 6 (manifest `calendarYears` is now `[2026]`). Certainty in the bundle: 16 `confirmed`, 8 `provisional`, 1 `varies_by_region`.

### Done
- **Date utilities** (`src/utils/dateUtils.ts`, pure): `isLeapYear`, `daysInMonth`, `parseIso`/`toIso`, `weekdayOf` (UTC arithmetic, no time zone), `localIsoDate` (the one place the device clock is read), `addMonths` (year boundaries both ways), `monthGrid` (whole weeks, configurable week start, neighbour padding), `lastDay`/`isInRange`/`isMultiDay`/`rangeLength` (`end_date` equal to `date` or missing = one day). Nothing computes a festival date or tithi.
- **Repositories** (`src/db/repositories/calendarRepository.ts`): `listDatesForMonth` (includes a festival that started in the previous month), `listUpcomingFestivals` / `listNextDates` (one entry per festival, ongoing ones included, deprecated ones never), `getNextDate`, `listFestivalsWithoutDate(year)`.
- **Calendar tab** (5th tab, between Library and My Preparation): Month view (7-column grid, dot per single-day festival, a bar through every day of a multi-day festival, ring on today, filled selected day, month arrows, "Today" button that also selects today, tap a day to list its festivals, tap it again to go back to the month list) and **All festivals** view (grouped by month of the shown year, with year arrows, plus a "Date not available" section with every festival that has no date that year). Region chips (All India + only regions present in the catalog) and category chips; "Clear filters"; a visible translated panchang note; the shared `SearchBar` searches English and Hindi names and alternate spellings, in both views.
- **Festival rows** (`FestivalRow`): name, date or range, a visible certainty label, the review badge, "Mainly observed in: ..." (from `festival.regions`), "Ongoing" for a multi-day festival that is on now. One linked active puja opens that puja; no puja (calendar-only) **or several linked pujas** open the new **Festival Details** screen (`app/festival/[id].tsx`: description, significance, observance wording, bundled dates with certainty, regions and states, linked pujas, review badge and explanation, source note, standard disclaimer).
- **Home**: "Upcoming festivals" (next 5 festivals from today's device date, ongoing included, with date/range and certainty label) and a "See calendar" link; the whole section is hidden when there is no upcoming bundled date (also while loading or on error).
- **Puja Details**: "Next date" with certainty label only when the linked festival has an upcoming or ongoing bundled date; otherwise nothing about dates. The old "When is it observed? / Date not available" block was **removed** (that is what your brief asks for, and it changed one earlier test).
- **Library cards**: a light caption "Next: 8 Nov 2026 · Date confirmed" when the puja's festival has an upcoming date.
- **Certainty labels**: `src/utils/certainty.ts` is the single mapping from the schema values to translated labels; any other value gets the neutral label "Certainty not stated" / "निश्चितता का उल्लेख नहीं" (tested with an invented value and with `constructor`/`__proto__`).
- **Strings**: English and Hindi (`calendar.*`, `festival.*`, `festivalRegions.*`, `festivalCategories.*`, Home and Library keys). Month and day names come from `Intl` in the selected language. Hindi uses "तारीख़" for dates (as in the earlier phases).
- Refactors: `ChipRow` moved out of the Library screen into a shared component; `useDbQuery` is a small keyed async-read hook (no setState inside effects) used by the new hooks.

### Decisions to know about
- Regional scope comes only from the festival catalog; dates carry no region and none is invented.
- Days of the neighbouring months are left blank in the grid (the bundle is queried per month, so they would wrongly look like "no festival").
- "Date not available" section and the month-has-no-data note are separate: the note says the bundle has no date in that month at all (before any filter); an empty list under a filter says "No festivals match" instead.
- The year of the All view follows the month navigation (arrows change the year), so every year is reachable but only 2026 has data.
- Week starts on Sunday (the grid takes a week-start parameter; there is no setting for it yet).
- Today's date is read when the screen opens and again when the app returns to the foreground; a screen left open past midnight is not refreshed until then.
- Tests that depend on "today" mock `localIsoDate` (`testing/dateMock.ts`); fixtures are in `testing/calendarFixture.ts` (2031 dates, labelled TEST FIXTURE, not real dates).

### Changes to earlier tests (all other earlier tests unchanged and passing)
- `pujaDetails.test.tsx`: the assertion that "Date not available" is shown now asserts "Next date" with a fixture date, and two new tests check that nothing about dates is shown with no/over dates (the brief changed that behaviour).
- `libraryScreen.test.tsx`: the Home test that checked "no Upcoming section" now seeds with `calendar: []` (the shared fixture contains a 2031 date, so Home would legitimately show it).
- `tabs.test.tsx`: five tabs instead of four, plus a test that the Calendar tab opens.

### Verified (run for real in this phase; Node v22.22.0)
- backend: `pytest` **139 passed**; `scripts/import_calendar_dates.py` OK (25 dates, wrote `calendar/2026.json`); `scripts/validate_content.py` OK (contentVersion 6, 103 festivals, 16 pujas, 53 samagri, 1 calendar year); `scripts/export_content.py` OK.
- mobile: `npx tsc --noEmit` clean; `npm run lint` clean; `npm run format:check` clean; `npm test` **33 suites / 501 tests passed** (was 27 / 405; new: dateUtils, calendarRepository, calendarLogic, calendarScreen incl. Festival Details, homeUpcoming incl. Library next date, calendar.realContent); `npx expo export --platform android` OK (4.3 MB hbc).
- Real-content tests (exported `content.json`): 25 dates in 2026 only, Diwali on 2026-11-08, Chhath 2026-11-13 to 2026-11-16 (rendered in the grid with a bar on the 13th to 16th), 78 festivals "Date not available" for 2026 and all 103 for 2027, Calendar/Festival Details/Home/Puja Details render in English and Hindi.
- dev server: `CI=1 npx expo start --clear`, `curl` of `expo-router/entry.bundle?platform=android&dev=true&minify=false` returned **HTTP 200** (1816 modules, 9.5 MB, 18 s). The only line containing "ERROR" in the server log is React Native DevTools failing to install ("Running as root without --no-sandbox"), which is a sandbox limitation, not a bundling error. `npm ls metro @expo/metro-config`: `metro@0.84.5`, `@expo/metro-config@57.0.12`; no `metro*` in package.json.
- The first full `npm test` run right after `npm ci` had 3 failures in the Samagri/Puja suites (while npm was still busy); the same tests passed on every later run, including the final one.

### Not verified
- `npx expo-doctor`: 19 of 21 checks pass; the two failures (Expo config schema, React Native Directory) are "Host not in allowlist" from the sandbox proxy, the same as in earlier phases.
- Nothing was run on an emulator or device. Specifically unverified: the grid at 360 dp (a day cell is 48dp tall but only about 47dp wide: seven columns inside the 16dp gutters; the touch target is a hair under 48dp wide), five tab labels at 360 dp ("My Preparation" is the longest), the largest OS font size, Hindi month/weekday names from Hermes `Intl` (tests ran on Node's full ICU, Android may abbreviate differently), scroll smoothness of the lists on a low-end phone, TalkBack reading of the day cells.

### What to verify by hand on the emulator / phone
1. Calendar tab: opens on the current month. Go to **November 2026**: dots/bars appear; Diwali on the 8th (also Kali Puja), Dhanteras 6th, Bhai Dooj and Chitragupta Puja on the 11th, **Chhath is a bar from the 13th to the 16th**; tap the 14th: only Chhath is listed; tap it again: whole month. October and December have data; **April 2026 and every month of 2027 show "Dates for this month are not available in this version" with the grid still visible**.
2. "Today" jumps back to the current month and selects today. Month arrows work across December -> January.
3. Region chips: choose South India: pan-India festivals still show, North-only ones go away. Category chips. "Clear filters" restores everything. Search "diwali", "दीवाली" or a Hindi name; clear it.
4. **All festivals**: 2026 shows months October to December and a long "Date not available" list; arrow to 2027: the "not available in this version" note and every festival in "Date not available". Nothing is hidden.
5. Row details: certainty label wording (confirmed / provisional / varies by region), "AI draft" badge, "Mainly observed in". Tap a festival with a puja guide (for example Diwali -> opens the puja); tap one without (opens Festival Details: description, regions, dates, disclaimer, back button).
6. Home: "Upcoming festivals" with at most 5 rows and "See calendar" (opens the Calendar tab). **Change the phone's date to after 23 December 2026 and reopen: the section must disappear completely.** Puja Details of a puja whose festival has a date shows "Next date"; others show nothing about dates. Library cards show "Next: ...".
7. Hindi and English, light and dark, largest text size, at 360 dp: the grid numbers, the five tab labels, long festival names, Devanagari not clipped in the search field.
8. TalkBack: a day announces its date, number of festivals and "today"; the month title is announced when it changes; rows read name, date and certainty.
9. Airplane mode: everything works (no network use was added).
10. Check the two overridden rows and the 16 `confirmed` rows in `calendar_dates.csv` against your sources.


### Phase 6B follow-up: compact Home "Next festival" (`phase-6b-home-fix`)
Problem: the Home "Upcoming festivals" section was 5 tall cards that pushed Featured pujas down, showed overlapping ranges that looked contradictory, repeated the "AI draft" badge and led with a regional festival (Mysuru Dasara).

Changed (Home only):
- **One "Next festival" hero card** (`NextFestivalCard`): name, date or range, a countdown pill, the certainty label. **No review badge.** Whole card is one button (min 48dp, label "Next festival: <name>. <date>. <countdown>. <certainty>."). It opens the linked puja when exactly one active puja is linked, otherwise Festival Details (same rule as the Calendar).
- **Ranking** (`pickNextFestival` in `src/utils/upcoming.ts`, pure): candidates are festivals whose last day (end date, else date) is today or later, so an ongoing festival counts; earliest start date wins; ties: (a) has a linked puja guide, (b) `pan_india` in `festival.regions`, (c) English name (then date id, so the result is stable). On the real data with today 2026-10-05, Sharad Navratri and Mysuru Dasara both start 2026-10-11 and Sharad Navratri wins (tested against the exported `content.json`).
- **Countdown** (`countdownFor`, plain calendar dates, no time zones): `Starts today` (first day, single or multi-day), `In 1 day`, `In N days`, `Ongoing`; Hindi: `आज से शुरू`, `1 दिन में`, `N दिन में`, `चल रहा है`.
- **See calendar row** directly under the card (a link, min 48dp) opens the Calendar tab and, when above zero, says "N more in the next 30 days" / "अगले 30 दिनों में N और पर्व". `countMoreSoon`: other festivals (the hero excluded) that start on or before today + 30 days and are not over (an ongoing one counts), each festival once, only bundled dates. Zero hides the count; the link stays. With today 2026-10-05 the real data gives 7.
- The section title, its description and the 5-row list are gone (less height, so Featured pujas is much closer to the top). Removed strings `home.upcomingTitle` / `home.upcomingDescription`; `FestivalRow` lost its now-unused `compact` prop. `useUpcomingFestivals()` now returns one next-date entry per festival (no limit); `listUpcomingFestivals` stays in the repository (tested) but the app no longer calls it.
- New pure helpers `daysBetween` and `addDays` in `dateUtils`.

Where the review-status ("AI draft") badge still appears: Puja Details, Samagri screen header, Festival Details, Library and Search puja cards (`PujaCard`, when not expert verified), and the Calendar festival rows (month list and All festivals). It no longer appears on Home.

Judgement call: a one-day festival that falls today also reads "Starts today", as you specified (no separate "Today" wording).

Tests: new `upcoming.test.ts` (ranking incl. tie on start date, ongoing, last day, no linked puja, only a regional festival; countdowns incl. month/year/leap boundaries; the 30-day count incl. no double counting and zero); Home tests rewritten for the single card (no badge, countdown, count hidden at zero, opens puja or Festival Details, Hindi); real-content test for Sharad Navratri on 2026-10-05. All earlier tests pass.

Verified (real output; Node v22.22.0): `npx tsc --noEmit` clean; `npm run lint` clean; `npm run format:check` clean; `npm test` **34 suites / 525 tests passed**; `npx expo export --platform android` OK (4.3 MB hbc); dev server `CI=1 npx expo start --clear` + curl of the Android bundle: **HTTP 200** (1818 modules, 9.5 MB); the only "ERROR" line is React Native DevTools failing to install as root (sandbox). `metro@0.84.5`, `@expo/metro-config@57.0.12`; no `metro*` in package.json; no dependency changed.

Not verified: nothing was run on an emulator or device. Check by hand: that Featured pujas is visible without scrolling far on a 360dp phone; the hero at the largest text size (name wraps to 2 lines, the pill and the "N more" line wrap); Hindi countdown wording; light and dark; TalkBack reads the card as one button.



## Phase 6C status — local reminders, notification settings, reset local data, share checklist (`phase-6c-reminders`)

Everything below was built and unit/UI-tested; **nothing was run on an emulator or device**, and a real notification was never fired (see "Not verified").

### Platform findings (step 1, checked before coding)
`docs.expo.dev` is blocked in this sandbox, so the Expo documentation was read through Context7 (the Expo SDK docs for `expo-notifications`) and the installed package source (`expo-notifications` 57.0.21).
- **Expo Go:** local scheduled notifications still work in Expo Go on Android; only remote push was removed from Expo Go (SDK 53). The package prints a "not fully supported in Expo Go" warning. So the reminders can be tried in Expo Go; a development build is the more faithful test (see below).
- **Permission (Android 13+):** `POST_NOTIFICATIONS` is runtime-requested through `requestPermissionsAsync()`, and the system dialog does not appear until at least one notification channel exists. The app creates the channel first, then asks. The library manifest declares `POST_NOTIFICATIONS` and `RECEIVE_BOOT_COMPLETED`.
- **Reboot:** the library's manifest registers a boot receiver (`BOOT_COMPLETED`, `REBOOT`, `QUICKBOOT_POWERON`, `MY_PACKAGE_REPLACED`) that re-creates stored scheduled notifications. The app also reconciles at every start.
- **Alarm type:** a DATE trigger is set with `AlarmManager.setAndAllowWhileIdle` (INEXACT, `RTC_WAKEUP`). `ExpoSchedulingDelegate.setupAlarm` switches to `setExactAndAllowWhileIdle` only if `canScheduleExactAlarms()` is true, which needs `SCHEDULE_EXACT_ALARM` in the manifest. This app never declares it and neither does any installed library (grepped every installed Android manifest), so reminders are inexact and Android may delay them. That is why the battery note is shown.
- **Sandbox limits:** `npx expo install` could not reach Expo's API (proxy 403), so the SDK-57 pinned versions were read from `node_modules/expo/bundledNativeModules.json` and installed with npm: `expo-notifications` `~57.0.21` and `@react-native-community/datetimepicker` `9.1.0`. `expo-doctor` passes its "packages match the SDK" check with them.
- **Date/time picker package:** Android has no JS-only picker, so the standard `@react-native-community/datetimepicker` is used (Android dialogs via `DateTimePickerAndroid.open`, works in Expo Go). I installed it as you allowed; it is the only new dependency besides `expo-notifications`.

### Done
- **Data**: migration `0004_reminders` (generated by drizzle-kit, SQL rewritten by hand, snapshot is the generated one, `drizzle-kit generate` says "No schema changes"). New `reminder` table owned by a preparation (cascade), local `scheduled_at` string convention, `paused_reason`, `completed_at`, UNIQUE (preparation, time). The old Phase 2 `reminder` table was never written by any code, so its (empty) content is replaced. Documented in `docs/DB_SCHEMA.md` §3.2 and §7.2.
- **Logic** (`src/notifications/`): `scheduler.ts` (the interface), `expoScheduler.ts` (the only `expo-notifications` file besides `install.ts`), `reminderService.ts` (create/update/enable/disable/delete/reconcile, one lock), `permissionFlow.ts`, `runtime.ts` (language, text, clock, switch), `NotificationRouter.tsx` (reconcile after the first frame and on returning to the foreground, tap handling, vidhi-reader quiet mode). Pure helpers: `utils/reminderTime.ts`, `utils/reminderDisplay.ts`, `utils/shareChecklist.ts`.
- **UI**: `ReminderSheet`, `ReminderRow`, `ReminderDialogs`, Manage reminders screen (`app/reminders.tsx`), "Remind me" + share in the Samagri header, reminder bell and "Share checklist" on My Preparation cards, Manage reminders link, Settings Notifications section, Reset local data dialog (typed `RESET`), `ShareChecklistDialog` (React Native's built-in `Share`).
- **Settings store**: `notificationsEnabled` (default on, persisted, ignores a non-boolean saved value).
- **Strings**: English and Hindi for everything (`reminders.*`, `share.*`, `settings.notifications.*`, `settings.reset.*`).
- **Docs**: `docs/DB_SCHEMA.md`, `docs/DESIGN_SYSTEM.md` (Phase 6C section, including which skill queries had no match).

### Reconcile rules (also in DB_SCHEMA §3.2)
Run after the first frame at start and on every return to the foreground; idempotent; serialised with create/update/delete. If the OS list cannot be read, nothing happens. Per reminder: past and not done -> mark done and cancel; done -> nothing scheduled; switched off by the user -> cancel; global switch off or no permission -> cancel and mark paused (row kept); otherwise keep a correct OS entry or cancel the stale one and schedule a new one (OS refusal -> `schedule_failed`, retried next time). Finally every OS notification no reminder points to is cancelled. Turning the global switch off cancels everything but keeps the reminders; turning it on asks for permission if needed and reconciles.

### Decisions to know about
- **Global switch on + permission denied**: the switch stays on (it is your wish), reminders are paused with `no_permission`, the status line says "Not allowed" or "Blocked in the phone settings" and offers the system settings. Reconcile picks up a later grant.
- **Permission is never asked at start-up or when a screen opens**: only when a valid reminder is saved, a reminder is switched on, or the global switch is turned on. A past time, a duplicate or the limit is refused *before* the explanation, and a refused first reminder does not create a preparation.
- **Quick picks** set only the date (day before / morning of the bundled festival date, only when that date is today or later); the user must still choose the time. An ongoing multi-day festival has a start date in the past, so it offers none.
- **Language** is the one selected when the reminder is scheduled. Changing the language later does not rewrite already scheduled notifications (they keep the old text until the reminder is edited or re-scheduled).
- **Reminders for a deleted preparation**: its rows go with it; the OS notifications are removed by the reconcile that runs right after the delete (and by the next start if the app dies in between).
- **Limit**: 5 reminders per preparation.
- **Reminder notification small icon**: no custom icon was added (no artwork asset exists and no new artwork was invented), so on a real phone Android may show the default app icon in the status bar, possibly as a plain square. A white 96x96 notification icon is a later polish item.
- **No ads, no INTERNET, no exact alarm, no push, no accounts.** `Share` is React Native's built-in API.

### Permission list (what the Android build will request)
From `npx expo prebuild --platform android` (run for real, then the generated `android/` folder was deleted; it is git-ignored) plus every installed library's own manifest:
- `RECEIVE_BOOT_COMPLETED`, `POST_NOTIFICATIONS` (expo-notifications, new in this phase)
- `INTERNET`, `SYSTEM_ALERT_WINDOW`, `VIBRATE`, `READ_EXTERNAL_STORAGE` (max SDK 32), `WRITE_EXTERNAL_STORAGE` (max SDK 32) (from Expo's prebuild template, **already there before this phase**)
- **No `SCHEDULE_EXACT_ALARM` / `USE_EXACT_ALARM`** anywhere. The datetimepicker adds no permission.

**Attention, a rule problem that is not from this phase:** `CLAUDE.md` says `INTERNET` only comes with the ads phase, but the Expo prebuild template puts `INTERNET` (and `SYSTEM_ALERT_WINDOW`) in the main manifest, so a release build requests it today, and has done since the project began. I did **not** change `app.json`, because the development build needs `INTERNET` in the main manifest to reach Metro (the generated debug manifest does not declare it), so blocking it blindly would break the dev build. Your options: add `android.blockedPermissions` for release only (through an `app.config.js` that reads an environment variable), or accept `INTERNET` until Phase 7. Tell me which.

### Verified (run for real in this phase; Node v22.22.0)
- backend: `pytest` **139 passed**; `scripts/validate_content.py` OK (contentVersion 6, 103 festivals, 16 pujas, 53 samagri, 1 calendar year); `scripts/import_calendar_dates.py` OK (25 dates, 2026 only); `scripts/export_content.py` OK. **Content unchanged**: `git status` shows no change under `content/` or `mobile/assets/puja_data/`.
- mobile: `npx tsc --noEmit` clean; `npm run lint` clean; `npm run format:check` clean; `npm test` **44 suites / 652 tests passed** (was 34 / 525); `npx drizzle-kit generate` reports "No schema changes"; `npx expo export --platform android` OK (4.6 MB hbc).
- dev server: `CI=1 npx expo start --clear` and `curl` of `expo-router/entry.bundle?platform=android&dev=true&minify=false`: **HTTP 200** (1922 modules, 9.9 MB, 14.6 s). The only "ERROR" line in the server log is React Native DevTools failing to install as root ("Running as root without --no-sandbox"), a sandbox limitation, not a bundling error. `npm ls metro @expo/metro-config`: `metro@0.84.5`, `@expo/metro-config@57.0.12`; no `metro*` in `package.json`.
- Earlier tests changed because this phase changed what they assert (nothing else): `db.seed` and `db.migration0003` insert the Phase 2 reminder shape or the new one, `db.migrations` expects the new index names and the reminder -> preparation cascade, `settingsStore` expects `notificationsEnabled` in the persisted state, `preparationTab` no longer asserts "no reminder UI", `routerMock` gained `router` and `usePathname`.
- New tests: reminderTime, reminderService (create/update/disable/enable/delete, past time, limit, duplicate, reconcile incl. missing in OS, extra in OS, past, idempotency, mismatching time, OS list failure, race with create, global switch off/on), db.reminders (CRUD, cascade, restart on a file database, re-seed and disappeared puja), db.migration0004 (Phase 6B database with a row in every user table), permissionFlow (granted, denied, denied for good, granted later), resetLocalData (service and Settings UI incl. rollback and empty states), shareChecklist (English/Hindi, order, markers, only-needed, empty sections, long lists, a puja with only custom items, **every one of the 16 real pujas** in both languages and both modes), reminderScreens (sheet, quick picks, Manage screen, card actions, share), settingsNotifications, notificationRuntime (text, router, taps, quiet mode).

### Not verified (needs a device, ideally a development build)
- `npx expo-doctor`: 19 of 21 checks pass; the two failures (Expo config schema, React Native Directory) are "Host not in allowlist" from the sandbox proxy, same as in earlier phases.
- **No notification was ever shown or fired.** The expo-notifications calls (channel, permission request, DATE trigger, listing, cancel, tap listener) are behind the scheduler interface and were tested only against a fake. The Expo implementation was type-checked and bundled but not executed. In particular: whether `getAllScheduledNotificationsAsync()` reports the date-trigger time in a shape my parser understands (if not, the "time no longer matches" check is skipped, nothing else breaks); whether the boot receiver restores notifications after a reboot; whether a tap on a notification opens the checklist from a cold start and from the background (`getLastNotificationResponse` + the response listener); inexact delivery delay.
- The native date and time dialogs (`DateTimePickerAndroid`), the Android 13 permission dialog and "Open system settings" (`Linking.openSettings`), the share sheet.
- Layout: the sheet with the keyboard open, 360 dp with the largest font, light and dark, Devanagari, TalkBack.

### What to verify by hand on the emulator / phone
1. **Expo Go first** (works for local notifications), then a development build. Open Samagri of any puja, tap **Remind me**, "Add reminder", choose a date a few minutes ahead, save. You should see the **explanation first**, then the Android permission dialog, then a toast. Wait for the time: a notification with the puja name and "Time to check your samagri checklist." (Hindi after switching language). It may arrive late (battery optimisation); that is expected.
2. **Tap the notification** with the app closed, in the background and open: it opens that puja's checklist. Delete the preparation, schedule another, delete the preparation, tap an old notification if you still have one: My Preparation opens, no crash.
3. Deny the permission: the reminder is saved and shows "Paused: notification permission is needed"; the rest of the app works. Tap "Open notification settings", allow it there, come back: Settings shows "Allowed" and the reminder is on (reconcile).
4. Settings > Notifications off: reminders show paused and nothing fires; on again: they are scheduled again. Reboot the phone with a future reminder: it still fires.
5. Past time is refused with a message; a second reminder at the same time is refused; the 6th reminder is refused; a festival puja with a bundled date offers "Day before / Morning of" (Diwali is in the 2026 data) and the time must still be chosen; a puja without a date offers none.
6. Manage reminders (from Settings and My Preparation): groups, switch, edit, delete with confirmation, empty state.
7. Share checklist from the Samagri header and from the card "..." menu, "All items" and "Only items I still need", cancel the system share sheet (no error text), share to a notes app and read the text in English and Hindi.
8. Settings > Reset local data: dialog text, confirm disabled until RESET, after confirming My Preparation, Home recents and Manage reminders are empty at once, puja content and language/theme/text size are unchanged, no old notification fires.
9. The vidhi reader: a reminder that arrives while it is open must not pop up over it.
10. Hindi and English, light and dark, 360 dp, largest text size: the "Remind me" pill next to the share button in the Samagri header, the sheet, the dialogs.
11. Airplane mode: everything works.

### Git
Branch `phase-6c-reminders`, not pushed. Push and merge:
```
git push -u origin phase-6c-reminders
# then, after review, on main:
git checkout main && git pull origin main && git merge --no-ff phase-6c-reminders && git push origin main
```


## Bug fix: missing dependency @react-native-community/datetimepicker (`fix-datetimepicker-dependency`)

**Problem:** on a fresh checkout, the app failed to bundle with:
```
UnableToResolveError: Unable to resolve module @react-native-community/datetimepicker 
from mobile/src/utils/dateTimePicker.ts: the module could not be found within the project 
or in node_modules
```

**Root cause:** `@react-native-community/datetimepicker` and `expo-notifications` were added to Phase 6C but `@react-native-community/datetimepicker` was NOT declared in `mobile/package.json`. The `expo-notifications` was declared, but the date/time picker package was imported in `dateTimePicker.ts` without being listed. This could happen when dependencies are added mid-phase but not all of them make it into the lock file at commit time.

**Fix:** Added `@react-native-community/datetimepicker` to `mobile/package.json` dependencies at the exact version that matches Expo SDK 57 (version `9.1.0`). Verified with CLEAN INSTALL:
- Deleted `node_modules`
- Ran `npm ci` (install from lock file, as it would on any fresh clone)
- Confirmed all packages install correctly: `@react-native-community/datetimepicker@9.1.0` ✓
- Ran full test suite: `npm run typecheck`, lint, `npm test` — all pass

**Verification** (Node v24.19.0, all run for real):
- ✅ `npx tsc --noEmit` — clean
- ✅ `npm run lint` — clean
- ✅ `npm test` — **44 suites / 652 tests passed** (matching Phase 6C result)
- ✅ `npx expo export --platform android` — OK (4.6 MB hbc)
- ✅ `npx expo start --clear` — bundler started, no `transformFile` or resolution errors (bundling was in progress when the test ended)

**CLAUDE.md update:** Added a new workflow rule about dependency management: after adding or changing any dependency, use `npx expo install`, ensure both `package.json` AND `package-lock.json` are committed, and run a CLEAN INSTALL check before declaring the work done (delete node_modules, `npm ci`, verify). This prevents missing dependencies from hiding behind a pre-existing node_modules.

**Branch:** `fix-datetimepicker-dependency` (from main, not pushed). Changes: `mobile/package.json`, `CLAUDE.md`.


## Phase 7 status — AdMob + UMP consent (`phase-7-ads`)

### Platform findings (step 1, checked before coding)
Read via Context7 (docs.expo.dev is blocked in this sandbox) plus the installed package's own
source/types.
- **Package**: `react-native-google-mobile-ads@17.2.0` (latest on npm at the time of writing;
  `npx expo install` itself could not reach Expo's/npm's proxy-filtered endpoints from this
  sandbox — `HTTP Proxy Network Error: Forbidden` — so the version was taken straight from the
  npm registry and installed with `npm install`; re-run `npx expo install --check` on a networked
  machine). v17 adds an optional ad-pool API (`AdPoolProvider`, `usePooledAd`) for juggling many ad
  instances; this project uses the plain, pool-free `<BannerAd>` since there is never more than one
  on screen at once — simpler, and still the documented, supported path.
- **Expo config plugin**: `"react-native-google-mobile-ads"` in `app.json` with `androidAppId`.
  It writes the AdMob App ID (and three `OPTIMIZE_*`/`DELAY_APP_MEASUREMENT_INIT` flags) as
  `<meta-data>` on `MainApplication` in the Android manifest — confirmed by running
  `npx expo prebuild --platform android --no-install` for real and reading the generated
  `android/app/src/main/AndroidManifest.xml` (then deleting `android/` again). **Not supported in
  Expo Go**; needs a development build.
- **Permissions added by the module's own manifest** (`node_modules/react-native-google-mobile-ads/android/src/main/AndroidManifest.xml`,
  read directly): `INTERNET` (already present from an earlier phase), `ACCESS_NETWORK_STATE`,
  `WAKE_LOCK`. **`com.google.android.gms.permission.AD_ID` is not in this file** — it is added by
  the Play Services Ads SDK AAR itself at Gradle manifest-merge time, which this sandbox could not
  run (`./gradlew assembleDebug` failed immediately on a missing Gradle plugin repository, no
  network, no Android SDK — see "Not verified" below). Documented as **VERIFY** in
  `docs/PRIVACY_AND_ADS.md`.
- **UMP consent API** (same package, `AdsConsent`): `gatherConsent()` combines
  `requestInfoUpdate()` and showing the form if required; `AdsConsentInfo.canRequestAds` and
  `.privacyOptionsRequirementStatus` (`REQUIRED`/`NOT_REQUIRED`/`UNKNOWN`) are exactly what this
  phase needed. `showPrivacyOptionsForm()` reopens the choice later.
  `TestIds.ADAPTIVE_BANNER` and `BannerAdSize.ANCHORED_ADAPTIVE_BANNER` exist in this version as
  documented. Native ads exist in this version (`NativeAd`/`NativeAdView`) but the brief says
  banners only for this phase, so they were not touched.
- No conflict with the brief was found; nothing was done differently from what was asked.

### Done
- **`mobile/src/ads/`** (kept separate from content/business logic, per the brief):
  `nativeAdsModule.ts` (the only file that imports the real package — re-exports `BannerAd`,
  `BannerAdSize`, `TestIds`, `mobileAds`, `MaxAdContentRating`, `AdsConsent` and its enums, same
  pattern as `src/notifications/expoScheduler.ts` for `expo-notifications`); `adsConfig.ts` (dev →
  `TestIds`, release → `adsConfig.release.ts`, a placement with no real id configured is disabled,
  never falls back to a test ad); `adsConfig.release.ts` (both placements shipped empty — "fill
  before release"); `consent.ts` (fail-closed UMP wrapper: `gatherConsent`, `getConsentState`,
  `subscribeConsent`, `showPrivacyOptions`, never throws); `AdsManager.ts` (initializes the SDK only
  once consent allows ads, `try`/`catch` around every native call, a conservative
  `RequestConfiguration`); `AdSlot.tsx` (the `<AdSlot placement="...">` component); `libraryAdPlacement.ts`
  (pure placement math for the Library list).
- **Placements, exactly as specified**: Home — one adaptive banner after the Featured row, before
  Categories (`app/(tabs)/index.tsx`). Library — inline in the virtualised list, first ad after row
  8, repeating no more than every 15 rows, never first/last row, nothing while a filter or search
  is active with under 8 results (`app/(tabs)/library.tsx`, logic in `libraryAdPlacement.ts`). No
  native ads; no interstitial/app-open/rewarded code path exists anywhere.
- **Consent + init wiring**: `app/_layout.tsx` calls `startAdsFlow()` in a `useEffect` after the
  first render (never blocks the first frame); it gathers UMP consent, then initializes the Mobile
  Ads SDK only if `canRequestAds` is true. Every native call is wrapped so an SDK failure (missing
  Play Services, offline, timeout) cannot crash or hang the app — it just leaves ads off.
- **Ad content rating**: `MaxAdContentRating.PG` (`AdsManager.ts`). Reasoning documented in code and
  in `docs/DESIGN_SYSTEM.md`: `G` is the strictest tier, but AdMob serves very little inventory at
  `G` in practice, so `PG` is the strictest rating that still reliably serves ads; the app is
  general-audience religious/cultural content, not child-directed, so `PG` with
  `tagForChildDirectedTreatment: false` and `tagForUnderAgeOfConsent: false` is appropriate.
- **Settings**: `AdsPrivacySettings` (`src/components/`) — an always-shown "About ads" card
  (offline-first reminder + what AdMob/UMP may process, English and Hindi, never claims "no data is
  collected") and an "Ad privacy choices" button shown only when
  `privacyOptionsRequirementStatus === REQUIRED`.
- **Docs**: `docs/ADS_SETUP.md` (test IDs already in place, how to fill in real IDs, test-device
  registration, "never click your own live ads", publishing the UMP consent message, dev-build
  workflow, release checklist), `docs/PRIVACY_AND_ADS.md` (what the app itself stores vs. what
  AdMob/UMP processes, permissions table, Data safety form draft checklist, an editable Markdown
  privacy-policy template, everything that still needs **your** or a lawyer's sign-off), this file,
  `docs/DESIGN_SYSTEM.md` (Phase 7 section), `README.md` (dev-build workflow, updated offline-first
  section, doc links).
- **Dependency hygiene**: `react-native-google-mobile-ads@17.2.0` is in both
  `mobile/package.json` and `mobile/package-lock.json`; a CLEAN INSTALL check was run (delete
  `node_modules`, `npm ci`, `npm ls react-native-google-mobile-ads`, `npx tsc --noEmit`, full test
  suite) and passed. No `metro*` package was touched.

### Tests (`mobile/__tests__/`, all real, all passing)
- `adsConfig.test.ts`: dev build → `TestIds`; release build with empty ids → both placements
  `null`; a regex check that `adsConfig.release.ts` and `app.json` contain no AdMob publisher id
  other than Google's own test id (`3940256099942544`) — this is the "fails the build if a real id
  is committed" check the brief asked for.
- `adsConsent.test.ts`: not required, required+granted, required+denied, error/timeout (fails
  closed, resolves instead of throwing), subscribers notified on change and not after
  unsubscribing, `showPrivacyOptions` updates state and never throws on failure.
- `adsManager.test.ts`: no SDK init before consent allows it; initializes once consent allows ads;
  never initializes twice; a failed `initialize()` or a failed `gatherConsent()` never throws and
  leaves ads off; consent granted after an earlier denial can still initialize ads later.
- `adSlot.test.tsx`: renders nothing while not ready; renders nothing (no label) until the mocked
  native banner reports loaded; shows the labelled slot once loaded; collapses back to nothing on a
  load error (the same path offline takes); no state update after unmount.
- `libraryAdPlacement.test.ts`: empty/tiny list → no ad; first ad after row 8; never row 0; never
  the last row (including the "no room to avoid the last row, so show nothing" case); repeats every
  15; nothing under an active filter/search with fewer than 8 results; still shows ads at 8+ results
  under a filter.
- `noAdsInForbiddenScreens.test.ts`: every screen/component CLAUDE.md forbids ads from (vidhi
  reader, samagri checklist, My Preparation, reminder sheets/dialogs, Settings, Puja/Festival
  Details, Calendar) is checked by **static source scan** for an `AdSlot` import — a deliberate
  choice over rendering each one, since every one of those screens already has its own heavy
  database-fixture render test elsewhere; a source-level guarantee ("never imported") is stronger
  than "not currently rendered" would be anyway.
- `adsOffline.test.tsx`: Home and Library render their real content normally with the ads module
  mocked as unavailable (simulating offline / SDK failure) and show no ad slot.
- Full suite: **51 suites / 696 tests passed** (was 44 suites / 652 tests on `main`; +7 new suites,
  +44 new tests). No existing test needed changing.

### Verified (run for real in this phase; Node v22.22.0)
- backend: `pytest` **139 passed** (unchanged); `validate_content.py` OK (contentVersion 6, 103
  festivals, 16 pujas, 53 samagri, 1 calendar year); `import_calendar_dates.py` and
  `export_content.py` OK, and `git status` shows **no change** under `content/` or
  `mobile/assets/puja_data/` — content is byte-identical to `main`.
- mobile: CLEAN INSTALL (delete `node_modules`, `npm ci`, `npm ls react-native-google-mobile-ads`
  → `17.2.0`); `npx tsc --noEmit` clean; `npm run lint` clean; `npm run format:check` clean;
  `npm test` **51/51 suites, 696/696 tests**; `npx expo export --platform android` OK (4.8 MB hbc,
  up from 4.6 MB); `npx expo prebuild --platform android --no-install` OK (manifest has the AdMob
  App ID meta-data; `android/` deleted again afterwards, as CLAUDE.md asks).
- dev server: `CI=1 npx expo start --clear`, then `curl` of
  `expo-router/entry.bundle?platform=android&dev=true&minify=false`: **HTTP 200**, ~10 MB bundle.
  The only "ERROR" line in the server log is React Native DevTools failing to install as root
  ("Running as root without --no-sandbox"), the same sandbox-only line seen in every earlier phase —
  not a bundling error.
- `npx expo-doctor`: **19 of 21 checks pass**; the same two network-dependent checks fail as in
  every earlier phase (Expo config schema, React Native Directory — "Host not in allowlist" from
  the sandbox proxy).
- `npm ls metro @expo/metro-config`: `metro@0.84.5`, `@expo/metro-config@57.0.12`; no `metro*`
  package was added to `package.json`.

### Not verified
- **`./gradlew assembleDebug` could not run**: no Android SDK in this sandbox, and the Gradle
  build failed immediately trying to resolve a Gradle plugin repository it has no network path to
  (`org.gradle.toolchains.foojay-resolver-convention` could not be found in any configured
  repository). So the **real, merged** Android manifest (with `AD_ID` and any other
  Gradle-merged permission) was never produced or inspected — only the pre-merge manifest from
  `expo prebuild` (confirmed) and each library's own standalone manifest (confirmed) were. You must
  run `npx expo run:android` or a real Gradle build to see the final permission list; this is
  called out explicitly in `docs/PRIVACY_AND_ADS.md` as something to VERIFY.
- **Nothing was run on an emulator or real device.** In particular: whether a real AdMob test ad
  actually renders and looks right next to the Featured row and inside the Library list, at 360dp,
  light and dark, largest text size; whether the UMP consent form appears/behaves as expected on a
  device configured as being in the EEA/UK; whether "Ad privacy choices" opens the real form;
  TalkBack reading of the loaded ad slot and the privacy row; whether ad loading ever visibly
  shifts other content (the slot is zero-height until loaded by design, but this was only checked
  in a unit test, not a real layout pass).
- **No consent message has been published yet** in the AdMob console (there is no AdMob account
  tied to this project in this sandbox), so `gatherConsent()` was only exercised against a mocked
  native module, never the real UMP flow end to end.
- Ad serving itself (whether a real ad unit actually returns an ad, fill rates, mediation) can
  never be verified in a sandbox and was not claimed to be.

### What you must verify by hand on the emulator / phone (a development build, not Expo Go)
1. `npx expo run:android` once (first build with the new native dependency), then
   `npx expo start --dev-client` for daily work, per `docs/ADS_SETUP.md`.
2. Home: a "Test Ad" banner appears after Featured pujas, before the category grid — never between
   the "Next festival" hero card and "See calendar", never touching a button. Turn on airplane mode
   and relaunch: the slot takes no space at all (no blank box).
3. Library: scroll past about 8 pujas — a labelled "Test Ad" banner appears as its own row, never
   first or last; keep scrolling — the next one is roughly 15 rows later. Filter down to under 8
   results, or search: no ad appears in that list.
4. Settings → About ads: the two sentences render in English and Hindi; "Ad privacy choices" is
   probably **absent** unless the test device/account is configured for a region UMP requires a
   choice in.
5. Confirm the full Android permission list from a real build (`./gradlew assembleDebug` or Android
   Studio's merged manifest viewer) and update `docs/PRIVACY_AND_ADS.md`'s "VERIFY" permission row
   with what you actually see, especially `AD_ID`.
6. Everything already on the "what to verify by hand" lists of Phases 4-6C still applies; this
   phase changed Home and Library layout slightly (one extra element each) and added one Settings
   card, nothing else visual.

### Git
Branch `phase-7-ads`, from `origin/main` (the local `main` ref in this sandbox was stale and far
behind `origin/main`; `phase-7-ads` was built on `origin/main`, not the stale local ref). Not
pushed. Push and open a PR:
```
git push -u origin phase-7-ads
```

## Phase 7 verification pass (`phase-7-ads`)

Environment: Node v24.19.0, JDK 17.0.20, `ANDROID_HOME` set, Pixel_9a_bulkingapp AVD (Android 35, Google Play image) already booted.

### Bug found and fixed
- **The Android debug build failed at Gradle configure time** with `Cannot get property 'googleMobileAdsJson' on extra properties extension as it does not exist` (`react-native-google-mobile-ads` `android/build.gradle` line 123). The library only defines that extension when the plugin gets an `androidSdk` option (it writes the `RNGMA_ANDROID_BACKEND` gradle property, which short-circuits the read). Fix: `"androidSdk": "classic"` added to the plugin options in `mobile/app.json` (the library's default backend, so behaviour is unchanged). Regression test added in `mobile/__tests__/adsConfig.test.ts`.
- Also: a stale Gradle 9.3.1 daemon from an earlier session locked files in `node_modules`, so `rm -rf node_modules` failed. It was stopped; no code change.

### Verified (real output)
- `npm ci` clean install; `npx expo install --check`: "Dependencies are up to date"; `npx expo-doctor`: **21/21 checks passed** (the two network checks that failed in earlier phases pass now).
- `npx expo prebuild --platform android --clean` OK; `npx expo run:android --variant debug`: **BUILD SUCCESSFUL in 5m 58s** (Gradle reported 5m 58s for the successful build (the first attempt failed at configure time, so it is not a timing). Wall-clock time including native CMake was roughly 35 minutes, mostly in the C++ compile of Reanimated, Worklets and Gesture Handler). APK installed on `sdk_gphone64_x86_64`, package `com.pujasaathi.app` present.
- Dev server: Metro on 8081 `packager-status:running`; `curl` of `expo-router/entry.bundle?platform=android&dev=true&minify=false` returned **HTTP 200**, 10,563,390 bytes. Metro log: one "Error while reading cache, falling back to a full crawl" line (a stale Metro disk cache; it recovers, no bundling error).
- Node v24.19.0 is what this environment runs; CLAUDE.md says "Node LTS" (v22 was used in earlier phases). Not changed in this pass.
- Permissions (debug build, `aapt dump permissions` and merger report): expected `INTERNET`, `ACCESS_NETWORK_STATE`, `WAKE_LOCK`, `POST_NOTIFICATIONS` present, and `com.google.android.gms.permission.AD_ID` **confirmed** (from `play-services-ads-api` 25.4.0). Unexpected ones and their sources are listed in `docs/PRIVACY_AND_ADS.md`. No `SCHEDULE_EXACT_ALARM`, `USE_EXACT_ALARM`, location, contacts, camera, microphone.
- Cold start (`.verify/01_cold_start.png`): Home renders in light theme with the hero "Next festival" card (Sharad Navratri, "In 5 days", "Date confirmed"), "See calendar" with "7 more in the next 30 days", then Featured pujas, then Browse by category. No crash.
- Ads SDK: logcat shows the ads SDK starting, "This request is sent from a test device", and an SDK version line. No `FATAL EXCEPTION` for `com.pujasaathi.app` in the logs read.
- Tests: `npx tsc --noEmit` clean. `npm test` on the last run: 696 passed, 1 failed; the failing test is `preparation.realContent` (Saraswati puja), which **passed 34/34 when run alone and in the following run**, so it is intermittent under load (the emulator and Metro were running). Not caused by this change.

### Not verified
- **A test banner was not seen on screen.** Home scrolled from Featured straight to "Browse by category" with no ad slot. The logs show a request but no load success and no load failure, so this is COULD-NOT-VERIFY, not a confirmed bug. The slot collapses to zero height until a load succeeds, by design.
- Not yet checked on the emulator: Library ad cadence, the no-ad screens, offline behaviour, Settings "About ads" (EN/HI), "Ad privacy choices" absence, the regression flows (checklist persistence, reminder firing, share sheet, reset local data), Hindi / dark / large text.
- Real ad serving with the real IDs, the UMP form in an EU region, a physical device.
- The build logs "No 'iosAppId' was provided" twice. That is expected: the app has no iOS app ID yet and this check was for Android only.
- `npm run format:check` reports style issues in 205 files, including generated/config files. Not fixed here (it was not run clean in earlier phases either; confirm with the owner before reformatting the repo).

### What to verify by hand (on a phone or emulator)
1. Home: a "Test Ad" banner appears after Featured pujas, never between the hero card and "See calendar"; airplane mode removes it without a gap.
2. Library: about every 8 rows, never first or last, none under a filter with fewer than 8 results.
3. Settings: "About ads" in English and Hindi; "Ad privacy choices" should not appear in India.
4. The regression list from Phases 5, 6A, 6B and 6C (preparation ticks persist, reminder fires, share sheet, reset local data).


### Stage 4 — privacy policy and Settings row (done 2026-10-06, not pushed)
- `docs/privacy-policy/index.md`: English and Hindi policy with `{{CONTACT_EMAIL}}` and `{{EFFECTIVE_DATE}}` placeholders and `[VERIFY]` markers. No legal-compliance claim; no "no data is collected" claim.
- `docs/privacy-policy/README.md`: GitHub Pages publishing steps, how to check the URL, where to paste it.
- `mobile/src/config/legal.ts`: `PRIVACY_POLICY_URL` = '' (owner sets it).
- `PrivacyPolicyRow` in Settings: hidden when the URL is empty; opens the URL in the browser; English and Hindi strings; accessible label; 48dp button.
- Tests: `__tests__/privacyPolicyRow.test.tsx` (hidden when empty, visible when set, opens the URL, failure does not crash, Hindi, extra-large text); Settings tests pass (21 of 21 across the related suites).
- Cross-check of every policy claim against the code and the release permission list: `docs/PRIVACY_AND_ADS.md` ("Policy cross-check"). One known leftover: the source manifest template lists the storage permissions, but they are blocked and absent from the shipped app.
- NOT verified: the Settings row on a device (no device run this stage); that the published page opens (no URL is published yet).


### Stage 5 — store and Play Console documents (done 2026-10-06, not pushed)
- `docs/STORE_LISTING.md`: English and Hindi app name, short description (74 and 69 characters, under 80), full description (1,524 and 1,519 characters, under 4,000), category and tags marked VERIFY, a "do not claim" list, graphic sizes (icon 512x512, feature graphic 1024x500, phone screenshots), and a 6-screen plan with adb capture commands. Review status stated from `content/`: 16 pujas and 103 festivals, all `ai_drafted`.
- `docs/PLAY_CONSOLE_CHECKLIST.md`: new personal account, app creation, app access, ads declaration, IARC rating, target audience (not for children), data safety draft based on the real SDKs (no own-code collection; ads SDK identifiers), privacy policy URL, other declarations, advertising ID, Play App Signing, closed testing (rule marked VERIFY, not stated as fact), production access, and after-publish tasks (AdMob link, real ad unit IDs outside git, consent message, version increment). No approval or timelines promised.
- NOT done: feature graphic, phone screenshots and the final icon export need the owner's artwork and sign-off. The screenshot capture is a plan, not run.
