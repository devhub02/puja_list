# Roadmap (internal planning, not a promise)

These are candidate next steps. Nothing here is scheduled, and nothing here is a promise to users. The store listing and
the privacy policy describe only what v1 does; do not copy items from this file into them.

## Content
- More puja guides, in batches by region (North, East, South, West, Central, North-East, tribal and regional), vrat,
  household and life-cycle observances.
- Expert verification: have a pandit or elder review the existing 16 guides and 103 festival entries, and upgrade their
  review status only after that review.
- Calendar dates for 2027 and later, filled from verified sources only (the calendar guide explains the process).

## Ads
- **App-open ad (candidate, not decided).** Frequency rules discussed so far:
  - Never on first launch, and never on a launch that comes from a reminder.
  - Never during the vidhi reader, a checklist, or any dialog.
  - A frequency cap, and only when an ad is already loaded.
  - Only with consent and internet, and never as a condition for using the app.
  - Ad content rating kept conservative for a general audience.
- Changing the ad placements requires updating `docs/ADS_SETUP.md`, `docs/PRIVACY_AND_ADS.md` and the Data safety answers
  before release.

## Languages
- More Indian languages: each one needs only new locale strings and content (the app is built for this), plus a font check.

## Features
- Optional Content API: the app could download newer content or calendar years. It must never be required; bundled
  content stays the fallback.
- Reminders: better handling of battery optimisation guidance per phone brand (still no promise of exact timing).

## Quality
- Device testing on a range of physical Android phones and screen sizes.
- A full TalkBack pass on every screen.
- Performance measured on a phone (cold start, memory after a long session, APK and AAB size).
