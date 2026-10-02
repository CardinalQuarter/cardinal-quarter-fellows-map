# Data contract

The map is built from one Google Sheet (repo secret `SHEET_ID`) plus any
CSVs in `data/csv/`. Columns are matched by header name, in any order; extra
columns are ignored. Rows are grouped by their **Period** value, not by which
tab they live in, so the sheet can grow year over year and take rows from any
source: the Google Form, a program leader's paste, an old export.

## Sheet tabs

`sheet-template.xlsx` in this folder is a ready-made copy of the layout below
(instructions tab, dropdowns, example rows). Import it into Google Sheets with
*File → Import → Upload → Replace spreadsheet*, then delete the example rows.

| tab        | columns                                   | purpose                                              |
| ---------- | ----------------------------------------- | ---------------------------------------------------- |
| `Periods`  | Period, Display Name, Order, Show         | which periods are published, their label and order   |
| `Groups`   | Group, Periods, Display Name, Order, Show | optional: tabs that combine periods ("Last 5 years") |
| `Sources`  | Tab                                       | which other tabs to read                             |
| any listed | student columns below                     | fellows; one row each                                |

`Periods` example:

| Period      | Display Name | Order | Show |
| ----------- | ------------ | ----- | ---- |
| Summer 2026 |              | 1     |      |
| Summer 2025 |              | 2     |      |
| Summer 2024 |              | 3     | No   |

Period is text and must match what student rows put in their Period column
(case, spaces and punctuation are ignored). Display Name defaults to Period.
Order is a number, lowest first; blank keeps the row order. Show is blank or
Yes to put the period in the nav, No to leave it out while still publishing it
(it stays in groups and in "All periods", and its link still works). This is
how to load a new period before announcing it, or to retire old years from
the nav without deleting them. Rows whose Period is not in `Periods` are not
published (the build reports them). A period may not be named `all`. Share the
sheet as *Anyone with the link: Viewer*.

`Groups` example (the tab is optional):

| Group          | Periods                  | Order | Show |
| -------------- | ------------------------ | ----- | ---- |
| Last 5 years   | latest 5                 | 3     |      |
| Pandemic years | Summer 2021, Summer 2020 |       | No   |

Periods is a list of Period values separated by commas, or one of two
keywords: `all` (every published period) or `latest N` (the first N periods
by Order, so "Last 5 years" never needs editing once the periods are kept in
order). Periods and groups share one Order scale, so `3` above puts the group
after Summer 2025; groups without an Order come after all periods. The
site adds an "All periods" tab at the end unless a group already covers every
period. Group names may not repeat a period name. Unknown periods in a group
are ignored and reported.

To keep Period values consistent, add Data validation to the Period column of
every student tab (*Data → Data validation → Dropdown from a range*, pointing
at the Period column of `Periods`), and use the same for Country, School and
Interest Area if you want fixed lists.

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
| Logo                     |          | Google Drive link or image URL; downloaded into the site      |

**Places.** City and Country are geocoded together, constrained to the
country, so "Paris, France" never lands in Texas. A fellow in several places
(`Washington, D.C. and Belize City` / `United States/Belize`, separated by
`and`, `&`, `/` or `;`) gets one pin per place. `Remote`, `Virtual`, `Online`
or `Hybrid` is never looked up as a place name: the pin goes to the city
written with it (`Remote (Nashville)`), else to the organization's address if
its website states one in the same country, else to the centre of the
country; the build report lists these so staff can add Latitude/Longitude. A
city that cannot be found is also pinned at the country and reported. Rows
with no usable place at all are skipped and reported.

**Logos.** Every logo is served from `public/logos/`; the site never
hotlinks. A Logo cell may be any image URL or a Google Drive link, including
the links the Google Form writes for file uploads, provided the file (or the
form's upload folder) is shared as *Anyone with the link*. Otherwise the
build fetches the website's icon (apple-touch-icon, web manifest, favicon)
and checks the bytes are a real image. A blank value in Class Year, School, Affiliation or Interest
Area shows on the site as "Not specified". Unrecognized or missing columns
are listed in the build report; trailing empty columns are ignored. Accepted header spellings include the old export's names
(`Fellowship location`, `Name of Partner Organization`, `Link to Logo`, ...);
see `ALIASES` in `scripts/build-data.ts`.

## Local CSVs

Optional. Every `data/csv/*.csv` is read as a source. If it has no Period
column, the file name is the period (`Summer_2024.csv` → `Summer 2024`).
Periods for local files go in `data/periods.json` as a list of objects with
the same fields as the `Periods` tab (`period`, `displayName`, `order`,
`show`); groups go in `data/groups.json` (`group`, `periods`, `displayName`,
`order`, `show`).

## Caches and snapshot (committed by the nightly build)

- `data/geocache.json`: City, Country → coordinates (Nominatim), plus
  `country:` entries (centre and code) and `org:` entries (address found on a
  website). Delete an entry to look it up again; failures retry after 30 days.
- `data/logocache.json` and `public/logos/`: one logo per organization
  domain or Logo link. Delete both the entry and the file to re-fetch.
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
row (with Show = No until the first students are in, if you prefer). Program leaders entering students in bulk paste rows into any tab listed
in `Sources`, with the same headers.
