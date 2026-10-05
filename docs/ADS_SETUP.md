# Ads setup (Phase 7)

AdMob + UMP consent, added in `mobile/src/ads/`. This page is the operational how-to; see
`docs/PROGRESS.md` for what was built and verified, and `docs/PRIVACY_AND_ADS.md` for the privacy
side (Data safety form, privacy policy).

## Package and platform

- `react-native-google-mobile-ads@17.2.0` (latest stable at the time of writing), installed with
  `npm install` (`npx expo install` could not reach Expo's servers from this sandbox; the version
  was taken from npm's registry directly — re-run `npx expo install --check` on a networked
  machine to confirm it is still SDK-57 compatible).
- Config plugin added to `app.json` (`"react-native-google-mobile-ads"` with `androidAppId`). It
  writes the AdMob App ID into the Android manifest as a `<meta-data>` on `MainApplication`, and
  needs a native rebuild to take effect — **not supported in Expo Go**.
- UMP (consent) is part of the same package (`AdsConsent`), no separate install.

## Where things live

| What | Where |
|---|---|
| Test vs. real ad unit ids | `mobile/src/ads/adsConfig.ts` (dev → `TestIds`) and `mobile/src/ads/adsConfig.release.ts` (release → real ids) |
| AdMob **App ID** (not an ad unit id) | `mobile/app.json` → `expo.plugins` → `"react-native-google-mobile-ads"` → `androidAppId` |
| UMP consent wrapper | `mobile/src/ads/consent.ts` |
| SDK init (after consent only) | `mobile/src/ads/AdsManager.ts` |
| The `<AdSlot placement="...">` component | `mobile/src/ads/AdSlot.tsx` |
| Library inline-banner placement math | `mobile/src/ads/libraryAdPlacement.ts` |

## Test IDs used right now

`app.json` uses Google's published **test** AdMob App ID:
`ca-app-pub-3940256099942544~3347511713`. Every ad unit id in a dev/debug build comes from the
package's own `TestIds.ADAPTIVE_BANNER` (see `adsConfig.ts`). None of this needs changing to test
the feature; it only needs changing to publish with real ads.

## Filling in the real IDs before release

1. Create (or sign in to) your AdMob account and link your app once it exists in the Play Console
   (AdMob can create an "App not linked yet" app id before publishing too).
2. In AdMob, create the app and **two ad units**, both **Banner → Adaptive banner**:
   - "Home banner" (placement `home_banner`)
   - "Library banner" (placement `library_banner`)
3. Put the **App ID** (the `ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY` one, with a `~`) into
   `mobile/app.json` → the `react-native-google-mobile-ads` plugin's `androidAppId`.
4. Put each **ad unit id** (the one with a `/`, not a `~`) into
   `mobile/src/ads/adsConfig.release.ts`, replacing the matching empty string. Leave a placement's
   string empty to ship without ads for that placement (never a test ad in a release build).
5. Run the clean-install + test checklist from `CLAUDE.md` again, then `npx expo prebuild --clean`
   and a real release build.
6. **Never commit a real ad unit id or App ID.** `mobile/__tests__/adsConfig.test.ts` fails the
   build if it finds an AdMob publisher id (`ca-app-pub-<16 digits>`) anywhere in the repo other
   than Google's own test id.

## Testing with test ads on a real device

- Dev/debug builds already use `TestIds`, so you will see ads labelled "Test Ad" without any setup.
- If you ever request a *production* ad unit id from a real device while developing (don't — use
  test ids for that), AdMob requires you to **register that device as a test device** first
  (Settings → your app → Test devices in the AdMob console, using the device id AdMob/Logcat
  prints the first time you load a real ad unit from it), or add it via
  `mobileAds().setRequestConfiguration({ testDeviceIdentifiers: [...] })`.
- **Never click your own live ads.** Clicking real ads you serve yourself is against AdMob policy
  and can get the account suspended. Test ads are safe to click; real ones are not, ever, even by
  accident while testing.

## Publishing the consent message (UMP / "Privacy & messaging")

1. In the AdMob console, go to **Privacy & messaging** for this app.
2. Create a message (the GDPR/EEA consent form and, if you want it, the US states message). AdMob
   hosts and serves this form; the app's `AdsConsent.gatherConsent()` call shows it automatically
   when the UMP SDK decides it is required for that user.
3. Publish the message. Until it is published, `requestInfoUpdate`/`gatherConsent` will report no
   form is needed for anyone (so you will see no consent form while testing, by design).
4. The "Ad privacy choices" row in Settings only appears when the SDK reports
   `privacyOptionsRequirementStatus: REQUIRED` (e.g. certain EEA/UK consent setups) — this is
   normal for most test devices outside those regions.

## Dev-build workflow (Windows)

Expo Go cannot run this app once a native ads dependency is installed. On your Windows machine:

```powershell
cd mobile
npx expo run:android          # first build, and again after any native dependency change
npx expo start --dev-client   # day-to-day after that: starts Metro, connects to the dev-client build already on the device/emulator
```

- `android/` is git-ignored; it is regenerated by `expo prebuild`/`expo run:android` and should
  never be committed.
- If `app.json` changes in a way that affects native config (it does here: the ads plugin), run
  `npx expo prebuild --clean` before the next `expo run:android` so the generated project picks up
  the change.
- `npm run android` (`expo run:android`) and `npm start` already exist as package scripts; no new
  script was needed for this phase.

## Release checklist (ads-specific; see CLAUDE.md for the rest)

- [ ] Real App ID in `app.json`, real ad unit ids in `adsConfig.release.ts` (or deliberately left
      empty to ship without that placement)
- [ ] `mobile/__tests__/adsConfig.test.ts` passes (no real id committed)
- [ ] Consent message published in AdMob's Privacy & messaging
- [ ] `npx expo prebuild --clean` run, manifest checked for the real App ID meta-data
- [ ] A release build was tried on a real device/emulator with WiFi off, then on, and the ad slots
      behave as expected (collapse offline, appear online, never block anything)
- [ ] Ad content rating reviewed (currently `PG`, see `AdsManager.ts` for why) and still correct for
      your audience
- [ ] Data safety form in Play Console filled in using `docs/PRIVACY_AND_ADS.md`, verified against
      the AdMob/UMP version actually shipped
