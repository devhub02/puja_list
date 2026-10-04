# Calendar data guide: how to fill `calendar_dates.csv`

Who this is for: you (the project owner). **Only you put dates into the project.** The tools never write, guess, compute or adjust a date, and neither does the app. A date that is not in the CSV simply shows as "date not available" in the app.

All the rows for 2026 and 2027 already exist in `content/calendar/calendar_dates.csv`, one per festival and year, with the date columns empty.

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

| Column | Fill it? | Meaning |
|--------|----------|---------|
| `festival_id` | no | The festival's stable id from `festivals.json` (for example `fest_holi`). Never change it. |
| `festival_name_en` | no | The English name, only to help you read the sheet. It is not checked and not imported. |
| `year` | no | The year of the row (2026 or 2027). Must match the year of `date`. |
| `date` | **yes** | First day of the festival in that year, as `YYYY-MM-DD` (four-digit year, two-digit month, two-digit day). Leave empty if you have no verified date: the row is then ignored. |
| `end_date` | optional | Last day, same format, for multi-day observances. Must not be before `date` and must be in the same year. Leave empty for one-day festivals. |
| `region` | optional | `all` (default; also used when the cell is blank) or one of `pan_india`, `north`, `east`, `west`, `south`, `central`, `north_east`, `himalayan`, `tribal`. See section 4. |
| `certainty` | **yes, when `date` is filled** | `confirmed`, `provisional` or `varies_by_region`. See section 3. |
| `source_note` | **yes, when `date` is filled** | Where you verified the date. See section 5. |

Only fill `date`, `end_date`, `certainty`, `source_note` and, when needed, `region`. Do not edit `festival_id`, `festival_name_en` or `year`.

Layout of a filled row (format only, **not a real date**):

```
festival_id,festival_name_en,year,date,end_date,region,certainty,source_note
fest_example,Example Festival,2026,YYYY-MM-DD,YYYY-MM-DD,all,confirmed,"<name of your source>, <date you checked>"
```

## 3. The `certainty` values

| Value | Use it when |
|-------|-------------|
| `confirmed` | You checked the date against **a named authoritative source** (for example a published panchang from an institution you trust, or an official announcement) and, ideally, a second one agrees. |
| `provisional` | You have a date from a source, but you could not cross-check it, or the source itself says it may change (for example a moonsighting-dependent or not-yet-announced date). The Calendar screen (a later phase) is expected to label it as less certain. |
| `varies_by_region` | The date genuinely differs between regions, traditions or calendars (amanta vs purnimanta, different local panchangs). Use it on **each** regional row of such a festival (section 4). |

When in doubt, choose the weaker value (`provisional`). If you cannot name a source, do not fill the date.

## 4. Festivals whose date differs by region or lunar calendar

- Lunar festivals move every year, so every row needs its own verified date. The `dateType` column of `docs/review/festivals.md` tells you which festivals are `lunar`, `solar`, `regional` or `variable`.
- If everyone celebrates on the same day, use one row with `region` = `all`.
- If the date differs by region (for example a festival kept on different days in the north and the south), **add one row per region** with the region value, copy `festival_id`, `festival_name_en` and `year` from the existing row, and set `certainty` to `varies_by_region`. You may keep the `all` row empty (it is then ignored) or fill it with the most common date.
- Use only one row per festival, year and region. Two filled rows with the same festival, year and region are rejected.
- Month names depend on the calendar (amanta or purnimanta). Always take the date from a source that states the Gregorian date, never work it out from a month name yourself.
- `variable` festivals (for example Satyanarayan Puja, or festivals whose days are announced locally each year) often have no single date. Leave them empty unless a source gives one.
- A date range cannot cross New Year (`end_date` must be in the same year as `date`). If you hit that case, tell me and we will extend the schema rather than bend the data.

## 5. Rule: every date needs a named source

**Every filled row needs at least a named source in `source_note`.** The import refuses a row without one. Write the source's name and where in it you looked, so someone else can re-check, for example:

- the name of the panchang or almanac, its year/edition and the page or section;
- or the official website or announcement, with the date you checked it;
- add "cross-checked with <second source>" if you did.

Do not write "internet", "Google" or "from memory". Do not copy a date from a source you cannot name. If a cell contains a comma, the spreadsheet will quote it for you; just save as CSV.

## 6. Step by step

1. Open `content/calendar/calendar_dates.csv` in Excel or Google Sheets.
2. For each festival you have a verified date for, fill `date` (and `end_date` if needed), `certainty` and `source_note`. Add region rows as in section 4.
3. Save as **CSV UTF-8** (Excel: "CSV UTF-8 (Comma delimited)"). Keep the header row and column order.
4. Run the import from the repository root:

   ```
   python scripts/import_calendar_dates.py
   ```

   - On success it prints how many dates were imported and writes `content/calendar/<year>.json` (and keeps `calendarYears` in `content_manifest.json` in step).
   - On a problem it prints every problem with its CSV **line number** (line 1 is the header, so the first festival row is line 2) and writes **nothing**. Fix the cells and run it again. The messages say what is wrong, for example "certainty is required when a date is given", "year column is 2027 but date 2026-..." or "duplicate festival/year/region".
5. Bump `contentVersion` in `content/content_manifest.json` by one. (The export refuses to publish changed content with an unchanged version.)
6. Validate and export:

   ```
   python scripts/validate_content.py
   python scripts/export_content.py
   ```

7. Rebuild the app. Festivals with a date for the year now have one; all others still show "date not available".

To add more festivals later, add them to `festivals.json`, then run `python scripts/export_dates_template.py`. It appends rows for the new festivals only and never touches rows you already filled. To cover another year, run it with `--years 2026 2027 2028` (the year list is only a default).

## 7. Things the tools will never do

- Fill, guess, "complete", compute or adjust a date, certainty or source.
- Overwrite or delete a row you edited.
- Accept a date without a certainty and a source.

If a date in the app looks wrong, the fix is always in this CSV (and then steps 4 to 7).
