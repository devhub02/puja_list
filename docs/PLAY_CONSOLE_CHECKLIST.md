# Play Console checklist (new personal developer account)

Package: **com.pujasaathi.india**. Work top to bottom. Google's rules and screens change: **every item marked VERIFY must be
checked in the Play Console itself before you act on it.** This list promises no approval and no timeline.

Inputs this list depends on: `docs/RELEASE.md` (build and signing), `docs/PRIVACY_AND_ADS.md` (permissions and the
accepted-permission sources), `docs/privacy-policy/` (policy and URL), `docs/STORE_LISTING.md` (store text and graphics),
`docs/CONTENT_REVIEW_STATUS.md` (review status; produced in Stage 6).

## 1. Account
- [ ] Create a **personal** developer account. [VERIFY — the fee and the identity steps in the console.]
- [ ] Complete **identity verification** (Google asks for it; expect a document check). [VERIFY]
- [ ] Use a real contact email that you will read. This email is shown to users as the developer contact.

## 2. Create the app
- [ ] Create app: name **Puja Saathi**, default language **English (United States)** or **English (India)** [VERIFY the
      available options], free app, app type App.
- [ ] Confirm the package name shows **com.pujasaathi.india** after the first upload (the package cannot change).

## 3. App access
- [ ] The app needs no login. Declare **All functionality is available without special access**. [VERIFY wording]

## 4. Ads declaration
- [ ] Declare that the app **contains ads**. The ads are Google AdMob banners on Home and Library only.
- [ ] Real ad unit IDs are NOT in the build yet; the release shows no ads until they are set (see `docs/ADS_SETUP.md`).

## 5. Content rating (IARC questionnaire)
- [ ] Answer for this app: no violence, no sexual content, no gambling, no user-generated content, no social features,
      no location sharing, no in-app purchases. Religious content: state it truthfully (puja guidance, not depiction of
      violence). Ads: yes. [VERIFY each answer in the questionnaire; the questions change.]
- [ ] Expected rating: general audience. [VERIFY the rating the questionnaire returns.]

## 6. Target audience and content
- [ ] Target age: **not designed for children** (do not select the under-13 age groups). [VERIFY the options; a
      children's-app policy applies if you select them, and the ads SDK then needs child-directed settings.]
- [ ] Declare the app is not a news app and has no COVID or health-claims features. [VERIFY]

## 7. Data safety form
Base it on the real merged release manifest (Stage 3) and the SDK behaviour, not on guesses:
- [ ] **Data collected by the app's own code: none.** The app sends nothing to a server of its own.
- [ ] **Data handled by the ads SDK (Google AdMob / Mobile Ads):** device or other identifiers (the advertising ID), ad
      interaction data, and approximate location derived from IP. Shared with Google for ads. [VERIFY against Google's
      current Data safety guidance for the SDK version in the release build.]
- [ ] Data is encrypted in transit (the SDK's requests). [VERIFY]
- [ ] Users can request deletion: say what is true. Local data is deleted by uninstalling or with Reset local data;
      ad data is managed through Google and Android settings. [VERIFY]
- [ ] Do NOT answer "no data is collected" anywhere. [Rule from CLAUDE.md]

## 8. Privacy policy
- [ ] Publish the policy (`docs/privacy-policy/README.md`), then paste its https URL in Play Console (App content >
      Privacy policy). The same URL goes in `mobile/src/config/legal.ts`.
- [ ] Check the live URL opens in a browser and shows both English and Hindi.

## 9. Other declarations (check each; most do not apply)
- [ ] Government app: no. [VERIFY]
- [ ] Financial features: no. [VERIFY]
- [ ] Health apps: no (the guides mention fasting, but the app is not a health app). [VERIFY]
- [ ] Advertising ID declaration: **yes, the app uses the advertising ID through the ads SDK.** [VERIFY the exact form.]
- [ ] Other sensitive permissions: none beyond notifications, internet and network state. [VERIFY]

## 10. Play App Signing
- [ ] Enrol in **Play App Signing** (Google holds the app signing key). Keep your **upload key** safe (see
      `docs/RELEASE.md`). [VERIFY the current enrolment steps.]

## 11. Closed testing before production
- [ ] Create a **closed testing** track. [VERIFY the current requirement for new personal accounts in the console; the
      number of testers and the number of days have changed over time.]
- [ ] Add testers: you need at least the number of testers the console currently requires (the old rule was 12, for 14
      continuous days). [VERIFY]
- [ ] Upload the **AAB** (`mobile/android/app/build/outputs/bundle/release/app-release.aab`) built with the real signing
      key. The throwaway test key must NOT be used for upload.
- [ ] Keep testers opted in for the required period. [VERIFY]

## 12. Production access
- [ ] Apply for production access once the testing requirement is met. Answer the questions truthfully. [VERIFY the form.]
- [ ] No approval or date is promised here.

## 13. After publishing
- [ ] Link the app in **AdMob** (AdMob > Apps > add the Play app).
- [ ] Create the two ad units (Home banner, Library banner) and put the real unit IDs into `mobile/src/ads/adsConfig.release.ts`
      (see `docs/ADS_SETUP.md`). Never commit them to git; `scripts/release-check.py` and the secrets test catch
      committed IDs.
- [ ] Publish the AdMob **consent message** (Privacy & messaging) for the regions that need it.
- [ ] For each update: increase `expo.android.versionCode` by 1 in `mobile/app.json` (see `docs/RELEASE.md`), rebuild the AAB,
      and update the "Last released versionCode" line in `docs/RELEASE.md`.

## Do not promise
- Approval, a publish date, the length of the review, or the number of downloads.
