# Calendar data guide: how to fill `calendar_dates.csv`

Who this is for: you (the project owner). **Only you put dates into the project.** The tools never write, guess, compute or adjust a date, and neither does the app. A date that is not in the CSV simply shows as "date not available" in the app.

All the rows for 2026 and 2027 already exist in `content/calendar/calendar_dates.csv`, one per festival and year (you have since filled some of the dates).

## 1. The big picture

```
content/calendar/calendar_dates.csv      <- you fill this by hand, from verified sources
        |  python scripts/import_calendar_dates.py
        v
content/calendar/2026.json, 2027.json    <- generated; never edit by hand
        |  bump contentVersion, then validate_content.py and export_content.py
        v
mobile/assets/puja_data/content.json     <- bundled into the app
```

## 2. The columns

The CSV has six columns. (`region` and `source_note` were removed on purpose: every date is imported for all regions, and your sources are kept outside the repository.)

| Column | Fill it? | Meaning |
|--------|----------|---------|
| `festival_id` | no | The festival's stable id from `festivals.json` (for example `fest_holi`). Never change it. |
| `festival_name_en` | no | The English name, only to help you read the sheet. It is not checked and not imported. |
| `year` | no | The year of the row (2026 or 2027). Must match the year of `date`. |
| `date` | **yes** | First day of the festival in that year, as `YYYY-MM-DD` (four-digit year, two-digit month, two-digit day). Leave empty if you have no verified date: the row is then ignored. |
| `end_date` | optional | Last day, same format, for multi-day observances. Must not be before `date` and must be in the same year. Leave empty for one-day festivals. |
| `certainty` | **yes, when `date` is filled** | Exactly one of `confirmed`, `provisional`, `varies_by_region`. See section 3. |

Only fill `date`, `end_date` and `certainty`. Do not edit `festival_id`, `festival_name_en` or `year`.

Layout of a filled row (format only, **not a real date**):

```
festival_id,festival_name_en,year,date,end_date,certainty
fest_example,Example Festival,2026,YYYY-MM-DD,YYYY-MM-DD,confirmed
```

An older CSV that still has `region` and `source_note` columns is accepted; those two columns are ignored.

## 3. The `certainty` values

| Value | Use it when |
|-------|-------------|
| `confirmed` | You checked the date against **a named authoritative source** (for example a published panchang from an institution you trust, or an official announcement) and, ideally, a second one agrees. Keep the source name in your own records outside the repository. |
| `provisional` | You have a date from a source, but you could not cross-check it, or the source itself says it may change (for example a moonsighting-dependent or not-yet-announced date). The Calendar screen (a later phase) is expected to label it as less certain. |
| `varies_by_region` | The date genuinely differs between regions, traditions or calendars (amanta vs purnimanta, different local panchangs). Use it when the date you entered is not the same everywhere (section 4). |

When in doubt, choose the weaker value (`provisional`). If you cannot name a source (in your own records), do not fill the date.

Only these three words are accepted. Anything else (for example `high`, `medium` or `low`) is rejected by the import with the line number.

## 4. Festivals whose date differs by region or lunar calendar

- Lunar festivals move every year, so every row needs its own verified date. The `dateType` column of `docs/review/festivals.md` tells you which festivals are `lunar`, `solar`, `regional` or `variable`.
- The CSV has one row per festival per year and no region column, so you can store **one date** per festival and year. For a festival kept on different days in different regions, pick the date you want the app to show and set `certainty` to `varies_by_region` so the app can say the date differs by region. (Per-region dates are not possible with this format.)
- Month names depend on the calendar (amanta or purnimanta). Always take the date from a source that states the Gregorian date, never work it out from a month name yourself.
- `variable` festivals (for example Satyanarayan Puja, or festivals whose days are announced locally each year) often have no single date. Leave them empty unless a source gives one.
- A date range cannot cross New Year (`end_date` must be in the same year as `date`). If you hit that case, tell me and we will extend the schema rather than bend the data.
- Two filled rows with the same festival and year are rejected.

## 5. Sources

The repository does not store sources. Keep a named source for every date in your own records (outside the repo) and re-check from there when a date looks wrong. Do not fill a date you cannot source.

## 6. Step by step

1. Open `content/calendar/calendar_dates.csv` in Excel or Google Sheets.
2. For each festival you have a verified date for, fill `date` (and `end_date` if needed) and `certainty`.
3. Save as **CSV UTF-8** (Excel: "CSV UTF-8 (Comma delimited)"). Keep the header row and column order.
4. Run the import from the repository root:

   ```
   python scripts/import_calendar_dates.py
   ```

   - On success it prints how many dates were imported and writes `content/calendar/<year>.json` (and keeps `calendarYears` in `content_manifest.json` in step).
   - On a problem it prints every problem with its CSV **line number** (line 1 is the header, so the first festival row is line 2) and writes **nothing**. Fix the cells and run it again. The messages say what is wrong, for example "certainty is required when a date is given", "year column is 2027 but date 2026-..." or "duplicate festival/year".
5. Bump `contentVersion` in `content/content_manifest.json` by one. (The export refuses to publish changed content with an unchanged version.)
6. Validate and export:

   ```
   python scripts/validate_content.py
   python scripts/export_content.py
   ```

7. Rebuild the app. Festivals with a date for the year now have one; all others still show "date not available".

To add more festivals later, add them to `festivals.json`, then run `python scripts/export_dates_template.py`. It appends rows for the new festivals only and never touches rows you already filled. To cover another year, run it with `--years 2026 2027 2028` (the year list is only a default).

## 7. Things the tools will never do

- Fill, guess, "complete", compute or adjust a date or certainty.
- Overwrite or delete a row you edited.
- Accept a date without a valid certainty.

If a date in the app looks wrong, the fix is always in this CSV (and then steps 4 to 7).
