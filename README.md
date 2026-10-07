# Cardinal Quarter Map

Interactive map of Cardinal Quarter fellows by fellowship period:
https://cardinalquarterfellows.cardinalservice.org/

A static site with no server, database, API keys or paid services. Fellow
data lives in a Google Sheet; a manually run GitHub Actions workflow turns it
into JSON and deploys the site to GitHub Pages.

## Publishing changes

1. Edit the Google Sheet. The sheet's layout, columns and Google Form setup
   are described in [`data/README.md`](data/README.md).
2. In this repo, open **Actions → Build and deploy to GitHub Pages → Run
   workflow**. Sheet edits and code pushes never deploy on their own.
3. Open the finished run. Its summary lists anything in the sheet that needs
   fixing, most urgent first; the full list is attached as the `build-report`
   artifact. Fix the sheet and run the workflow again.

Each run commits the published data back to the repo, so every change is a
readable diff. Start a fresh run rather than re-running an old one: a re-run
builds the commit it originally checked out. Student emails are used only to
remove duplicates and are never published.

## Hosting

- **Settings → Pages**: Source is *GitHub Actions*; custom domain
  `cardinalquarterfellows.cardinalservice.org` with *Enforce HTTPS*.
- **DNS** (Bluehost, `cardinalservice.org` zone): a CNAME from
  `cardinalquarterfellows` to `cardinalquarter.github.io`. The rest of the
  zone serves the Haas WordPress site and email; leave it alone.
- **Settings → Secrets and variables → Actions**: secret `SHEET_ID`, the part
  of the sheet's URL between `/d/` and `/edit` (a full URL also works). The
  sheet must be shared as *Anyone with the link: Viewer*. To switch sheets,
  edit the secret and run the workflow.

Asset paths are relative, so the same build works at the custom domain and at
`cardinalquarter.github.io/cardinal-quarter-fellows-map/`.

## Local development

Requires Node 24+.

```sh
npm install
SHEET_ID=<id> npm run dev    # builds data from the Google Sheet, starts Vite
npm run build                # type-check + production build into dist/
npm test                     # importer and build report tests
```

## Layout

| path                            | purpose                                                |
| ------------------------------- | ------------------------------------------------------ |
| `scripts/build-data.ts`         | reads the sheet, geocodes, fetches logos, writes JSON  |
| `scripts/build-report.ts`       | the sheet checklist in each run's summary              |
| `src/App.tsx`                   | period, grouping, filter, and search state             |
| `src/components/`               | Header, Legend, FilterChips, Search, MapView           |
| `src/urlState.ts`               | view state in the URL query string                     |
| `src/styles.css`                | Stanford Identity color and type tokens                |
| `.github/workflows/deploy.yml`  | manually triggered build and deploy                    |
| `data/`                         | sheet contract and geocode/logo caches                 |
| `public/data/`, `public/logos/` | published data and logos, committed by the build       |

Stack: Vite, React 19, TypeScript, Tailwind 4, MapLibre GL with the free
[OpenFreeMap](https://openfreemap.org) basemap. Geocoding uses OpenStreetMap's
Nominatim. Styling follows the
[Stanford Identity Guide](https://identity.stanford.edu/).
