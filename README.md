# Cardinal Quarter Map

Interactive map of Cardinal Quarter fellows by fellowship period.
Live site: https://cardinalquarterfellows.cardinalservice.org/

Static site, no server or database. Data comes from a Google Sheet (plus
optional CSVs for historical periods), GitHub Actions builds it nightly or on
demand, and GitHub Pages hosts it. No API keys, no paid services, no login.
The previous PHP/MySQL site is kept in [`legacy/`](legacy/) for reference.

## How data reaches the map

1. Rows land in the Google Sheet: from the Google Form, from program leaders
   pasting their students in, or from old exports. Any tab listed in the
   sheet's `Sources` tab is read; rows are grouped by their Period column.
   Contract and form spec: [`data/README.md`](data/README.md).
2. The build fills in what is missing: coordinates are geocoded from City and
   Country, logos are fetched from the organization website. Results are
   cached and committed so they stay stable.
3. The site rebuilds every night at 6am Pacific and commits the published
   data back to the repo, so every change is a readable diff. To publish
   sooner: repo **Actions** tab → *Build and deploy to GitHub Pages* →
   **Run workflow** (or `gh workflow run deploy.yml`). The run's summary
   lists anything that needs attention (unknown periods, duplicates,
   addresses or logos not found). Start a fresh run rather than re-running
   an old one: a re-run builds the commit it originally checked out.
   GitHub pauses scheduled workflows after 60 days without repo activity
   and emails the owner first; the nightly snapshot commits count as
   activity, so this only matters if the sheet goes untouched that long.

Student emails are used to deduplicate and are never published.

## Deployment checklist

- [ ] Create the Google Sheet, share as *Anyone with the link: Viewer*, copy
      its ID from the URL.
- [ ] Repo **Settings → Secrets and variables → Actions → Secrets**: add
      `SHEET_ID` (a secret, so the sheet link is masked in the public build
      logs).
- [ ] **Settings → Pages**: set Source to *GitHub Actions*.
- [ ] Export old periods from Bluehost (`public_html/upload/*.csv`) and paste
      them into a sheet tab listed in `Sources` (or drop them in `data/csv/`).
- [ ] Point the `cardinalquarterfellows.cardinalservice.org` CNAME at GitHub
      Pages, add it under **Settings → Pages → Custom domain**, and add a repo
      variable `BASE_PATH` with value `/`.
- [ ] After cutover: revoke the old Google Maps API key, rotate the Bluehost
      database password, and take the Bluehost site down.

## Local development

Requires Node 24+.

```sh
npm install
SHEET_ID=<id> npm run dev    # builds data from the Google Sheet, starts Vite
npm run build                # type-check + production build into dist/
```

## Layout

| path                       | purpose                                                |
| -------------------------- | ------------------------------------------------------ |
| `scripts/build-data.ts`    | reads sheet/CSVs, geocodes, fetches logos, writes JSON |
| `src/App.tsx`              | period, grouping, filter, and search state             |
| `src/components/`          | Header, Legend, OrgList, FilterChips, Search, MapView    |
| `src/urlState.ts`          | view state in the URL query string                     |
| `src/styles.css`           | Stanford Identity color and type tokens                |
| `.github/workflows/`       | nightly and on-demand build and deploy                 |
| `data/`                    | sheet contract and geocode/logo caches                 |
| `public/data/`, `public/logos/` | published data and logos, committed by the build  |
| `legacy/`                  | old PHP site                                           |

Stack: Vite, React 19, TypeScript, Tailwind 4, MapLibre GL with the free
[OpenFreeMap](https://openfreemap.org) basemap. Styling follows the
[Stanford Identity Guide](https://identity.stanford.edu/).
