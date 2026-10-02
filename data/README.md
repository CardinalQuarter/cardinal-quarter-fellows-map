# Data contract

The map is built from one Google Sheet (repo secret `SHEET_ID`) plus any
CSVs in `data/csv/`. Columns are matched by header name, in any order; extra
columns are ignored. Rows are grouped by their **Period** value, not by which
tab they live in, so the sheet can grow year over year and take rows from any
source: the Google Form, staff pasting student rows, an old export.

## Sheet tabs

`sheet-template.xlsx` in this folder is a ready-made copy of the layout below
(instructions tab, dropdowns, example period/group rows, and blank `Students`
and `Legacy Students` tabs). Open it in Excel and copy the needed tabs or ranges into the real sheet.
Keep row 1 as the headers and replace or delete the example period/group rows.
For a new sheet, you can also import it into Google Sheets with
*File → Import → Upload → Replace spreadsheet*.

`Sources` initially lists `Legacy Students` followed by `Students`, both with
Default Period = Summer 2026. Keep the real data in your existing student tabs;
copy the updated `Sources` and `Read Me` tabs over without replacing those
student tabs with the blank template layouts. If using a Google Form, link it to the
real sheet and add its exact response-tab name (usually `Form Responses 1`) to
`Sources`. Remove any entry for a student tab you do not use.
Every listed tab must exist. The blank `Students` tab keeps the column layout
and dropdowns useful for staff entry or historical imports; it has no sample
student or program-leader tab. The blank `Legacy Students` layout has the same
columns and dropdowns. When copying only cell values from Excel,
recreate dropdown validation in Google Sheets as described below.

| tab        | columns                                   | purpose                                              |
| ---------- | ----------------------------------------- | ---------------------------------------------------- |
| `Periods`  | Period, Display Name, Order, Show         | which periods are published, their label and order   |
| `Groups`   | Group, Periods, Display Name, Order, Show | optional: tabs that combine periods ("Last 5 years") |
| `Sources`  | Tab, Default Period (optional)            | which other tabs to read; fallback period for each  |
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

## Official Haas sheet setup

The official sheet's `Legacy Students` tab contains real data. Its headers
are supported, including `Fellowship Interest Area`. The `Students` tab uses
the same supported headers. A `Period` column can appear in any position;
tabs without one use their Default Period from `Sources`.

For an initial Summer 2026 import, set `Sources!A1:B3` to:

| Tab             | Default Period |
| --------------- | -------------- |
| Legacy Students | Summer 2026    |
| Students        | Summer 2026    |

The current legacy setup assigns those rows to Summer 2026. If a record turns
out to belong to another period, set that row's Period and add the period to
`Periods`. Default Period applies when a row has no Period column or its Period
cell is blank. A filled row-level Period always wins. Do not infer fellowship
period from Class Year, which is graduation year.

Keep `Summer 2026` in `Periods`. Remove the unused Summer 2025 and Summer 2024
example rows until you have data for them. Remove example rows in `Groups`
unless those groups are intentional; keep the headers. Setting Show = No
hides a navigation tab but still publishes its data.

Before collecting another year's students, add a `Period` column to `Students`
(any position is fine), fill it for every existing row, and clear that tab's
Default Period in `Sources`. Require Period on new rows/the Google Form.
This prevents changing a default from moving older students into a new year.
Add the form's exact response-tab name to `Sources` if it writes into a
separate tab; place it after the legacy tab so newer submissions win when
email and period match. No student headers need renaming.

Follow [Update the sheet ID](#update-the-sheet-id) below to connect the
deployment to this sheet. Review each manual run's summary for duplicates,
placement issues and logo-download failures.

Review the build summary before publishing. The importer resolves duplicate
email/period rows, keeps same-name students distinct, swaps reversed
coordinate pairs, and tries geocoding missing or invalid coordinates.
Correct unresolved placements in the sheet. Logo links must be shared for
downloads to succeed; otherwise the importer tries the organization's
website icon.

## Update the sheet ID

1. Open the Google Sheet and copy the ID between `/d/` and `/edit` in its URL.
   For the current official Haas sheet, the ID is
   `1ngwejcpBQKfF4c0U4obhw-dCN0J6GmJFw9oSd4Q7dQQ`.
2. In the GitHub repository that deploys the site, open **Settings → Secrets
   and variables → Actions → Repository secrets**. Edit `SHEET_ID`, or choose
   **New repository secret** if it does not exist. Paste only the ID, not the
   full URL, then save. If these controls are unavailable, ask the repository
   owner to update the secret. GitHub does not display an existing secret's value.
3. Share the sheet as **Anyone with the link: Viewer**. Check that every tab
   named in `Sources` exists and every used Period is listed in `Periods`.
4. Push the app changes, then open **Actions → Build and deploy to GitHub
   Pages → Run workflow**, select `master`, and start a new run. Saving a
   secret or editing the sheet does not deploy automatically. Review the run
   summary and check the live map after it succeeds.

Set `SHEET_ID` in the repository that runs the deployment. Changing the
secret requires no app code edit. Use these same steps whenever the sheet
is copied or replaced with a different spreadsheet ID.

## Student columns

| header                   | required | notes                                                         |
| ------------------------ | :------: | ------------------------------------------------------------- |
| Period                   | conditional | required unless `Sources` provides a Default Period; filled values must match `Periods` |
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

## Caches and snapshot (committed by each manual build)

Sheet edits and repository pushes do not update the live map automatically.
Publish from the repo's **Actions** tab → **Build and deploy to GitHub Pages**
→ **Run workflow** → select `master` → **Run workflow**. Review the run summary
for data issues, fix them in the sheet, and start a new run to publish again.

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
row (with Show = No until the first students are in, if you prefer). Staff
entering students in bulk paste rows into `Students` or any tab listed in
`Sources`, with the same headers. Manually run the deployment workflow when
the changes are ready to publish.
