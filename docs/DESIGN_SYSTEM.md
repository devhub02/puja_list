# Design system (Phase 1)

Source of truth in code: `mobile/src/theme/tokens.ts`. This page records the decisions and why.

## How `ui-ux-pro-max` was used

The skill lives in `.agents/skills/ui-ux-pro-max/` and its search script was run for real
(`--design-system`, `--domain typography|color|ux|google-fonts`, `--stack react-native`, and
`references/pro-rules.md` as the pre-delivery checklist). What was taken, and what was not:

| Skill output | Decision |
|---|---|
| `--design-system` suggested "Organic Biophilic" (sage/teal) and the `color` domain suggested purple for religious/meditation | **Rejected.** CLAUDE.md palette wins (cream, saffron, maroon, gold). Only structure kept. |
| Style traits: rounded 16–24 corners, soft natural shadows, avoid inconsistent styling | Used: card radius 16, hero/halo 24+, warm-tinted soft shadows (maroon shadow colour, not grey). |
| Typography: "Soft Rounded" family (Nunito Sans) is friendly/calm; Noto Sans Devanagari is available as a Google font | Latin = **Nunito Sans**, Devanagari = **Noto Sans Devanagari**; both bundled in `assets/fonts` (SIL OFL licences alongside). |
| UX: touch target 48dp on Android, 8px gap between targets | `minTouchTarget = 48`; segment gaps 2dp inside one control, 16dp+ between controls. |
| UX: "Empty states: show a helpful message", never a blank screen | `EmptyState` with icon, badge, title and body on Home/Library/My Preparation. |
| UX: contrast 4.5:1 text, dividers/boundaries visible in both themes, dark mode verified independently | Contrast is asserted in unit tests for both palettes (see below). |
| pro-rules: no emoji as icons, one icon family, tokenised sizes, selected/pressed state exposed, decorative icons hidden from screen readers, pressed state must not shift layout | `@expo/vector-icons` (Material Community Icons only), `iconSize` tokens, `accessibilityState`, `accessibilityElementsHidden` on decorative halo, colour-only pressed feedback. |
| Web-only items (hover, CSS, landing patterns, "Hero + Testimonials") | Ignored. |

## Colour tokens

| Token | Light | Dark | Use |
|---|---|---|---|
| background | `#FFF8EC` cream | `#1C1411` | Screen |
| surface | `#FFFFFF` | `#2A1E19` | Cards |
| surfaceAlt | `#FBEFD9` | `#35261F` | Preview, disclaimer, badges |
| border | `#E8D8BC` | `#4A372D` | Decorative card edge (hairline, not meaning) |
| borderStrong | `#8E7658` | `#9A7F6C` | Control outlines (≥3:1) |
| text | `#3A2A22` | `#F6EBDD` | Body |
| textSecondary | `#6B5648` | `#C9B5A3` | Helper text |
| heading | `#6B1D2A` deep maroon | `#F2B8A8` soft rose | Headings |
| primary | `#A84606` | `#F28B3C` | Saffron: buttons, selected, icons, links |
| onPrimary | `#FFFFFF` | `#2A1206` | Text on primary |
| primaryTint | `#FBE3C8` | `#4A2A14` | Icon halo |
| gold | `#C9A24B` | `#E0BC6A` | Decoration only (rings) |
| goldText | `#7A5F18` | `#E0BC6A` | Small gold labels |

**Deliberate deviation:** the brand saffron `#E8741E` is only 2.86:1 on cream and 3.2:1 with white text,
so it fails AA. The interactive saffron is therefore a deeper `#A84606` in light mode (5.9:1 with white).
`#E8741E` is no longer used anywhere. Gold `#C9A24B` is 2.27:1 on cream, so it is never used for text or
meaning, only for decorative rings; text uses `goldText`.

## Contrast (computed from the tokens; asserted in `__tests__/theme.test.ts`)

All text pairs are ≥ 4.5:1 (WCAG AA) in both themes. No pair is below AA.

| Pair | Light | Dark |
|---|---|---|
| text / background | 12.96 | 15.42 |
| text / surface | 13.69 | 13.75 |
| textSecondary / background | 6.52 | 9.18 |
| textSecondary / surfaceAlt | 6.05 | 7.33 |
| heading / background | 10.84 | 10.54 |
| heading / surfaceAlt | 10.06 | 8.42 |
| primary / background | 5.61 | 7.37 |
| primary / surfaceAlt | 5.21 | 5.89 |
| onPrimary / primary | 5.93 | 7.19 |
| goldText / background | 5.72 | 10.00 |
| primary / tab bar | 5.93 | 6.92 |
| textSecondary / tab bar | 6.89 | 8.61 |
| borderStrong / surface (non-text, ≥3) | 4.30 | 4.33 |

Not text-contrast checked on purpose: `gold` (decorative only) and `border` (hairline card edges; cards are
separated by surface colour and shadow as well). Disabled states do not exist yet.

## Typography

Fonts: Nunito Sans 400/600/700 (Latin) and Noto Sans Devanagari 400/600/700 (Hindi; includes Latin glyphs so
mixed text stays in one family). The family follows the selected language's script.

| Variant | Size (sp) | Weight | Scales with text-size setting |
|---|---|---|---|
| display | 32 | bold | yes |
| title | 24 | bold | yes |
| heading | 20 | semibold | yes |
| subheading | 17 | semibold | yes |
| body | 16 | regular | yes |
| bodySmall | 14 | regular | yes |
| caption | 13 | regular | yes |
| label | 13 | semibold | no (tab and segment labels) |

Line height: ×1.4 for Latin, **×1.65 for Devanagari** so matras above and below the line are not clipped.
Android font padding is left at its default for the same reason.

Text-size setting factor: small 0.875, medium 1, large 1.15, extra large 1.3. The OS font scale is respected
on top of it, capped at 1.6× (`maxFontSizeMultiplier`) so layouts do not break. Tab labels and segment
labels ignore the in-app setting (navigation chrome keeps a stable size); tab labels also ignore the OS scale
so four labels fit on a 360dp screen. Segmented controls stack vertically when the OS scale exceeds 1.3.

## Spacing, radius, icons, elevation

- Spacing (4/8 rhythm): 4, 8, 12, 16, 24, 32, 48. Screen gutter 16, section gap 24, card padding 16.
- Radius: 8, 12, 16 (cards), 24, pill. Cards 16; segmented control 12.
- Icons: 20 / 24 / 32 / 56 (hero). One family (Material Community Icons); filled when active, outline otherwise.
- Elevation: level 0/1/2. Light = soft warm maroon-tinted shadow; dark = no shadow, depth comes from lighter surfaces.
- Content is capped at 640dp wide and centred so text stays readable on tablets.

## Component rules

- `AppText` is the only text primitive; never use raw `Text` (it applies font, scale, line height, colour token).
- Colours come only from `useTheme().colors`; no hex values in screens.
- `Card`: surface fill, hairline border, radius 16, level-1 shadow. `tone="alt"` for secondary information.
- `EmptyState`: 112dp halo with gold ring, primary icon, optional "coming soon" badge, centred copy. Honest: it says the
  feature is not available yet.
- `SegmentedControl`: radio group; each option has role `radio`, label and `selected` state, min height 48dp, 1dp
  strong outline, colour-only pressed feedback (no layout shift).
- `ScreenContainer`: themed background, safe-area top inset, scrolls, 640dp max width.
- Tab bar: 4 tabs, filled/outline icon pair, translated labels, accessibility label per tab.

## Accessibility notes

- Touch targets ≥ 48dp (segments, tabs).
- Roles/labels: headings are `header`, options are `radio` with selected state, logo has an image label, decorative
  halos are hidden from the accessibility tree.
- Selected state is shown by fill colour **and** exposed to screen readers (colour is not the only signal for them);
  visually it is also a strong fill change, not just a hue shift.
- Reduced motion: no custom animations are used in this phase.
- Dark mode palette was designed and checked on its own, not derived by inversion.

## UI review against the skill's pre-delivery checklist

Done and verified by code/tests: no emoji icons, single icon family, tokenised colours, light/dark contrast,
touch-target size, roles/labels, Hindi line height, text-size scaling, offline fonts, safe-area top inset.

**Not verifiable in this environment (no device/emulator):** real rendering on a 360dp phone, visual check at the
largest OS font size, landscape, tablet, gesture-bar/safe-area bottom behaviour, and whether four tab labels fit in
Hindi/English at 360dp. These must be checked on a real Android phone.


---

# Phase 4 additions: browse screens (Home, Library, Search, Puja details)

The `ui-ux-pro-max` skill was used again (`.agents/skills/ui-ux-pro-max/`: the `ux` and `icons` rules, the
`references/pro-rules.md` checklist, and its React Native stack notes). As in Phase 1, its suggested style and palette were
**not** adopted; CLAUDE.md's palette wins. Rules that were applied:

| Skill guidance | Decision |
|---|---|
| Touch targets 44-48 dp, 8 dp between targets | Every tappable thing is >= 48 dp: chips (48), icon buttons (48 x 48), buttons (48), search bar (52), result rows (64). Heart is a separate 48 dp button next to the row, never nested inside the row's button. |
| Search UX: show recents on empty focus, instant suggestions, clear button, helpful no-results text | Search screen: recents + "Try searching for" chips when empty; up to 6 instant suggestions while typing; "See all results" and the keyboard search key open the full list; X clears and keeps focus; no-results explains what to try. |
| Empty / loading / error states must never be blank | `LoadingState`, `ErrorState` (retry), `EmptyState` (optional recovery action) on every screen; each is translated. |
| Performance: lazy lists, WebP, reserve image space | Library is a virtualised `FlatList` (memoised rows, `windowSize 7`, `removeClippedSubviews`); all artwork is WebP <= 80 KB with fixed sizes, so nothing shifts while images load. |
| Decorative images hidden from screen readers | `PujaImage` is hidden from the accessibility tree; the name next to it carries the meaning. |
| Icon-only buttons need labels | `IconButton` requires `accessibilityLabel`; the heart says what pressing it does ("Add X to favorites" / "Remove X from favorites"). |
| Don't rely on colour alone | Selected chips are filled **and** exposed as `selected`/`checked`; review status is text + icon, not just colour. |

## New components (all in `mobile/src/components`)

- **`SearchBar`**: the ONE search field. Three uses: Home (`onPress` = launcher: looks identical but is a button that opens
  the Search screen, so the keyboard never pops up on Home), Library (filters the list in place, sits above the list so it
  stays reachable), Search screen (live results). 52 dp tall, 2 dp border that turns `focusRing` on focus, X button only when
  there is text, `returnKeyType="search"`. No explicit `lineHeight` on the input (it clips Devanagari matras on Android).
- **`Chip`**: 48 dp filter pill. `role="radio"` for single-choice groups (category, type), `role="checkbox"` for on/off
  shortcuts (Favorites, Recently viewed). Selected = saffron fill with `onPrimary` text.
- **`PujaCard`** (Library row): 88 dp artwork, name (2 lines max), other-language name, category, review badge, optional
  "Contains: ..." line, heart. `React.memo`; no per-render work.
- **`PujaTile`** (Home rows): 220 dp wide, 124 dp artwork, name, heart.
- **`CategoryCard`**: two per row on Home; category artwork or icon fallback, name, "N pujas" (or "More coming soon" when the
  category has none yet).
- **`PujaImage`**: puja artwork -> category artwork -> vector icon on a `primaryTint` halo. Never throws; `onError` falls back.
- **`ReviewBadge`**: pill with icon + label (`AI draft`, `Cross-checked`, `Expert verified`) on `surfaceAlt`. Shown on every card and on
  Details for anything that is not `expert_verified`.
- **`Button`** (primary / outline, optional icon, `selected` state), **`IconButton`**, **`FavoriteButton`**, **`SearchResultRow`**,
  **`LoadingState` / `ErrorState`**.

## Screen rules

- **Home**: logo + name + tagline, today (Gregorian only), search launcher, Featured, six categories, Saved, Recently viewed.
  Featured rule: the content has no `isFeatured` flag, so Home shows the first six active pujas by id (stable, not date- or
  language-dependent). **No "Upcoming festivals" section**: the calendar has no dates, and dates are never faked or computed.
- **Library**: title, search bar, then a list whose header holds filters: shortcuts (Favorites, Recently viewed), Category,
  Type (festival / household), result count and "Clear filters". Only categories that contain pujas get a chip. **No month
  filter**: the content has no month field and the calendar is empty, so a month filter would have to guess. Order:
  alphabetical in the selected language (`Intl.Collator`, so Devanagari sorts in dictionary order); best match first while
  searching; newest first under "Recently viewed".
- **Search**: back button + bar (auto-focus). Empty: recents (with Clear all) + suggestions. Typing: <= 6 suggestions. A
  samagri-only match is shown as the item with "Found in: <puja>" and opens that puja. A search is recorded only when a result
  is opened or the user submits, never per keystroke.
- **Puja details**: hero artwork, name + other-language line, category, review badge, Save button, review-status card
  (explains `ai_drafted`/`cross_checked`), About, Significance, "When is it observed?" ("Date not available" until the
  calendar phase), Safety and health (when the puja has such notes), Regional and family variations (labelled as practices of
  some regions/families), Preparation at a glance (samagri counts + step count, read-only), how the guide was prepared
  (`sourceNote`), and the standard disclaimer plus the puja's own disclaimer if it has one. **No Samagri / Vidhi / Start
  buttons** (Phase 5).
- Content fields the screens would like but the schema does not have yet (not invented, not shown): `generalDateDescription`,
  common traditions, a structured safety field, `isFeatured`, festival month.

## Safety notes (stop-gap)

Safety/health notes are authored as vidhi steps titled "Safety Note: ...", "Health Note: ..." or "Health and Safety Note ...".
`extractSafetyNotes` (`src/utils/pujaDisplay.ts`) finds them by that English title pattern and shows them in a highlighted card.
This is a deliberate stop-gap; the proper fix is a structured `safetyNotes` field in the content schema.

## Images

Brand, category and puja artwork live in `mobile/assets/images/{brand,categories,pujas}` as WebP (PNG for the three brand files),
all under 150 KB. `src/theme/images.ts` is the only id -> image mapping. Cards use the image 88 dp wide; Details uses it full
width at 16:9. The splash uses the cream background in dark mode too, because the logo's maroon text is unreadable on the dark
background.

## Phase 4 UI review

Verified by code/tests: 48 dp targets and labels, selected states, Hindi + English rendering of every screen, no-results and
error states, light/dark colours come only from tokens. **Not verifiable here (no emulator):** rendering at 360 dp with the
largest font, Hindi line clipping in the search field and cards, scroll smoothness of the Library on a low-end phone, the
adaptive icon crop, and the splash screen. See the checklist in `docs/PROGRESS.md`.


---

# Phase 5 additions: Samagri checklist, Vidhi reader, My Preparation

`ui-ux-pro-max` (`.agents/skills/ui-ux-pro-max/`) was used again, for real: its `SKILL.md` workflow, `search.py` queries (`--domain ux` for touch targets/spacing, confirmation dialogs, progress indicators, modal focus, and `--stack react-native` for accessibility labels and list rendering) and the canonical Pre-Delivery Checklist in `references/pro-rules.md`. The skill is not registered with the Skill tool in this environment, so it was applied by reading and running its files directly. As before, its suggested style/palette were not adopted; CLAUDE.md's palette wins (React Native, not web).

| Skill guidance | Decision |
|---|---|
| Touch targets 48 dp on Android, 8 dp gap between targets | Checklist row = whole text area ticks it (min 48 dp tall); edit/delete/expand/section/chip/dialog buttons all >= 48 dp; 8 dp between chips and buttons. |
| "Confirm before delete / irreversible actions" | Confirmation dialog for: delete custom item, reset checklist, delete preparation, clear completed custom items. Duplicate and rename are reversible and have a form dialog instead. |
| "Silent success" is an anti-pattern ("brief success message") | `notify()` after reset, delete, duplicate, rename, clear: an Android toast (TalkBack reads it) or a screen-reader announcement. |
| "Step indicators or progress bar" | `ProgressBar` on the checklist, on each preparation card, on Puja details and in the reader ("Step n of N" + bar). Always with a number next to it, never colour alone. |
| Disabled controls: real disabled semantics, reduced emphasis, no tap action | `Button disabled` (45% opacity, `accessibilityState.disabled`), used for "Reset" with nothing ticked, "Previous" on the first step, A-/A+ at their limits. |
| Form fields: visible label, error near the field | `TextField`: label above (never placeholder-only), 2 dp border that turns `focusRing` on focus/error, error text under the field with an alert role. |
| "Don't rely on colour alone" | A ticked item shows a filled box icon **and** a line through the name **and** the `checked` state; collapsed/expanded sections expose `expanded`; the optional-step marker is text + icon. |
| No emoji, one icon family, tokenised sizes | Material Community Icons only, `iconSize` tokens. |
| Memoised list rows, stable keys | `FlatList` + `React.memo` rows (`ChecklistRow`, `PreparationCard`) with stable string keys; Samagri and My Preparation are virtualised. |
| Focus ring on every interactive control | `TextField` has one. Buttons/chips rely on the Android pressed ripple and system focus highlight, as in earlier phases; no custom ring was added. Open item. |
| Modal scrim legibility | The dialog card is opaque (`surface`), so text legibility does not depend on the scrim; the scrim (`rgba(28,20,17,0.6)`) only separates the card from the screen behind it in both themes. |

## New components (`mobile/src/components`)

- **`ChecklistRow`**: one checklist item. A 48 dp `checkbox` Pressable covers the check icon and all text, so the thumb target is large. Name (subheading), one summary line, optional labelled detail lines ("Quantity: ...", "Preparation: ...", "Regional note: ..."). When the text is long (> 140 characters) the summary is clamped to 2 lines, details are hidden and a separate 48 dp **Show more / Show less** button (role `button`, `expanded` state, per-item label) toggles them. Ticked = filled box + line-through + secondary colour. Custom rows add separate Edit / Delete icon buttons (never nested inside the checkbox Pressable). `compact` (shopping list) shows only name + one summary line. Highlight = 2 dp primary border + `surfaceAlt` fill (the item opened from a vidhi chip).
- **`ProgressBar`**: 10 dp track (`surfaceAlt` + 1 dp `borderStrong` outline) with a `primary` fill. Role `progressbar` with `accessibilityValue {min, max, now, text}`.
- **`Dialog`**: Modal on a scrim; Android back and a tap outside close it; title is a header; optional message and content (fields, lists); actions are stacked full-width `Button`s (main action first, Cancel last) so they never wrap badly at the largest text size; the body scrolls when long (max 86% of the window height). No danger colour exists in the palette, so a destructive confirm is a normal primary button whose title and body say exactly what will be lost.
- **`TextField`**: labelled `TextInput`, min 48 dp (96 dp multiline), no explicit `lineHeight` (it clips Devanagari matras inside Android text fields, same rule as `SearchBar`).
- **`TextSizeControl`**: `A-` / `A+` with the current size name between them (live region). It writes the **same** `textSize` in the settings store that Settings uses; nothing separate. The button at the end of the range is disabled.
- **`PreparationCard`**: puja name, label (gold), progress bar, **"Required x of y" as the prominent line** (subheading), overall count, vidhi position, last opened date; buttons Checklist / Vidhi and a 48 dp More (...) button. A puja that no longer exists shows "This puja is no longer available" with management actions only.
- `Button` gained `disabled`; `Chip` gained `role="button"` (used for the related-samagri chips).

## Screen rules

- **Samagri**: title + puja name; a progress card (bar, "x of y items checked", "n checked . m left", then a tinted **"Required items: x of y"** box with its own icon, the label of the checklist if any, an autosave hint, the review badge); filter chips (All / Required / Common / Optional / Mine, a radio group) and an "Unchecked only" checkbox chip; Add item / Reset checklist buttons; then sections in the fixed order **Required, Commonly used, Optional, My items**, each a 48 dp header button with its own `checked/total` and a chevron (`expanded` state). Section counters always count the whole section, not just what the filter shows. Items the guide no longer lists appear last under "No longer in the guide" (not counted, removable). The standard disclaimer closes the list. Empty states: no samagri (explains and offers Add item), nothing matches the filter (offers "Show all items"), no custom items.
- **Vidhi reader**: top bar (back, "Vidhi" + puja name, safety button when the puja has safety notes); "Step n of N" with A-/A+ and a progress bar; the step (heading, optional-step pill, description, an **Important** card with a primary border, "Samagri for this step" chips); a fixed bottom bar with Previous / Next (Next becomes Finish on the last step) above the gesture bar. Safety notes: shown on their own screen before step 1 when starting from the beginning, and reachable at any time from the shield button (a dialog). Finished = a Completed screen (check icon, "You have read all N steps.", Read again from step 1, Open samagri checklist, Back to puja). Reader text uses the global text-size scale and the Devanagari line height (x1.65). The screen is kept awake while open. No ads, no interruptions.
- **Puja details**: "Start preparation" (primary), then Samagri and Vidhi (outline, side by side, wrapping on a narrow screen). When the user has a checklist for this puja a "Your preparation" card shows its label, bar and **"Required x of y"**. With an existing preparation, Start opens a dialog: Continue the existing one / Start a new one / Cancel.
- **My Preparation**: a "Checklists | Shopping list" segmented control. Checklists: Current preparations (not 100% ticked, most recently opened first), Saved pujas, Recently used (the five most recently opened, compact rows). Real empty state with an "Open library" button when there are no preparations. Shopping list: a chip per preparation (only when there are several), "n items left", then the unchecked items grouped Required, Commonly used, Optional, My items as compact tick-off rows. No reminder UI of any kind.

## Accessibility notes (Phase 5)

- Checklist rows announce as `checkbox` with the checked state; section headers announce `expanded`; progress bars announce a value; the reader's step title carries "Step n of N: title"; every icon-only button has a label that includes the item name ("Delete Ghee", "Open Vidhi: Rich Puja, Home").
- Dialogs close with Android back; the text fields have visible labels; validation errors are announced.
- 360 dp is the test width in the component tests; at the largest text size the dialogs stack their buttons, the reader and checklist wrap, and A-/A+ stay 48 dp.
- Reduced motion: only the dialog fade is animated (RN Modal `fade`); nothing else moves except the list scrolling to a focused item.

## Phase 5 UI review

Verified by code/tests: roles, labels and states, 48 dp targets (set in styles), light/dark colours only from tokens, Hindi and English text for every screen (including all 16 real pujas), line-height ratio in Hindi, text-size scaling in the reader, disabled states, dialog confirmation flows. **Not verifiable here (no emulator):** keyboard behaviour in the dialogs (whether the Save button stays visible above the keyboard), rendering at 360 dp with the largest OS font, scroll-to-item smoothness after tapping a related-samagri chip, how the bottom bar sits above the gesture bar, the toast, and keep-awake. See `docs/PROGRESS.md`.


---

# Phase 6B additions: Calendar tab, Festival Details, Home upcoming festivals

`ui-ux-pro-max` (`.agents/skills/ui-ux-pro-max/`) was used again by reading its `SKILL.md`, running `search.py` (`--stack react-native` for list virtualisation and memoised rows; the `ux` domain for the calendar/date query returned no match, so the rules below come from the skill's existing touch-target, empty-state, "don't rely on colour alone" and `pro-rules.md` checklist guidance, labelled as a fallback) and the pre-delivery checklist in `references/pro-rules.md`. It is not registered with the Skill tool in this environment. As before, CLAUDE.md's palette wins (React Native, not web); no new colour token was added.

| Skill guidance | Decision |
|---|---|
| Touch targets 48dp, 8dp between targets | Day cell 48dp tall (about 47dp wide at 360dp: seven columns in 16dp gutters, a known tiny shortfall), month arrows `IconButton` 48x48, Today button 48, chips 48, festival row min 64. |
| Virtualised lists, memoised rows, stable keys | Month view = `FlatList` (header holds filters, grid, note), All festivals = `SectionList`; `FestivalRow` and `DayCell` are `React.memo`; keys are `festivalId:dateId`. `initialNumToRender` 6 (month) and 12 (All: each section counts its header and footer as cells). |
| Don't rely on colour alone | Today = ring **and** "today" in the accessibility label; selected = fill **and** `selected` state; certainty = icon + text label, never colour; a multi-day festival is a bar shape, not just a hue. |
| Empty / loading / error states never blank | `LoadingState`, `ErrorState` (retry), `EmptyState` with "Clear filters" / "Open All festivals", a month-without-data note (the grid stays), a year-without-data note, an empty-day card. |
| Icon-only buttons need labels; decorative icons hidden | Month/year arrows have labels ("Previous month"); icons inside rows and cells are hidden from the accessibility tree. |
| Disabled/absent data is explained, not hidden | Festivals without a date are listed under "Date not available" with a hint; they are never dropped or guessed. |

## New components (`mobile/src/components`)

- **`MonthGrid`**: weekday header (short names, long names as labels) and a 7-column grid of `DayCell`s. Markers: up to 3 dots (6dp) for single-day festivals, a 4dp bar through the days of a multi-day festival (rounded only at its first and last day, flush across week breaks and cell borders). Today = 2dp primary ring, selected = primary fill with `onPrimary` number and markers, days of neighbouring months are blank. Each cell is a `button` labelled "Sunday, 8 November 2026, 2 festivals, today" with `selected` state; the markers are `no-hide-descendants` because the label says it all. Markers use `primary` on surface (5.9:1 light) and `onPrimary` on the filled cell.
- **`FestivalRow`**: the one row used by the Calendar (month and All views) and Home: name (subheading, 2 lines), calendar icon + date or range, certainty icon + label (`bodySmall`, `textSecondary`), "Mainly observed in: ..." caption (hidden with `compact`, used on Home), `ReviewBadge` when not expert verified, "Ongoing" label (gold text) for a multi-day festival that includes today, chevron. The whole card is one button whose accessibility label is "name. date. certainty. Ongoing". A row without a date reads "Date not available" in `textSecondary` and has no certainty line.
- **`ChipRow`**: the labelled, horizontally scrolling chip group (moved out of the Library screen; unchanged look).
- Certainty icons: confirmed `check-circle-outline`, provisional `help-circle-outline`, varies by region `map-marker-multiple-outline`, unknown `information-outline` (one family, outline style at this level).

## Screen rules

- **Calendar tab**: fixed top: title, `SearchBar` (festival names, English and Hindi), segmented control "Month | All festivals". Below, one list. Month view order: Region chips (All India first), Category chips, Clear filters (only when something is active), month arrows with the month title (live region), Today button, grid, "month has no data" card when the bundle has no date in the month, the panchang note (always), list title ("Festivals in November 2026" or "Festivals on <date>"), count, and "Show the whole month" or the hint to tap a day. All view order: filters, year arrows, "year has no data" card, panchang note, count, then month sections and a final "Date not available" section with its own hint.
- Filters: a festival with several regions matches any of them; `pan_india` festivals always match a region filter; the category filter is exact. Chips are generated only from the catalog, so none leads to nothing.
- **Festival Details**: back button, name (+ other language), category, review badge and, when not expert verified, the review explanation; About, Significance, "When is it observed?" (observance wording, then each bundled date with its certainty label, or "no date is available in this version"), "Mainly observed in" (regions, states), Puja guides (buttons to open each linked puja, or a card saying there is none yet), how the entry was prepared, the standard disclaimer in the selected language.
- **Home**: "Upcoming festivals" sits between the search launcher and Featured; at most 5 rows, then a 48dp "See calendar" link. The whole section is absent when there is nothing upcoming.
- **Puja Details**: a "Next date" card (date or range, certainty label, the panchang note) between About/Significance and Safety, only when the linked festival has an upcoming or ongoing bundled date.
- **Library card**: one extra caption line "Next: <date> · <certainty label>" under the category line when available.

## Phase 6B UI review

Verified by code/tests: roles, labels and selected states, labels for every day cell, Hindi and English strings and `Intl` month/day names, empty/loading/error states, filter logic, virtualised lists, colours only from tokens. **Not verifiable here (no emulator):** 360dp rendering of the grid (cell width about 47dp) and of five tab labels, the largest OS font size, Hindi weekday/month abbreviations on Hermes, scroll smoothness on a low-end phone, TalkBack reading of the grid. See `docs/PROGRESS.md`.

## Home "Next festival" (Phase 6B follow-up)

`ui-ux-pro-max` (`ux` search for hero/compact cards returned only unrelated animation and badge rules; the pre-delivery checklist in `references/pro-rules.md` was applied). Rules recorded:
- Home shows **one** upcoming festival as a hero, never a list; the full list lives in the Calendar tab. Any contradiction-prone detail (overlapping ranges of other festivals) is therefore not shown on Home.
- **`NextFestivalCard`**: surface card with a 1.5dp gold border (decoration), label "Next festival" in `goldText`, a countdown pill (`surfaceAlt` fill, `primary` bold text, 5.2:1 light / 5.9:1 dark), name (`heading`, 2 lines), date or range (body), certainty label (`bodySmall`, `textSecondary`), chevron. It carries no review badge: that stays on detail screens and lists. Countdown is text (never colour only).
- **See calendar row**: a 48dp-min link under the card: "See calendar" (primary, underlined, semibold) with an optional second line "N more in the next 30 days" (`textSecondary`) and an arrow; the count line is absent when it would be 0.
- Hindi uses "तारीख़" for dates and the countdown wording `आज से शुरू`, `N दिन में`, `चल रहा है`.



---

# Phase 6C additions: reminders, notification settings, reset, share

`ui-ux-pro-max` (`.agents/skills/ui-ux-pro-max/`) was used again by running `scripts/search.py` (`--domain ux` for "bottom sheet modal form", "destructive action confirmation", "empty state", "loading state async button", "date time picker"; `--stack react-native` for accessibility labels and touch) and the pre-delivery checklist in `references/pro-rules.md`. The queries "permission request explanation" and "switch toggle" returned **no match** in the skill's database, so those two decisions below are marked as fallbacks from the earlier phases' rules. It is not registered with the Skill tool in this environment. As before, CLAUDE.md's palette wins (React Native, not web); no colour token was added.

| Skill guidance | Decision |
|---|---|
| Confirm before delete / irreversible actions | Delete reminder: a `Dialog` ("Delete this reminder?"). Reset local data: a `Dialog` that lists exactly what is deleted and what is kept, and keeps its confirm button **disabled until the word RESET is typed**. Not asked for: switching a reminder off (reversible), saving. |
| Brief success message, never silent success | `notify()` toast after: reminder saved / updated / deleted / switched on or off, local data reset. A paused save says "saved, but it is paused" instead of "saved". |
| Disable the button during an async action; loading feedback | Save is disabled while saving; the reset confirm is disabled while resetting; lists show `LoadingState` / `ErrorState`. |
| Empty states: helpful message and an action | Manage reminders with no reminders: icon, "No reminders yet", how to make one, and a button to My Preparation. A group with no items says "Nothing here." The sheet's empty list says so in one line and the Add button is right under it. |
| Labels on inputs, never placeholder-only; error near the field | Reminder note uses `TextField` with a visible label. The save error (past time, limit, duplicate) sits directly above the Save button as an `alert` live region. Date and time are two labelled buttons whose text becomes the chosen value, not placeholder text. |
| Accessibility labels on every interactive control | Switch: "Reminder at <date and time>" with `switch` role and `checked`; edit and delete icons carry the time in their label; "Remind me about <puja>"; "Share checklist: <puja>". |
| Touch targets 48dp, 8dp between | Switch box 48x48, icon buttons 48x48, chips 48, "Remind me" header pill min 48 tall, all dialog buttons full width. |
| Locale-aware dates | Date and time text uses `Intl` in the selected language (`formatReminderWhen`, `formatClockTime`), formatted as a UTC instant so the device zone can never shift the shown day. |
| Permission requests (no skill match, fallback) | Never at app start. A short, plain "Allow reminders?" dialog comes **before** the system dialog and says what the permission is for and that nothing goes over the internet. If the user declines, nothing is blocked: the reminder is saved paused with a calm explanation and a button to the system settings. If Android has stopped asking for good, the explanation step is skipped (it would lead nowhere) and the same settings button is offered. |
| Switch (no skill match, fallback) | React Native `Switch` in a 48dp box with a text state label ("On" / "Off") next to it; colour is never the only signal. |

## New components (`mobile/src/components`)

- **`ReminderSheet`**: a bottom sheet (`Modal`, slide, scrim, 24dp top radius, max 92% of the window height, content max 640dp, back closes the form first, then the sheet). List mode: title, puja (and label), the battery note card, a note when notifications are off, the reminder rows or a one-line empty text, the limit hint ("up to 5"), **Add reminder** (disabled at the limit) and **Done**. Form mode: quick-pick chips (only with a real bundled festival date: "Day before the festival" / "Morning of the festival", they set the date only, with the line "Choose the time yourself"), **Choose date** and **Choose time** buttons (system pickers), an optional note, the error or the "Choose a date and a time to save." hint, the battery note, Save (disabled until both are chosen) and Cancel. Opening the sheet never creates a preparation; the first Save does (same lazy rule as Phase 5).
- **`ReminderRow`**: a card with the time (subheading), the note, a one-line status ("On", "Off", "Paused: ...", "Time has passed"), a switch (disabled for a past reminder), and edit/delete icon buttons.
- **`ReminderDialogs`**: the three dialogs of the flow (why we ask; saved but paused, with "Open notification settings"; delete confirmation).
- **`ShareChecklistDialog`** and **`SharePreparationDialog`**: the share dialog with two radio chips ("All items" / "Only items I still need") and Share/Cancel; a note and a no-op when nothing is left to share. The preparation version loads the checklist first (for My Preparation).
- **`NotificationsSettings`** and **`ResetLocalDataDialog`**: the Settings blocks.
- Native pickers: `@react-native-community/datetimepicker` (Android dialogs, Expo Go compatible) behind `utils/dateTimePicker.ts`.

## Screen rules

- **Samagri screen**: the top bar holds the back button on the left and, on the right, a "Remind me" pill (bell icon + text, 48dp, outlined in `primary`) and a share icon button. Neither exists while the puja is loading or missing.
- **My Preparation**: a "Manage reminders" outline button under the title; each card has a bell icon button before the "..." button (hidden for a puja that no longer exists); "Share checklist" is the first group of the "..." menu next to Rename/Duplicate.
- **Manage reminders** (`app/reminders.tsx`, a stack screen opened from Settings and My Preparation): back button, title, battery note, a note when notifications are off, then three groups with counts: Upcoming, Paused, Past. Each row shows the puja and label above the time. Real empty state. Editing opens the same sheet straight in its form.
- **Settings**: the Notifications section sits between Appearance and About: the switch (state text "On"/"Off"), a note when off, the permission line (Allowed / Not asked yet / Not allowed / Blocked in the phone settings), the battery note, "Manage reminders" and "Open system notification settings". **Reset local data** is the last block, in a card with a 1.5dp `heading`-coloured border (the palette has no danger colour, as noted in Phase 5), a header, one sentence and an outlined button.
- **Nothing interrupts the vidhi reader**: no reminder UI exists on it, and while it is on screen a reminder that arrives is added to the notification shade silently (no banner, no sound).
- The sheet and the Manage screen always show the battery wording: "Android may delay notifications because of battery optimization. Do not rely on a reminder as your only alarm."

## Accessibility notes (Phase 6C)

Switches announce their state and the time; icon buttons say what they act on; the error line is an `alert`; dialogs close with Android back; the reset confirm exposes `disabled`; headings are `header`. Hindi strings are natural Devanagari ("तारीख़", "रिमाइंडर", "सूचनाएँ"). **Not verifiable here (no emulator):** the sheet with the keyboard open (does Save stay reachable above the keyboard), the largest OS font at 360dp (the "Remind me" pill in the header next to the share button), how the system date/time dialogs look and behave on the real device, TalkBack reading of the switch rows, and the notification itself (see `docs/PROGRESS.md`).

---

# Phase 7 additions: AdMob + UMP consent

`ui-ux-pro-max` (`.agents/skills/ui-ux-pro-max/`) was used again via `scripts/search.py`. Two targeted queries hit no match in its local database (said so, no silent fallback): `--domain ux "ad banner placement label spacing"` and `--domain ux "consent dialog permission"`. A broader query, `--domain ux "disclosure label icon text"`, returned "Compact Label Overflow" (a badge/pill label should stay whole on one line rather than wrap or rely on a hover-only tooltip) and the existing "Input Labels" rule (never placeholder-only). The canonical pre-delivery checklist (`references/pro-rules.md`) and the Phase 6C fallback rules for permission dialogs and switches were reused rather than re-deriving them, since this phase adds no new dialog type. CLAUDE.md's palette wins throughout; no colour token was added.

| Guidance | Decision |
|---|---|
| Compact label should stay whole, not wrap (skill match, generalised from badges to this new label) | The "Ad"/"Advertisement" label (`AdSlot`) is one short `caption` line above the banner, never wrapped onto the ad itself; it does not truncate because the string is short in both languages. |
| Reserve space / avoid layout shift (Phase 4's own performance rule, reapplied) | `AdSlot` is zero-height until an ad has actually loaded, then it occupies its real height once — it never "pops in" over existing content because nothing below it has already been laid out at a wrong height (the surrounding screens use normal flow, not fixed offsets). |
| Icon-only buttons need a label (Phase 1 rule, reapplied) | The "Ad privacy choices" row is a full `Button` with icon **and** text label, never an icon alone. |
| 48dp touch targets, 8dp+ between controls (Phase 1 rule, reapplied) | The privacy-choices `Button` is the standard 48dp `Button`; the ad slot itself is never adjacent to a tappable control without the section's normal `spacing.md`/`spacing.lg` gap (CLAUDE.md "Ads rules": never next to a primary button). |
| Don't rely on colour alone (recurring rule) | The ad label is text, not a colour swatch or icon-only marker; the label is also read by screen readers (it is a normal `AppText`, not hidden from the accessibility tree) so a user relying on TalkBack also hears that the content is an ad. |

## `AdSlot` (`mobile/src/ads/AdSlot.tsx`)

Renders nothing — zero height, no placeholder, no skeleton — until the native banner reports
`onAdLoaded`. Collapses back to nothing on `onAdFailedToLoad` (this is also what happens when the
device is offline: the load simply fails). Once loaded, the slot is a plain block: a small
`caption`/`textSecondary` "Ad" label above the banner, a hairline border top and bottom (`colors.border`,
decorative only, not meaning), `spacing.md` vertical margin so it is never flush against the
section above or below it. Placements: Home (after the Featured row, before Categories — never
between the hero "Next festival" card and its "See calendar" link, and never touching a primary
button) and Library (inline in the list, see below). No ad appears anywhere not listed in CLAUDE.md
"Ads rules" (`mobile/__tests__/noAdsInForbiddenScreens.test.ts` checks this by source, since
rendering every forbidden screen would duplicate each screen's own heavy fixture setup).

## Library inline banner placement

Pure logic in `mobile/src/ads/libraryAdPlacement.ts`: the first ad after row 8, repeating every 15
rows after that, never as the first or last row (if there is no room to avoid the last row — e.g.
exactly 9 items — no ad is shown at all rather than bending that rule), and nothing at all while a
filter or search is active with fewer than 8 results. The Library screen turns this into actual
`FlatList` rows (a `Row` union of `{kind:'puja'}` / `{kind:'ad'}`) rather than a separate overlay,
so the virtualised list still only renders what is on screen.

## Settings: "About ads" and "Ad privacy choices"

A plain `Card` with two sentences (offline-first reminder, then what AdMob/UMP may process) sits
between About and the standard disclaimer — `AdsPrivacySettings` (`mobile/src/components/`). The
"Ad privacy choices" outline `Button` (bell-style icon + text, like the existing "Manage reminders"
row) is shown **only** when the UMP SDK reports `privacyOptionsRequirementStatus: REQUIRED`; most
test devices outside the EEA/UK will never see it, by design, not as a bug.

## Phase 7 UI review

Verified by code/tests: the ad slot renders nothing until loaded and nothing on error (unit
tested with a mocked native banner); the label is plain, readable text, not hidden from
accessibility; 48dp targets on the privacy-choices button; Library ad placement math (first/last
row, spacing, minimum results under a filter) is unit tested; no `AdSlot` import anywhere in the
screens CLAUDE.md forbids it from. **Not verifiable here (no emulator, and ad serving itself is
never something a sandbox can verify):** what a real AdMob test ad actually looks like next to the
Featured row and inside the Library list at 360dp, in light and dark, at the largest text size; the
real UMP consent form's own appearance and flow; TalkBack reading of the loaded ad slot and the
privacy-choices row end to end. See `docs/PROGRESS.md`.
