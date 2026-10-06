# Privacy and ads (Phase 7)

This is **not legal advice** and does not by itself make the app compliant with Google Play policy,
GDPR, India's DPDP Act or any other law. Every section marked **VERIFY** must be checked by you
(or a lawyer) against the exact SDK versions you ship and the current Google Play / AdMob
requirements, which change over time.

## What Puja Saathi itself stores

Everything below stays only on the user's device, in its local SQLite database and
`AsyncStorage`. None of it is ever sent anywhere by our own code; there is no backend, no account,
no analytics SDK of ours.

- Puja/festival content (bundled, read-only)
- Saved pujas, recently viewed pujas, recent searches
- Preparations: checklist ticks, custom samagri items, vidhi reading position
- Reminders (local scheduled notifications only — nothing is sent over the network for this)
- Settings: language, theme, text size, notifications on/off

**We never claim "no data is collected"** (see CLAUDE.md "Privacy") because the AdMob/UMP SDK
does process some data on the device and with Google, described below.

## What AdMob / UMP processes

**VERIFY** against the AdMob and UMP documentation for the exact SDK version in
`mobile/package.json` (`react-native-google-mobile-ads`) at release time; this is a summary, not
the authoritative source.

- To serve and measure ads, the Google Mobile Ads SDK can process an **advertising identifier**
  (Android's Advertising ID / GAID, where available) and other request signals (device/OS info,
  IP-derived general location, app info) with Google.
- The **UMP (User Messaging Platform) SDK** shows a consent form where required (e.g. certain
  EEA/UK configurations) and records the user's consent choice so AdMob can respect it.
- Google's own privacy and ad-serving documentation is the source of truth for exactly what is
  collected and how it is used; this project does not control that.
- The app's own code never reads, stores or transmits the advertising identifier itself — only the
  ad SDK does, as part of showing and measuring ads.

## Permissions (Android), and why

From the generated manifest and the libraries' own manifests (see `docs/ADS_SETUP.md` and
`docs/PROGRESS.md` Phase 7 for exactly how this was checked):

| Permission | Source | Why |
|---|---|---|
| `INTERNET` | Expo's prebuild template (pre-existing) + `react-native-google-mobile-ads` | Ads and the consent form need a network request; was already present before this phase for the dev build to reach Metro |
| `ACCESS_NETWORK_STATE` | `react-native-google-mobile-ads` | Lets the ads SDK check connectivity before requesting an ad |
| `WAKE_LOCK` | `react-native-google-mobile-ads` (confirmed in the merged manifest; the debug source set also injects it) | Used internally by the Play Services Ads SDK |
| `com.google.android.gms.permission.AD_ID` | `com.google.android.gms:play-services-ads-api:25.4.0` (confirmed in the merged manifest of a real debug build, Phase 7 verification) | Lets the SDK read the advertising identifier. Confirmed present in the installed APK (`aapt dump permissions`) and in `adb shell dumpsys package com.pujasaathi.india` (the Phase 7 check ran under the previous ID `com.pujasaathi.app`). |
| `RECEIVE_BOOT_COMPLETED`, `POST_NOTIFICATIONS` | `expo-notifications` (Phase 6C, unrelated to ads) | Local reminders |
| `SYSTEM_ALERT_WINDOW`, `VIBRATE`, `READ_EXTERNAL_STORAGE`/`WRITE_EXTERNAL_STORAGE` (max SDK 32) | Expo's prebuild template (pre-existing, unrelated to ads) | Not from this phase |

**No `SCHEDULE_EXACT_ALARM`/`USE_EXACT_ALARM`, no location, contacts, camera or microphone
permission anywhere.**

Other permissions in the merged manifest of the real debug build (Phase 7 verification, from `aapt dump permissions` and the manifest merger report):
- `SYSTEM_ALERT_WINDOW`, `VIBRATE`, `READ_EXTERNAL_STORAGE` / `WRITE_EXTERNAL_STORAGE` (max SDK 32): from this project's own `android/app/src/main/AndroidManifest.xml` (Expo prebuild template). No feature needs them. `SYSTEM_ALERT_WINDOW` should be removed before release.
- `ACCESS_ADSERVICES_AD_ID`, `ACCESS_ADSERVICES_ATTRIBUTION`, `ACCESS_ADSERVICES_TOPICS`: from `play-services-ads-api` (ads).
- `com.google.android.c2dm.permission.RECEIVE`: from `firebase-messaging`, pulled in by `expo-notifications`. The app uses only local notifications, not remote push.
- `FOREGROUND_SERVICE`: from `androidx.work` (WorkManager).
- `com.google.android.finsky.permission.BIND_GET_INSTALL_REFERRER_SERVICE`: from `installreferrer`, pulled in by `expo-application`.
- `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`: a signature permission defined by `androidx.core`, not user-facing.
- About 25 launcher badge permissions (Samsung, HTC, Sony, Huawei, OPPO and others): from `me.leolin:ShortcutBadger`, pulled in by `expo-notifications`. They are declared but not requested at runtime; only `POST_NOTIFICATIONS` is a runtime permission.

None of these is an exact-alarm, location, contacts, camera, microphone or media-storage permission. Removing the unused ones (the badge set, `c2dm`, `SYSTEM_ALERT_WINDOW`) is a possible follow-up; it needs a manifest `tools:node="remove"` config plugin and was not done in this phase.

## Data safety form (Play Console) — draft checklist

**VERIFY every line against the Play Console's current form and the exact SDK version shipped.**
This is a starting point, not a filled-in answer.

- **Data collected**: Device or other identifiers (advertising ID) — collected by the ads SDK, not
  by this app's own code.
- **Purpose**: Advertising or marketing (ads), and possibly Analytics (ad measurement) depending on
  how Google's current form categorises AdMob's own measurement.
- **Shared with third parties**: Yes — Google (AdMob) for ad serving/measurement.
- **Is data collection optional?**: Depends on the UMP consent outcome and region; where UMP shows
  a choice, say so.
- **Encrypted in transit**: Yes (the SDK's own requests).
- **Can users request deletion**: there is no account for this app's own data (it is on-device
  only); for AdMob's own data practices, point to Google's own controls (e.g. Android's "Delete
  advertising ID" / "Opt out of ads personalization" settings) rather than claiming this app can
  delete it.
- Re-check the **"Data safety"** section whenever `react-native-google-mobile-ads` is upgraded —
  new SDK versions occasionally change what they declare.

## Privacy policy template (editable, GitHub Pages–ready Markdown)

Copy this into a page you publish (e.g. GitHub Pages) and fill in the bracketed parts. **Have this
reviewed** before publishing; it is a draft, not a finished policy.

```markdown
# Privacy Policy — Puja Saathi

Last updated: [DATE]

Puja Saathi ("the app") is an offline-first app that helps you prepare for Hindu pujas and
festivals. This page explains what happens with your data.

## What stays on your phone

Puja Saathi has no accounts and no login. Everything you create in the app — saved pujas,
checklist progress, custom items, reminders, and your language/theme/text-size settings — is
stored only on your device. We do not operate a server that receives this data, and we do not use
any analytics service of our own.

## Ads

Puja Saathi shows a small number of ads (currently: one banner on the Home screen and occasional
banners in the Library) served by Google AdMob. Ads need an internet connection; if you are offline
or an ad cannot load, that space simply stays empty — ads are never required to use any feature.

To show and measure ads, Google's advertising SDK may process information such as your device's
advertising identifier, general device information, and an approximate location derived from your
IP address, under Google's own privacy policy:
https://policies.google.com/privacy

Where required (for example in the EEA/UK), Puja Saathi shows a consent message, provided by
Google's User Messaging Platform (UMP), before any personalised ad is requested. You can review or
change your choice at any time from **Settings → About ads → Ad privacy choices**, when that
option is shown.

## Permissions

The app requests the Android permissions it needs for ads (internet access, network state) and for
local reminder notifications (posting notifications, restoring them after a restart). It does not
request location, contacts, camera, microphone or any permission unrelated to these features.

## Your choices

- You can turn off reminder notifications at any time in Settings.
- You can review your ad consent choice in Settings → About ads, where offered.
- Android's own system settings let you reset or opt out of your advertising identifier
  (Settings → Privacy → Ads, or Settings → Google → Ads, depending on your Android version).
- "Reset local data" in Settings removes everything the app itself has stored on your phone.

## Changes to this policy

[Describe how you will notify users of changes, e.g. "This page will be updated and the date above
changed; continued use of the app after a change means you accept the update."]

## Contact

[Your contact email or address]
```

## Checklist of items that need YOUR sign-off before release

- [ ] The permissions table above matches a real `./gradlew assembleDebug` / `bundleRelease`
      manifest for the exact SDK version shipped (not verified in this sandbox — see
      `docs/PROGRESS.md`)
- [ ] Data safety form filled in the Play Console and cross-checked against the current AdMob/UMP
      documentation for the shipped SDK version
- [ ] Privacy policy published (GitHub Pages or elsewhere), reviewed by you or a lawyer, and linked
      from the Play Console listing
- [ ] Confirm whether DPDP Act (India) or any other local law adds requirements beyond this
      checklist — not evaluated here


## Accepted release permissions (confirmed in the Stage 3 release APK, 2026-10-06)

Source of each permission, as seen in the merged release manifest and `aapt dump permissions`:

- `com.google.android.gms.permission.AD_ID`: Google Mobile Ads SDK (`play-services-ads-api`), via the `react-native-google-mobile-ads` package. Lets the SDK read the advertising ID. Our code never reads it.
- `android.permission.ACCESS_ADSERVICES_AD_ID`, `ACCESS_ADSERVICES_ATTRIBUTION`, `ACCESS_ADSERVICES_TOPICS`: Google Mobile Ads SDK (`play-services-ads-api`). Privacy Sandbox support (ad attribution and interest topics). Our code does not call these APIs.
- `android.permission.FOREGROUND_SERVICE`: WorkManager (`androidx.work`), a dependency of the notification stack. Our code declares no foreground service.
- `com.pujasaathi.india.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`: AndroidX core, signature permission scoped to our package. Not a user-facing permission.
- `android.permission.VIBRATE`: allowed again so reminder notifications can vibrate (the reminder channel sets a vibration pattern in `mobile/src/notifications/expoScheduler.ts`).

Blocked on purpose (`android.blockedPermissions` in `mobile/app.json`): SYSTEM_ALERT_WINDOW, READ_APP_BADGE, the push (c2dm) RECEIVE permission, the launcher badge permissions, READ/WRITE_EXTERNAL_STORAGE, and the install-referrer binding. None is used by the app.

Kept on purpose: RECEIVE_BOOT_COMPLETED (reminders are re-created after a restart).


## Policy cross-check (Stage 4, 2026-10-06)

Each claim in `docs/privacy-policy/index.md`, checked against the code and the release build:

| Claim | Evidence | Result |
|---|---|---|
| No analytics or crash-reporting SDK | `mobile/package.json` has no analytics or crash SDK | matches |
| App code makes no network request of its own | no `fetch`, `axios` or XHR in `mobile/src` or `mobile/app`; network use comes only from the ads SDK | matches |
| Reminders are local and need no internet | `expo-notifications` local scheduling; push permission (c2dm RECEIVE) blocked | matches |
| No location, contacts, camera, microphone, exact alarm | merged release APK permission list (Stage 3) | matches |
| Storage permissions are not in the release app | blocked in `app.json`; the *source* manifest template still lists READ/WRITE_EXTERNAL_STORAGE, but the merged release APK does not | matches for the shipped app; the template is a known leftover, not shipped |
| Ads need internet; the space stays empty when offline | `AdSlot` renders nothing until a load succeeds | matches |
| Consent step before personalised ads | `consent.ts` (`canRequestAds`), UMP | matches (what regions show the form: VERIFY) |
| Reset local data removes all app data | `resetLocalData` action | matches |
| Advertising ID is processed by the ads SDK | AD_ID in the release APK (Stage 3) | matches |

Not claimed anywhere: legal compliance with any law, and "no data is collected".
