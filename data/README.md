# Sheet contract

The map is built from one Google Sheet (repo secret `SHEET_ID`). Columns are
matched by header name, in any order; extra columns are ignored. Rows are
grouped by their **Period** value, not by which tab they live in, so the sheet
can grow year over year and take rows from any source: the Google Form, staff
pasting rows, an old export. Do not rename the `Periods`, `Groups` or
`Sources` tabs.

## Tabs

| tab        | columns                                   | purpose                                              |
| ---------- | ----------------------------------------- | ---------------------------------------------------- |
| `Periods`  | Period, Display Name, Order, Show         | which periods are published, their label and order   |
| `Groups`   | Group, Periods, Display Name, Order, Show | optional: tabs that combine periods ("Last 5 years") |
| `Sources`  | Tab, Default Period (optional)            | which student tabs to read, in order                 |
| any listed | student columns below                     | fellows; one row each                                |

**Periods.** Period must match what student rows put in their Period column
(case, spaces and punctuation are ignored). Display Name defaults to Period.
Order is a number, lowest first; blank keeps the row order. Show is blank or
Yes to put the period in the nav, No to publish it without a nav tab (it stays
in groups and "All periods", and its link still works), which is how to load a
new period before announcing it or retire old years. Rows whose Period is not
listed are not published, and the build report names them. A period may not
be named `all`.

**Groups.** Periods is a comma-separated list of Period values, or `all`, or
`latest N` (the first N periods by Order, so "Last 5 years" never needs
editing). Periods and groups share one Order scale; groups without an Order
come after all periods. The site adds an "All periods" tab at the end unless
a group already covers every period. Group names may not repeat a period name.

**Sources.** Every listed tab must exist. Default Period fills in the period
for rows with no Period column or a blank Period cell; a filled Period always
wins. When the same email appears twice in one period, the later tab (and the
later row) wins. Before reusing a tab for a new year, fill its Period column
for every existing row and clear its Default Period, so changing the default
does not move older students.

To keep values consistent, add *Data → Data validation → Dropdown from a
range* to the Period column of each student tab (pointing at `Periods`), and
optionally to Country, School and Interest Area.

## Student columns

| header                   | required    | notes                                                         |
| ------------------------ | :---------: | ------------------------------------------------------------- |
| Period                   | conditional | unless `Sources` gives a Default Period; must match `Periods` |
| Name                     | yes         |                                                               |
| Stanford Email           |             | duplicate check with Period; never published                  |
| Class Year               |             | graduation year, not the fellowship period                    |
| Major                    |             |                                                               |
| School                   |             |                                                               |
| Affiliation              |             | sponsoring office or program                                  |
| Fellowship / Opportunity |             |                                                               |
| Interest Area            |             |                                                               |
| Organization             | yes         |                                                               |
| City                     | yes\*       | geocoded with Country when Latitude/Longitude is blank        |
| Country                  | yes         |                                                               |
| Website                  |             | organization site; its icon is the logo when Logo is blank    |
| Latitude, Longitude      |             | override geocoding                                            |
| Logo                     |             | image URL or Google Drive link; downloaded into the site      |

The build stops if a student tab has no Name, Organization or Country column,
or no City column (\*unless it has Latitude and Longitude columns); the error
lists the headers it found. Other unrecognized columns are listed in the build
report. Common variants are accepted without renaming, including the old
export's headers (`Name of Partner Organization`, `Link to Logo`,
`Fellowship Interest Area`, ...) and Google Form headers (`Email Address`);
see `ALIASES` in `scripts/build-data.ts`. Blank or "Not specified" values are
left off a fellow's card.

**Places.** City and Country are geocoded together, constrained to the
country, so "Paris, France" never lands in Texas. A fellow in several places
(`Washington, D.C. and Belize City` / `United States/Belize`, separated by
`and`, `&`, `/` or `;`) gets one pin per place. `Remote`, `Virtual`, `Online`
or `Hybrid` is never looked up as a place: the pin goes to the city written
with it (`Remote (Nashville)`), else to the organization's address if its
website states one in the same country, else to the centre of the country. A
city that cannot be found is also pinned at the country. Rows with no usable
place are skipped. All of these appear in the build report.

**Logos.** Every logo is served from `public/logos/`; the site never
hotlinks. A Logo cell may be an image URL or a Google Drive link, including
the links the Google Form writes for uploads, if the file (or the form's
upload folder) is shared as *Anyone with the link*. Otherwise the build uses
the website's icon.

## Build report

Each run's summary ends with **Things to address in the sheet**:

1. **Fix**: rows missing from the map (unknown period, no usable place,
   header problems).
2. **Review**: rows on the map that may be wrong (duplicates, swapped or
   invalid coordinates, country-centre and remote placements).
3. **Optional cleanup** (collapsed): broken logo links, missing icons, and
   coordinates the build looked up, which can be copied into the sheet.

Three or more rows in one tab with the same problem are merged into one line
with line ranges. Items stay in the report until corrected in the sheet.

## Google Form

One form, one response tab, listed in `Sources` after the older student tabs.
Settings: *Collect email addresses: Verified*, restricted to Stanford
accounts. Question titles become the column headers, so keep them as below;
renaming the Organization, City or Country question stops the build.

| question                 | type                                            |
| ------------------------ | ----------------------------------------------- |
| Period                   | dropdown, required, one option: current period  |
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

Share the form's upload folder as *Anyone with the link* so logos download.

**Each new period:** add a `Periods` row (Order 1, Show = No until the first
students are in, if you like), add the new class year and change the Period
option in the form, then run the workflow and check the new tab.

## Caches (committed by each build)

- `geocache.json`: City, Country → coordinates, plus `country:` and `org:`
  entries. Failed lookups retry after 30 days. Delete an entry to look it up
  again.
- `logocache.json` and `public/logos/`: one logo per organization domain or
  Logo link. Delete both the entry and the file to re-fetch.

Only new or changed places and logos hit the network, so later builds are much
faster than the first import. Keep these files
when moving the site to another repository.

## Without a sheet

For local testing, `data/csv/*.csv` files are read as sources (the file name
is the period when there is no Period column), with periods in
`data/periods.json` and groups in `data/groups.json`, using the same fields
as the tabs in camelCase (`period`, `displayName`, `order`, `show`).
