# Data contract

The map is built from one Google Sheet (repo variable `SHEET_ID`) plus any
CSVs in `data/csv/`. Columns are matched by header name, in any order; extra
columns are ignored. Rows are grouped by their **Period** value, not by which
tab they live in, so the sheet can grow year over year and take rows from any
source: the Google Form, a program leader's paste, an old export.

## Sheet tabs

| tab        | columns                        | purpose                                              |
| ---------- | ------------------------------ | ---------------------------------------------------- |
| `Periods`  | Period, Display Name, Order    | which periods are published, their label and order   |
| `Sources`  | Tab                            | which other tabs to read                             |
| any listed | student columns below          | fellows; one row each                                |

`Periods` example:

| Period      | Display Name | Order |
| ----------- | ------------ | ----- |
| Summer 2026 |              | 1     |
| Summer 2025 |              | 2     |

Period is text and must match what student rows put in their Period column
(case, spaces and punctuation are ignored). Display Name defaults to Period;
Order is a number, lowest first. Rows whose Period is not in `Periods` are not
published (the build reports them). A period may not be named `all`. Share the
sheet as *Anyone with the link: Viewer*.

## Student columns

| header                   | required | notes                                                         |
| ------------------------ | :------: | ------------------------------------------------------------- |
| Period                   | yes      | must match a `Periods` row, e.g. `Summer 2026`                |
| Name                     | yes      |                                                               |
| Stanford Email           |          | dedup key with Period, last row wins; never published         |
| Class Year               |          |                                                               |
| Major                    |          |                                                               |
| School                   |          |                                                               |
| Affiliation              |          | sponsoring office or program                                  |
| Fellowship / Opportunity |          |                                                               |
| Interest Area            |          |                                                               |
| Organization             |          |                                                               |
| City                     |          | used with Country to geocode when Latitude/Longitude is blank |
| Country                  |          |                                                               |
| Website                  |          | organization site; used to fetch a logo when Logo is blank    |
| Latitude, Longitude      |          | override geocoding                                            |
| Logo                     |          | Google Drive link or image URL; overrides the fetched logo    |

Rows with no coordinates and an address that cannot be geocoded are skipped
and reported. A blank value in Class Year, School, Affiliation or Interest
Area shows on the site as "Not specified". Unrecognized or missing columns
are listed in the build report; trailing empty columns are ignored. Accepted header spellings include the old export's names
(`Fellowship location`, `Name of Partner Organization`, `Link to Logo`, ...);
see `ALIASES` in `scripts/build-data.ts`.

## Local CSVs

Optional. Every `data/csv/*.csv` is read as a source. If it has no Period
column, the file name is the period (`Summer_2024.csv` → `Summer 2024`).
Periods for local files go in `data/periods.json` as a list of objects with
the same fields as the `Periods` tab (`period`, `displayName`, `order`).

## Caches and snapshot (committed by the nightly build)

- `data/geocache.json`: City, Country → coordinates (Nominatim). Delete an
  entry to re-geocode it; failures retry after 30 days.
- `data/logocache.json` and `public/logos/`: one logo per organization
  domain. Delete both the entry and the file to re-fetch.
- `public/data/`: the published JSON, one file per period. Every change to the
  sheet shows up as a diff here.

## Google Form

One form, one response tab, listed in `Sources`. Settings: *Collect email
addresses: Verified*, restrict to Stanford accounts. Question titles are the
column headers above, so keep them as written.

| question                 | type                                            |
| ------------------------ | ----------------------------------------------- |
| Period                   | dropdown, one option: the current period        |
| Name                     | short answer                                    |
| Class Year               | dropdown                                        |
| Major                    | short answer                                    |
| School                   | dropdown                                        |
| Affiliation              | dropdown                                        |
| Fellowship / Opportunity | dropdown with *Other*                           |
| Interest Area            | dropdown                                        |
| Organization             | short answer                                    |
| City                     | short answer                                    |
| Country                  | dropdown                                        |
| Website                  | short answer, response validation: URL          |
| Logo                     | file upload, optional, images only              |

Each cycle: add the new class year, change the Period option, add a `Periods`
row. Program leaders entering students in bulk paste rows into any tab listed
in `Sources`, with the same headers.
