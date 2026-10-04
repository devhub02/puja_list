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
