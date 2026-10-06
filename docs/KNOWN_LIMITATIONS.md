# Known limitations (v1, version 1.0.0)

An honest list. Each item is a fact from the repository or from a check that was run. Items marked **not verified** were
not checked on a phone.

## Content

- **16 puja guides** are in v1. This is a first batch, not a full list of pujas. The app does not claim to be exhaustive.
- **All 16 puja guides are `ai_drafted`** (drafted with AI, not yet checked by a person). **All 103 festival entries are
  `ai_drafted` too.** The app labels every guide that is not expert-verified. Counts are generated in
  [CONTENT_REVIEW_STATUS.md](CONTENT_REVIEW_STATUS.md).
- Guides describe general practice. Vidhi and samagri differ by region, family and sampradaya. The app says so; it does
  not replace a priest or the scriptures.
- Safety notes exist for some pujas (for example fasting and water-based rituals). They are not a complete safety review.

## Calendar

- **Dates exist for 25 festival entries only,** between **11 October 2026 and 23 December 2026**. Outside that range the
  app shows no date for any festival.
- The app **does not calculate dates** (no tithi or panchang computation). Dates come only from the bundled, verified file;
  the app says to check a local panchang for the exact date.
- There is **no 2027 calendar data** in v1.

## Ads

- Ads use Google AdMob and appear on **two screens only: Home and Library**. There are no interstitial, app-open or
  rewarded ads in v1.
- **Ads need internet.** Offline, the ad space stays empty; no feature depends on an ad.
- **Ads are off in release builds until real ad unit IDs are set** (`docs/ADS_GO_LIVE.md`). Until then a release build
  shows no ads at all.
- The ad banners were seen only as Google's **test** ads on the emulator. Real-ad behaviour and fill rates are **not
  verified**.

## Reminders

- Reminders are **local notifications** and are not guaranteed to fire at the exact minute. Android can delay them to save
  battery (the app shows this warning).
- In testing, one reminder fired about a minute after its time on the emulator. The emulator clock runs at a different
  speed from a real phone, so this is **not a real-device measurement**.
- The 2-minute reminder re-test on the final build is **not verified** (see `docs/PROGRESS.md`).

## Languages

- **Hindi and English only.** Hindi uses Devanagari with Noto Sans Devanagari. Other Indian languages are not included.

## Platform and testing

- **Android only.** There is no iOS build.
- **Tested mainly on one emulator** (a Pixel 9a image on Android 15, API level 35; the release target is API 36). No physical phone has been used
  for the checks recorded in this repository.
- **Startup:** cold starts were measured on the emulator only. The numbers are not representative of a phone.
- **Accessibility:** TalkBack labels were checked in component tests, not with a screen reader on a device. Large text
  and 360dp layouts were checked on the emulator for the screens listed in `docs/PROGRESS.md`; not every screen was
  covered. A layout fix for button rows is in place, with tests; before-and-after device screenshots on the final build
  are **not verified**.
- **Offline review of the release build** (no network, release APK) is **not verified** in full; see `docs/PROGRESS.md`.

## Store and release

- The app is **not published**. Play Console steps (account, verification, testers, production access) are documented in
  `docs/PLAY_CONSOLE_CHECKLIST.md` and depend on rules the console sets.
- The **release signing key is not created in the repository.** You create it and set the Gradle properties
  (`docs/RELEASE.md`).
- The privacy policy has **placeholders and VERIFY markers** and is not yet published. The Settings row for it stays hidden
  until the URL is set.
- The **licence is not chosen** (see the README).

## Features not in v1

- No accounts, sync, cloud backup, social features, pandit booking or online shopping.
- No puja search by month (no month data).
- No widgets, no home-screen shortcuts.
- Search covers puja guides and, through them, samagri and festival names. A festival without a puja guide is found in the Calendar, not as a separate search result.
