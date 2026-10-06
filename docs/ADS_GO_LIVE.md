# Ads go-live runbook (production build)

Read this when you have real AdMob IDs. Do not edit any ID until the Play Console app exists and AdMob is linked.
Background: `docs/ADS_SETUP.md`. Policy: `CLAUDE.md` "Ads rules".

## Current state (v1, in git)
- `mobile/src/ads/adsConfig.release.ts`: both release unit IDs are empty strings. A release build with an empty ID shows
  **no ad** for that placement. Debug and development builds use Google's test IDs only.
- `mobile/app.json`, plugin `react-native-google-mobile-ads`: `androidAppId` is Google's **test** App ID
  (`ca-app-pub-3940256099942544~3347511713`). It is public test data, not a secret.
- Ads appear on exactly two placements: Home (`home_banner`) and Library (`library_banner`). No interstitial, app-open or
  rewarded ad exists.

## 1. Get the IDs (AdMob console)
1. Link the Play app in AdMob (Apps > Add app > Play app; you need the published or pre-launch app).
2. Note the **App ID** (format `ca-app-pub-<16 digits>~<10 digits>`, with a `~`).
3. Create two **Banner, adaptive** ad units: "Home banner" and "Library banner". Note each **ad unit ID**
   (format `ca-app-pub-<16 digits>/<10 digits>`, with a `/`).

## 2. Put the IDs in the right place, without committing them
The repo must never contain a real ID. The secrets test (`mobile/__tests__/adsConfig.test.ts`) and
`scripts/release-check.py` fail if one is found in a tracked file.

Recommended approach for a local production build: keep the real values **out of the repo**, in a file you own, and
apply them only for that build:

1. Put the three real values in `%USERPROFILE%\.gradle\gradle.properties` or a private file outside the repo. Use names
   you choose, for example `PUJA_ADMOB_APP_ID`, `PUJA_ADMOB_HOME_UNIT`, `PUJA_ADMOB_LIBRARY_UNIT`.
2. Edit `mobile/src/ads/adsConfig.release.ts` and `mobile/app.json` locally to read or contain those values **only in
   the working copy**, then **do not commit that change**. Revert the two files (`git checkout -- <file>`) before any
   commit.

Alternative (more work, no local edits): a config plugin that reads the App ID from Gradle properties, like the signing
plugin in `mobile/plugins/withPujaRelease.js`. Not implemented; it is a candidate for a later stage.

Never commit: a real App ID, a real unit ID, a keystore, or a password. Check before each commit:
```
python -c "import re,subprocess,sys; t=subprocess.run(['git','diff','--staged'],capture_output=True,text=True).stdout; m=[x for x in re.findall(r'ca-app-pub-(\d{16})', t) if x!='3940256099942544']; print('BLOCK: real AdMob id staged' if m else 'ok: no real AdMob id staged'); sys.exit(1 if m else 0)"
```
If it prints `BLOCK`, do not commit. (The same rule runs in `mobile/__tests__/repoSecrets.test.ts`.)
If it prints anything other than `3940256099942544`, do not commit.

## 3. Bump the version
- Increase `expo.android.versionCode` in `mobile/app.json` by 1 for each Play upload (see `docs/RELEASE.md`).
- Update "Last released versionCode" in `docs/RELEASE.md` after the upload.

## 4. Build the production AAB
Use your real keystore (set the four `PUJA_RELEASE_*` Gradle properties, see `docs/RELEASE.md`). Run from `mobile/android`:
```
./gradlew :app:bundleRelease
```
Output: `app/build/outputs/bundle/release/app-release.aab`. Keep the ad IDs local (step 2) while building.

## 5. Verification checklist (on the production build, on a device)
- [ ] Ads appear only on **Home** and **Library**, and nowhere else (Vidhi, Samagri, My Preparation, reminders, Settings,
      Puja and Festival Details, Calendar).
- [ ] With **no network**, each ad slot is gone: zero height, no placeholder, no error text. The app works fully.
- [ ] A release build with an empty placement ID shows **no test ad** there.
- [ ] No "Test Ad" label appears in a release build (test ads are a debug-only signal).
- [ ] The consent message is published in AdMob (Privacy & messaging) for the regions that need it.
- [ ] `scripts/release-check.py` passes, and the secrets test passes.
- [ ] `git status` shows no changes to `adsConfig.release.ts` or `app.json` apart from what you meant to commit.

## 6. Rules while testing
- **Never click your own live ads.** Clicking ads you serve yourself breaks AdMob policy and can suspend the account.
- On a real device, register it as a test device in AdMob before loading a real unit (see `docs/ADS_SETUP.md`).
- Test with Google's test IDs in debug builds, not with the production IDs.
