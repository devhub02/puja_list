# Release guide (Android)

Application ID: `com.pujasaathi.india` (cannot change after the first Play upload).

Last released versionCode: none (first release). `scripts/release-check.py` reads this line. After you upload a
build to Play, change it to that build's versionCode.

## Versions

- `expo.version` in `mobile/app.json` is the user-facing versionName: **1.0.0**.
- `expo.android.versionCode` in `mobile/app.json` is the Play versionCode: **1**.
- Rule: every upload to Play needs a versionCode higher than the last one uploaded, including test tracks. Increase
  `android.versionCode` by 1 for each upload. Increase versionName when the content or behaviour changes for users.
- `scripts/release-check.py` fails if the versionCode is not higher than the value on the `Last released versionCode`
  line. Equal is allowed only while that line says `none`.

## Signing (no secrets in git)

The release build is signed with a key you create. Nothing secret is stored in the repo. The Expo config plugin
`mobile/plugins/withPujaRelease.js` writes the Gradle signing wiring on every `npx expo prebuild`, so `android/`
can stay git-ignored.

Set these four Gradle properties in `~/.gradle/gradle.properties` (your user folder, not the repo), or pass them with
`-P` on the command line:

| Gradle property | Meaning |
|---|---|
| `PUJA_RELEASE_STORE_FILE` | full path to your `.jks` or `.keystore` file, outside the repo |
| `PUJA_RELEASE_STORE_PASSWORD` | keystore password |
| `PUJA_RELEASE_KEY_ALIAS` | key alias inside the keystore |
| `PUJA_RELEASE_KEY_PASSWORD` | key password |

Example (values are yours to choose; do not commit this file):

```
PUJA_RELEASE_STORE_FILE=C:\secure\puja-release.jks
PUJA_RELEASE_STORE_PASSWORD=...
PUJA_RELEASE_KEY_ALIAS=puja_release
PUJA_RELEASE_KEY_PASSWORD=...
```

Behaviour:
- If any of the four properties is missing, or the keystore file does not exist, `assembleRelease` and `bundleRelease`
  stop before compiling with a message that names the missing properties. The release build never falls back to the
  debug key. Debug builds do not need these properties.
- Verified (2026-10-06): running `./gradlew :app:assembleRelease` with no properties set exits 1 with
  `Release signing is not configured. Missing Gradle properties: PUJA_RELEASE_STORE_FILE, ...`.

Create the keystore once (keep it and its passwords safe):

```
keytool -genkeypair -v -keystore C:\secure\puja-release.jks -alias puja_release -keyalg RSA -keysize 2048 -validity 10000
```

Keep a backup of the keystore and its passwords in two safe places. Play App Signing (set up in the Play Console)
keeps the app-signing key on Google's side; you keep an upload key. Losing the upload key is recoverable through Play
support, but it is slow. Do not commit the keystore or the passwords.

Test signing (not for release): a throwaway key was generated outside the repo and used for the Stage 3 verification
builds; it was deleted afterwards. Test APKs signed with it are not for distribution.

## Release order (do these in this order)

1. **Publish the privacy policy** (`docs/privacy-policy/README.md`) and check the live URL opens in a browser.
2. **Set the URL in the app:** `PRIVACY_POLICY_URL` in `mobile/src/config/legal.ts`. This value is compiled into the app,
   so it must be set **before** the release build; changing it later needs a new build and upload.
3. **Bump the version** if this is not the first upload: `expo.android.versionCode` in `mobile/app.json`, +1.
4. **Ads for production:** put the real AdMob IDs in for the production build only, following `docs/ADS_GO_LIVE.md`.
   Never commit them.
5. **Build the AAB with your real keystore** (set the four `PUJA_RELEASE_*` Gradle properties first):
   `./gradlew :app:bundleRelease`, from `mobile/android`.
6. **Run `python scripts/release-check.py`** and the secrets test, then `git status` (no secrets or generated files).
7. **Upload** the AAB in the Play Console (closed testing first, see `docs/PLAY_CONSOLE_CHECKLIST.md`).
8. **Update** "Last released versionCode" below to the uploaded value.

## Build

```
cd mobile
npx expo prebuild --platform android --clean   # only when native config changed
cd android
./gradlew :app:bundleRelease                   # AAB for Play: app/build/outputs/bundle/release/app-release.aab
./gradlew :app:assembleRelease                 # APK for local install: app/build/outputs/apk/release/app-release.apk
```

Release builds use R8 minification and resource shrinking (set in the same plugin).

## Per-device size and install (bundletool)

Get bundletool from Google's official releases (https://github.com/google/bundletool/releases) and put the jar at
`C:	oolsundletool.jar` (outside the repo). Run from `mobile/android`.

Real download size per device: build the APK set once, then ask bundletool for the sizes per device dimension:

```
java -jar C:	oolsundletool.jar build-apks --bundle=app/build/outputs/bundle/release/app-release.aab --output=puja-all.apks --ks=C:\secure\puja-release.jks --ks-pass=file:C:\secure\store.pass --ks-key-alias=puja_release --key-pass=file:C:\secure\key.pass
java -jar C:	oolsundletool.jar get-size total --apks=puja-all.apks --dimensions=ABI,SCREEN_DENSITY,LANGUAGE,SDK
```

Install on a connected phone (USB debugging on); this builds only for that phone:

```
java -jar C:	oolsundletool.jar build-apks --connected-device --bundle=app/build/outputs/bundle/release/app-release.aab --output=puja.apks --ks=C:\secure\puja-release.jks --ks-pass=file:C:\secure\store.pass --ks-key-alias=puja_release --key-pass=file:C:\secure\key.pass
java -jar C:	oolsundletool.jar install-apks --apks=puja.apks
```

Keep passwords in files outside the repo (`file:` form), never on the command line in a committed script.

## Permissions

`android.blockedPermissions` in `mobile/app.json` removes unused permissions from the merged manifest: system alert
window, vibrate, the c2dm (push) permission, the launcher badge permissions, the legacy storage permissions and the
install-referrer binding. The debug build keeps its dev menu (verify after changes).

Final release permissions (from `aapt dump permissions` on the built APK; see the Stage 3 status in
`docs/PROGRESS.md` for the build that produced this list):

Allowed: `INTERNET`, `ACCESS_NETWORK_STATE`, `WAKE_LOCK`, `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED`,
`com.google.android.gms.permission.AD_ID` (ads SDK).

Accepted (on purpose; each has a source):
- `ACCESS_ADSERVICES_AD_ID`, `ACCESS_ADSERVICES_ATTRIBUTION`, `ACCESS_ADSERVICES_TOPICS`: added by the Google Mobile Ads
  SDK (`play-services-ads-api`). Part of the ads SDK's Privacy Sandbox support. Not used by our code.
- `FOREGROUND_SERVICE`: added by WorkManager (`androidx.work`), a dependency of the notification stack. Not used by our code.
- `com.pujasaathi.india.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`: our app's own signature permission from AndroidX.

Nothing for location, contacts, camera, microphone, media storage or exact alarms.

## Play requirements (read 2026-10-06)

- Target API: from **31 August 2026**, new apps and updates must target **Android 16 (API 36)** or higher
  (source: developer.android.com/google/play/requirements/target-sdk). Our `targetSdkVersion` is **36**: compliant.
  Google also lists an extension option to 1 November 2026, through a Play Console form (not used).
- 16 KB page size: apps targeting **API 35 or higher** must support 16 KB pages on 64-bit devices. From
  **1 February 2027**, updates that do not support it cannot be released (source:
  developer.android.com/guide/practices/page-sizes). Our target is 36, so the requirement applies. Status: see the
  Stage 3 section of `docs/PROGRESS.md` (the ELF and zipalign checks).

## Release check

```
python scripts/release-check.py            # full check: tests, content, export, secrets, permissions, versionCode
python scripts/release-check.py --skip-tests
```

It needs the release APK built first (`assembleRelease`), and ANDROID_HOME set (it uses `build-tools/37.0.0/aapt.exe`).
