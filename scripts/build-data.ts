/**
 * Build-time data pipeline. Runs on Node 24+ (no transpile step).
 *
 *   SHEET_ID=<id> node scripts/build-data.ts
 *
 * Inputs (see data/README.md for the contract):
 *   - Google Sheet (when SHEET_ID is set): a "Periods" tab, an optional "Groups"
 *     tab (named sets of periods shown as one tab), a "Sources" tab,
 *     and the student tabs the Sources tab lists.
 *   - Local CSVs: every data/csv/*.csv, with periods from data/periods.json.
 *
 * Student columns are matched by header name, in any order. Rows are grouped
 * by their Period column (CSV file name when the column is absent), kept
 * only when that period is listed, and deduplicated on email + period.
 *
 * Locations: a row naming several places ("Washington, D.C. and Belize City",
 * "United States/Belize") becomes one pin per place. "Remote"/"Virtual"/
 * "Hybrid" is never geocoded as a place name: the pin goes to the
 * organization's address when its website states one, else to the country.
 * City + Country are geocoded with Nominatim, constrained to the country, and
 * cached in data/geocache.json.
 *
 * Logos: a Logo cell (Google Drive link or any image URL) is downloaded into
 * public/logos/ so the site never hotlinks. Blank logos are fetched from the
 * organization's website (apple-touch-icon, web manifest, <link rel=icon>,
 * well-known paths), checked to be real image bytes, and tracked in
 * data/logocache.json.
 *
 * Output: public/data/<period>.json + index.json (periods and the nav of
 * periods/groups, with hidden ones flagged), pretty-printed so commits
 * from the manual deployment workflow show readable diffs. Emails never reach output.
 */
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import Papa from "papaparse";
import { sheetReviewSection } from "./build-report.ts";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "public", "data");
const LOGO_DIR = path.join(ROOT, "public", "logos");
const CSV_DIR = path.join(ROOT, "data", "csv");
const LOCAL_PERIODS = path.join(ROOT, "data", "periods.json");
const LOCAL_GROUPS = path.join(ROOT, "data", "groups.json");
const GEOCACHE = path.join(ROOT, "data", "geocache.json");
const LOGOCACHE = path.join(ROOT, "data", "logocache.json");

// Accept the bare ID or the whole sheet URL pasted into the secret.
const SHEET_ID = process.env.SHEET_ID?.trim().replace(/^.*\/spreadsheets\/d\/([^/?#]+).*$/, "$1");
const PERIODS_TAB = process.env.PERIODS_TAB?.trim() || "Periods";
const SOURCES_TAB = process.env.SOURCES_TAB?.trim() || "Sources";
const GROUPS_TAB = process.env.GROUPS_TAB?.trim() || "Groups";
// Nominatim's usage policy asks for a way to reach the operator: the repo running the build.
const USER_AGENT = `cardinal-quarter-map build (https://github.com/${process.env.GITHUB_REPOSITORY || "CardinalQuarter/cardinal-quarter-map"})`;
/** Some sites refuse anything that does not look like a browser; used only as a second try. */
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const RETRY_FAILURES_AFTER_DAYS = 30;
const FETCH_TIMEOUT_MS = 15_000;
const MAX_LOGO_BYTES = 2_000_000;
const NOMINATIM_GAP_MS = 1100; // usage policy: at most one request per second
const LOGO_CONCURRENCY = 8; // each request goes to a different organization's site
const CACHE_SAVE_MS = 30_000; // a run that dies keeps everything up to the last save

// ---------------------------------------------------------------------------
// Columns
// ---------------------------------------------------------------------------

type Field =
  | "period"
  | "name"
  | "email"
  | "class_year"
  | "major"
  | "school"
  | "affiliation"
  | "fellowship"
  | "interest_area"
  | "partner_organization"
  | "fellowship_loc"
  | "country"
  | "partner_website"
  | "latitude"
  | "longitude"
  | "partner_logo";

/**
 * Accepted header names per field, after normalizeHeader(). The first alias is
 * the canonical name used in docs; the rest cover the old 15-column export and
 * likely Google Form question titles.
 */
const ALIASES: Record<Field, string[]> = {
  period: ["period", "fellowshipperiod", "term", "cohort"],
  name: ["name", "fullname", "studentname"],
  email: ["stanfordemail", "email", "emailaddress", "stanfordemailaddress"],
  class_year: ["classyear", "year", "graduationyear", "expectedgraduationyear"],
  major: ["major", "majors"],
  school: ["school"],
  affiliation: ["affiliation", "sponsoringoffice", "office"],
  fellowship: ["fellowshipopportunity", "fellowship", "opportunity", "program", "fellowshipname"],
  interest_area: ["interestarea", "interestareas", "fellowshipinterestarea"],
  partner_organization: ["organization", "nameofpartnerorganization", "partnerorganization", "organizationname", "partner"],
  fellowship_loc: ["city", "fellowshiplocation", "locationoffellowshipcitytown", "locationoffellowshipcity", "location", "cityregion", "citytown"],
  country: ["country", "locationoffellowshipcountry"],
  partner_website: ["website", "communitypartnerwebsite", "partnerwebsite", "partnerorganizationwebsite", "organizationwebsite", "organizationswebsite", "url"],
  latitude: ["latitude", "lat"],
  longitude: ["longitude", "lng", "long", "lon"],
  partner_logo: ["logo", "linktologo", "logourl", "logoupload", "logoimage", "organizationslogo", "organizationlogo"],
};

/** Lowercase, drop "(optional)"/"(required)" notes, keep letters and digits. */
function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/\((optional|required)\)/g, "").replace(/[^a-z0-9]/g, "");
}

function mapHeader(header: string[], label: string): Partial<Record<Field, number>> {
  const map: Partial<Record<Field, number>> = {};
  const unknown: string[] = [];
  header.forEach((h, i) => {
    const n = normalizeHeader(h);
    if (!n) return; // blank header: trailing empty sheet columns
    const field = (Object.keys(ALIASES) as Field[]).find((f) => ALIASES[f].includes(n));
    if (field === undefined) unknown.push(h.trim());
    else if (map[field] === undefined) map[field] = i;
    else unknown.push(`${h.trim()} (duplicate of ${ALIASES[field][0]})`);
  });
  if (unknown.length) report.columns.push(`${label}: ignored column(s) ${unknown.map((u) => `"${u}"`).join(", ")}`);
  const missing = (Object.keys(ALIASES) as Field[]).filter((f) => map[f] === undefined && !OPTIONAL.includes(f));
  if (missing.length) report.columns.push(`${label}: no column for ${missing.join(", ")}`);
  return map;
}

/** Columns a source may leave out without a note in the report. */
const OPTIONAL: Field[] = ["period", "latitude", "longitude", "partner_logo"];

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Fellow = {
  id: string;
  name: string;
  class_year: string;
  major: string;
  school: string;
  fellowship: string;
  partner_organization: string;
  country: string;
  fellowship_loc: string;
  latitude: number;
  longitude: number;
  affiliation: string;
  partner_website: string;
  partner_logo: string;
  interest_area: string;
};

/** A row after header matching, before geocoding/logos. */
type Row = Record<Field, string> & { where: string };

/**
 * One pin. A row with several places becomes several placements that share
 * `person`, so a fellow is counted once however many pins they have.
 */
type Placement = Row & {
  person: string;
  placeIndex: number;
  /** Place name to geocode (blank for remote rows with no place given). */
  city: string;
  remote: boolean;
};

type Period = { period: string; displayName: string; order: number; show: boolean };
/** A named set of periods shown as one tab ("Last 5 years"); `periods` holds the Period values as written. */
type Group = { group: string; displayName: string; periods: string[]; order: number; show: boolean };
type PeriodMeta = { slug: string; displayName: string; count: number };
/** One entry in the site's period nav: a period, a group, or the built-in "All periods". */
type ViewMeta = { slug: string; displayName: string; periods: string[]; show: boolean };
type Index = { periods: PeriodMeta[]; views: ViewMeta[] };

type GeoHit = { lat: number; lng: number; label?: string; code?: string; kind?: string; importance?: number };
type GeoEntry = GeoHit | { error: string; at: string };
type LogoEntry = { file: string; source: string; at: string } | { error: string; at: string };

/** Everything worth telling a human about, printed and written to the job summary. */
const report = {
  cacheHits: 0,
  cacheMisses: 0,
  periods: [] as { period: string; displayName: string; count: number; show: boolean }[],
  groups: [] as { displayName: string; periods: string[]; count: number; show: boolean }[],
  groupNotes: [] as string[],
  columns: [] as string[],
  orphans: new Map<string, number>(),
  duplicates: [] as string[],
  skipped: [] as string[],
  swapped: [] as string[],
  badCoords: [] as string[],
  multi: [] as string[],
  geocoded: [] as string[],
  suggestedCoords: [] as string[],
  remotePlaced: [] as string[],
  countryFallback: [] as string[],
  geocodeFailed: [] as string[],
  logosFetched: [] as string[],
  logoLinkFailed: [] as string[],
  logoFailed: [] as string[],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sheetCsvUrl(tab: string): string {
  return (
    `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq` +
    `?tqx=out:csv&sheet=${encodeURIComponent(tab)}`
  );
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, ua = USER_AGENT): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: { "user-agent": ua, ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    redirect: "follow",
  });
}

/** Fetch with the honest User-Agent, then as a browser when the site refuses bots. */
async function fetchPolitely(url: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetchWithTimeout(url, init);
  if ([401, 403, 406, 429, 503].includes(res.status)) return fetchWithTimeout(url, init, BROWSER_UA);
  return res;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetchWithTimeout(url);
  if (res.status === 404 && url.includes("/spreadsheets/d/")) {
    throw new Error(`Google Sheets returned 404: no sheet has the ID in SHEET_ID. Copy the part of the sheet's URL between /d/ and /edit into the secret. (${url})`);
  }
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} fetching ${url}`);
  return res.text();
}

function parseCsv(text: string): string[][] {
  const { data, errors } = Papa.parse<string[]>(text.replace(/^﻿/, ""), {
    delimiter: ",",
    skipEmptyLines: "greedy",
  });
  const fatal = errors.filter((e) => e.type !== "FieldMismatch");
  if (fatal.length) throw new Error(fatal.map((e) => e.message).join("; "));
  return data;
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as T;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return fallback;
    throw err;
  }
}

async function writeJson(file: string, value: unknown): Promise<void> {
  await writeAtomic(file, JSON.stringify(value, null, 2) + "\n");
}

/** Write via a temp file and rename, so a killed run never leaves half a file. */
async function writeAtomic(file: string, data: string | Uint8Array): Promise<void> {
  const tmp = `${file}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  await writeFile(tmp, data);
  await rename(tmp, file);
}

/** Run fn over items, at most `limit` at a time; results keep input order. */
async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

function isStale(at: string): boolean {
  const age = Date.now() - new Date(at).getTime();
  return !Number.isFinite(age) || age > RETRY_FAILURES_AFTER_DAYS * 86_400_000;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const now = () => new Date().toISOString();

/** Return the cached entry, or compute and cache it; failures are retried once stale. */
async function cached<T extends { error?: string; at?: string } | object>(
  cache: Record<string, T>,
  key: string,
  compute: () => Promise<T>,
): Promise<T> {
  const hit = cache[key];
  if (hit && !("error" in hit && isStale((hit as { at: string }).at))) {
    report.cacheHits++;
    return hit;
  }
  report.cacheMisses++;
  const entry = await compute();
  cache[key] = entry;
  return entry;
}

function normalizeWebsite(url: string): string {
  const u = url.trim();
  if (!u) return "";
  return /^https?:\/\//i.test(u) ? u : `https://${u}`;
}

function domainOf(website: string): string {
  try {
    return new URL(website).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

const decodeEntities = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/&#39;|&rsquo;/g, "'").replace(/&quot;/g, '"');

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

/** A Show cell: blank means shown; no / hide / false / 0 means hidden. */
function parseShow(v: string | undefined): boolean {
  const s = (v ?? "").trim().toLowerCase();
  return !["no", "n", "false", "0", "hide", "hidden", "off"].includes(s);
}

/** Column lookup that accepts a few spellings per column. */
function columns(header: string[], wanted: Record<string, string[]>): Record<string, number> {
  const cols = header.map(normalizeHeader);
  const out: Record<string, number> = {};
  for (const [name, spellings] of Object.entries(wanted)) out[name] = cols.findIndex((c) => spellings.includes(c));
  return out;
}

const cell = (r: string[], i: number) => (i >= 0 ? (r[i] ?? "").trim() : "");

function parsePeriods(rows: string[][], label: string): Period[] {
  const [header = [], ...body] = rows;
  const c = columns(header, {
    period: ["period"],
    name: ["displayname", "label", "name"],
    order: ["order", "sort"],
    show: ["show", "visible", "shown", "display"],
  });
  if (c.period < 0) throw new Error(`${label}: needs a "Period" column`);
  return body
    .map((r, i) => ({
      period: cell(r, c.period),
      displayName: cell(r, c.name) || cell(r, c.period),
      order: Number(cell(r, c.order)) || i + 1,
      show: parseShow(cell(r, c.show)),
    }))
    .filter((p) => p.period);
}

/** Group rows list periods separated by commas, semicolons or line breaks; `all` and `latest N` are keywords. */
function parseGroups(rows: string[][], label: string): Group[] {
  const [header = [], ...body] = rows;
  const c = columns(header, {
    group: ["group", "name", "groupname"],
    periods: ["periods", "includes", "members"],
    name: ["displayname", "label"],
    order: ["order", "sort"],
    show: ["show", "visible", "shown", "display"],
  });
  if (c.group < 0 || c.periods < 0) throw new Error(`${label}: needs "Group" and "Periods" columns`);
  return body
    .map((r, i) => ({
      group: cell(r, c.group),
      displayName: cell(r, c.name) || cell(r, c.group),
      periods: cell(r, c.periods).split(/[,;\n]+/).map((p) => p.trim()).filter(Boolean),
      // Groups without an Order come after periods without one.
      order: Number(cell(r, c.order)) || 1000 + i + 1,
      show: parseShow(cell(r, c.show)),
    }))
    .filter((g) => g.group);
}

async function loadPeriods(): Promise<Period[]> {
  const periods: Period[] = [];
  if (SHEET_ID) periods.push(...parsePeriods(parseCsv(await fetchText(sheetCsvUrl(PERIODS_TAB))), PERIODS_TAB));
  const local = await readJson<Partial<Period>[]>(LOCAL_PERIODS, []);
  local.forEach((p, i) => {
    if (!p.period) return;
    periods.push({ period: p.period, displayName: p.displayName ?? p.period, order: p.order ?? i + 1, show: p.show ?? true });
  });
  const seen = new Set<string>();
  return periods.filter((p) => {
    const slug = slugify(p.period);
    if (slug === "all") throw new Error(`Period "${p.period}" clashes with the "All periods" view; rename it`);
    if (seen.has(slug)) return false; // sheet wins over periods.json
    seen.add(slug);
    return true;
  });
}

/** The Groups tab is optional: a sheet without one builds as before. */
async function fetchOptionalTab(tab: string): Promise<string[][] | null> {
  try {
    const text = await fetchText(sheetCsvUrl(tab));
    // A missing tab comes back as a gviz error page rather than CSV.
    if (/^\s*</.test(text) || text.includes("/*O_o*/")) return null;
    return parseCsv(text);
  } catch (err) {
    if (/^4\d\d /.test((err as Error).message)) return null;
    throw err;
  }
}

async function loadGroups(): Promise<Group[]> {
  const groups: Group[] = [];
  if (SHEET_ID) {
    const rows = await fetchOptionalTab(GROUPS_TAB);
    // An unknown tab name makes the gviz endpoint return the first tab, so a
    // tab without Group and Periods headers means "no Groups tab".
    const c = rows && columns(rows[0] ?? [], { group: ["group", "name", "groupname"], periods: ["periods", "includes", "members"] });
    if (rows && c && c.group >= 0 && c.periods >= 0) groups.push(...parseGroups(rows, GROUPS_TAB));
    else console.log(`No "${GROUPS_TAB}" tab (or no Group/Periods headers); building without groups`);
  }
  const local = await readJson<Partial<Group>[]>(LOCAL_GROUPS, []);
  local.forEach((g, i) => {
    if (!g.group) return;
    groups.push({
      group: g.group,
      displayName: g.displayName ?? g.group,
      periods: g.periods ?? [],
      order: g.order ?? 1000 + i + 1,
      show: g.show ?? true,
    });
  });
  const seen = new Set<string>();
  return groups.filter((g) => {
    const slug = slugify(g.group);
    if (!slug) return false;
    if (seen.has(slug)) return false;
    seen.add(slug);
    return true;
  });
}

/**
 * Turn periods and groups into the nav the site shows: one list sorted by Order
 * (periods before groups on ties), each entry naming the period files it loads.
 * "All periods" is added unless a group already covers every period.
 */
function resolveViews(periods: Period[], groups: Group[]): ViewMeta[] {
  const ordered = [...periods].sort((a, b) => a.order - b.order);
  const bySlug = new Map(ordered.map((p) => [slugify(p.period), p]));
  const all = ordered.map((p) => slugify(p.period));
  type Item = ViewMeta & { order: number; rank: number };
  const items: Item[] = ordered.map((p, i) => ({
    slug: slugify(p.period), displayName: p.displayName, periods: [slugify(p.period)], show: p.show, order: p.order, rank: i,
  }));
  let coversAll = false;
  groups.forEach((g, i) => {
    const slug = slugify(g.group);
    if (bySlug.has(slug)) {
      report.groupNotes.push(`Group "${g.group}" has the same name as a period; rename the group (not published)`);
      return;
    }
    const members: string[] = [];
    for (const name of g.periods) {
      const m = /^(all|\*|everything)$/i.exec(name) ? { n: all.length } : /^(?:latest|last|newest|recent|most recent)\s+(\d+)$/i.exec(name);
      if (m) {
        const n = "n" in m ? m.n : Number(m[1]);
        members.push(...all.slice(0, n));
        continue;
      }
      const s = slugify(name);
      if (!bySlug.has(s)) {
        report.groupNotes.push(`Group "${g.group}": period "${name}" is not in the Periods list; ignored`);
        continue;
      }
      members.push(s);
    }
    const unique = all.filter((s) => members.includes(s)); // period order, no repeats
    if (unique.length === 0) {
      report.groupNotes.push(`Group "${g.group}" has no valid periods (not published)`);
      return;
    }
    if (unique.length === all.length) coversAll = true;
    items.push({ slug, displayName: g.displayName, periods: unique, show: g.show, order: g.order, rank: periods.length + i });
  });
  if (all.length > 1 && !coversAll) {
    items.push({ slug: "all", displayName: "All periods", periods: all, show: true, order: Infinity, rank: items.length });
  }
  items.sort((a, b) => a.order - b.order || a.rank - b.rank);
  return items.map(({ order: _o, rank: _r, ...v }) => v);
}

type Source = { label: string; load: () => Promise<string[][]>; defaultPeriod?: string };

/** A source-wide period is useful for historical tabs without a Period column. */
export function parseSources(rows: string[][]): { tab: string; defaultPeriod?: string }[] {
  const [header = [], ...body] = rows;
  const c = columns(header, {
    tab: ["tab", "tabname"],
    period: ["period", "defaultperiod"],
  });
  if (c.tab < 0) throw new Error(`${SOURCES_TAB}: needs a "Tab" column`);
  return body.map((r) => ({
    tab: cell(r, c.tab),
    defaultPeriod: cell(r, c.period) || undefined,
  })).filter((s) => s.tab);
}

async function loadSources(): Promise<Source[]> {
  const sources: Source[] = [];
  if (SHEET_ID) {
    const rows = parseCsv(await fetchText(sheetCsvUrl(SOURCES_TAB)));
    for (const { tab, defaultPeriod } of parseSources(rows)) {
      sources.push({ label: `sheet tab "${tab}"`, defaultPeriod, load: () => fetchText(sheetCsvUrl(tab)).then(parseCsv) });
    }
  }
  let files: string[] = [];
  try {
    files = (await readdir(CSV_DIR)).filter((f) => f.toLowerCase().endsWith(".csv")).sort();
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
  for (const f of files) {
    sources.push({
      label: `data/csv/${f}`,
      load: () => readFile(path.join(CSV_DIR, f), "utf8").then(parseCsv),
      defaultPeriod: f.replace(/\.csv$/i, "").replace(/_/g, " "),
    });
  }
  return sources;
}

export function rowsFromSource(rows: string[][], src: Source): Row[] {
  const [header, ...body] = rows;
  if (!header) return [];
  const cols = mapHeader(header, src.label);
  // Without these a renamed form question would silently drop every row's
  // organization or pin it at the country centre, so stop instead.
  const required: Field[] = ["name", "partner_organization", "country"];
  if (cols.latitude === undefined || cols.longitude === undefined) required.push("fellowship_loc");
  const missing = required.filter((f) => cols[f] === undefined);
  if (missing.length) {
    const names = missing.map((f) => `"${ALIASES[f][0]}"`).join(", ");
    throw new Error(`${src.label}: no ${names} column. Rename the header (or form question) to match, or add the wording to ALIASES in scripts/build-data.ts. Headers found: ${header.filter((h) => h.trim()).join(", ")}`);
  }
  if (cols.period === undefined && !src.defaultPeriod) {
    throw new Error(`${src.label}: no "Period" column. Add one to the student tab or set a Default Period for this tab in Sources.`);
  }
  const out: Row[] = [];
  body.forEach((raw, i) => {
    const get = (f: Field) => (cols[f] === undefined ? "" : (raw[cols[f]!] ?? "").replace(/\s+/g, " ").trim());
    const name = get("name");
    if (!name) return; // blank row
    const where = `${src.label} line ${i + 2} (${name})`;
    const row = Object.fromEntries((Object.keys(ALIASES) as Field[]).map((f) => [f, get(f)])) as Row;
    row.where = where;
    row.period ||= src.defaultPeriod ?? "";
    row.email = row.email.toLowerCase();
    row.partner_website = normalizeWebsite(row.partner_website);
    out.push(row);
  });
  return out;
}

// ---------------------------------------------------------------------------
// Places: remote detection, several places per row, country names
// ---------------------------------------------------------------------------

/** Words meaning "no fixed place". Matched as whole words anywhere in the City cell. */
const REMOTE_WORDS = /\b(remote(ly)?|virtual(ly)?|online|hybrid|work(ing)? from home|from home|wfh|telecommut\w*)\b/gi;
/** Cells meaning "nothing entered". */
const BLANK_VALUES = /^(n\/?a|none|null|tbd|tba|unknown|not applicable|-+|\?+)$/i;
/** Separators between several places in one cell. Commas are not separators ("Stanford, CA"). */
const PLACE_SEPARATOR = /\s*(?:\/|;|\||\s\+\s|,?\s+(?:and|&)\s+)\s*/i;

const COUNTRY_ALIASES: Record<string, string> = {
  us: "United States",
  usa: "United States",
  "u.s.": "United States",
  "u.s.a.": "United States",
  "united states of america": "United States",
  america: "United States",
  uk: "United Kingdom",
  "u.k.": "United Kingdom",
  "great britain": "United Kingdom",
  britain: "United Kingdom",
  "south korea": "South Korea",
  "republic of korea": "South Korea",
  korea: "South Korea",
  uae: "United Arab Emirates",
  "czech republic": "Czechia",
};

function normalizeCountry(c: string): string {
  const t = c.replace(/\s+/g, " ").trim();
  if (!t || BLANK_VALUES.test(t)) return "";
  return COUNTRY_ALIASES[t.toLowerCase()] ?? t;
}

function splitPlaces(cell: string): string[] {
  return cell
    .split(PLACE_SEPARATOR)
    .map((s) => s.trim())
    .filter((s) => s && !BLANK_VALUES.test(s));
}

/** These country names contain a conjunction, not multiple placements. */
export function splitCountries(value: string): string[] {
  const compounds = ["Bosnia and Herzegovina", "Trinidad and Tobago", "Antigua and Barbuda", "Saint Kitts and Nevis", "Saint Vincent and the Grenadines", "Sao Tome and Principe", "São Tomé and Príncipe", "Turks and Caicos Islands"];
  let protectedValue = value;
  compounds.forEach((name, i) => { protectedValue = protectedValue.replace(new RegExp(name, "gi"), `COUNTRYTOKEN${i}END`); });
  return splitPlaces(protectedValue).map((part) => normalizeCountry(part.replace(/COUNTRYTOKEN(\d+)END/g, (_, i) => compounds[Number(i)])));
}

/** "Remote (based in Nashville)" → { remote: true, city: "Nashville" }; "Remote" → { remote: true, city: "" }. */
function parsePlace(raw: string): { remote: boolean; city: string } {
  let s = raw.trim();
  if (!s || BLANK_VALUES.test(s)) return { remote: false, city: "" };
  const remote = REMOTE_WORDS.test(s);
  REMOTE_WORDS.lastIndex = 0;
  if (!remote) return { remote: false, city: s };
  s = s
    .replace(REMOTE_WORDS, " ")
    .replace(/[()[\]]/g, " ")
    .replace(/\b(based|located|headquartered)\s+(in|out of|at)\b/gi, " ")
    .replace(/\b(from|in|at|for|with|position|role|work|internship)\b/gi, " ")
    .replace(/[\s\-–—:,/]+/g, " ")
    .trim();
  if (BLANK_VALUES.test(s) || s.length < 2) s = "";
  return { remote: true, city: s };
}

/**
 * Expand each row into one placement per place. Cities and countries are
 * paired by position; a single country applies to every city and a single
 * city to every country.
 */
function placements(rows: Row[]): Placement[] {
  const out: Placement[] = [];
  rows.forEach((r, i) => {
    const person = `${slugify(r.period)}|${i}`;
    const cities = splitPlaces(r.fellowship_loc);
    const countries = splitCountries(r.country);
    const n = Math.max(cities.length, countries.length, 1);
    const pairs: { city: string; country: string }[] = [];
    for (let k = 0; k < n; k++) {
      const city = cities.length === 1 ? cities[0] : (cities[k] ?? "");
      const country = countries.length === 1 ? countries[0] : (countries[k] ?? countries[countries.length - 1] ?? "");
      pairs.push({ city, country });
    }
    if (n > 1) {
      report.multi.push(`${r.where}: ${n} places (${pairs.map((p) => [p.city, p.country].filter(Boolean).join(", ")).join("; ")})`);
    }
    pairs.forEach((p, k) => {
      const parsed = parsePlace(p.city);
      out.push({
        ...r,
        person,
        placeIndex: k,
        city: parsed.city,
        remote: parsed.remote,
        fellowship_loc: p.city,
        country: p.country,
        // A Latitude/Longitude override describes one place: the first.
        latitude: k === 0 ? r.latitude : "",
        longitude: k === 0 ? r.longitude : "",
      });
    });
  });
  return out;
}

// ---------------------------------------------------------------------------
// Geocoding
// ---------------------------------------------------------------------------

function hasCoords(r: Row): boolean {
  return r.latitude !== "" && r.longitude !== "" && Number.isFinite(Number(r.latitude)) && Number.isFinite(Number(r.longitude));
}

const inRange = (lat: number, lng: number) => Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

/** Fix swapped Latitude/Longitude cells; blank out pairs that are not on Earth. */
function checkCoords(r: Row): void {
  if (!hasCoords(r)) {
    if (r.latitude || r.longitude) report.badCoords.push(`${r.where}: Latitude "${r.latitude}", Longitude "${r.longitude}" is not a number pair, ignored`);
    r.latitude = "";
    r.longitude = "";
    return;
  }
  const lat = Number(r.latitude);
  const lng = Number(r.longitude);
  if (lat === 0 && lng === 0) {
    report.badCoords.push(`${r.where}: Latitude/Longitude 0, 0 (in the Atlantic), ignored`);
    r.latitude = "";
    r.longitude = "";
    return;
  }
  if (inRange(lat, lng)) return;
  if (inRange(lng, lat)) {
    r.latitude = String(lng);
    r.longitude = String(lat);
    report.swapped.push(`${r.where}: Latitude/Longitude were reversed (${lat}, ${lng}), swapped`);
    return;
  }
  report.badCoords.push(`${r.where}: Latitude ${lat}, Longitude ${lng} is not a valid location, ignored`);
  r.latitude = "";
  r.longitude = "";
}

let lastNominatim = 0;

async function nominatim(params: Record<string, string>): Promise<GeoEntry> {
  const wait = lastNominatim + NOMINATIM_GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastNominatim = Date.now();
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.search = new URLSearchParams({
    format: "jsonv2",
    limit: "1",
    addressdetails: "1",
    "accept-language": "en",
    ...params,
  }).toString();
  try {
    const res = await fetchWithTimeout(url.href);
    if (!res.ok) return { error: `HTTP ${res.status}`, at: now() };
    const hits = (await res.json()) as {
      lat: string;
      lon: string;
      display_name?: string;
      category?: string;
      type?: string;
      importance?: number;
      address?: { country_code?: string };
    }[];
    const hit = hits[0];
    if (!hit) return { error: "no match", at: now() };
    const entry: GeoHit = {
      lat: Number(Number(hit.lat).toFixed(4)),
      lng: Number(Number(hit.lon).toFixed(4)),
      label: hit.display_name?.split(",").slice(0, 2).join(",").trim(),
    };
    if (hit.address?.country_code) entry.code = hit.address.country_code;
    if (hit.category) entry.kind = [hit.category, hit.type].filter(Boolean).join("/");
    if (typeof hit.importance === "number") entry.importance = Number(hit.importance.toFixed(3));
    return entry;
  } catch (err) {
    return { error: (err as Error).message, at: now() };
  }
}

type GeoCache = Record<string, GeoEntry>;

/** The country itself: its centre (last-resort pin) and ISO code (to constrain city searches). */
async function countryInfo(cache: GeoCache, country: string): Promise<GeoEntry> {
  if (!country) return { error: "no country", at: now() };
  const entry = await cached(cache, `country:${country}`, () => nominatim({ q: country, featureType: "country" }));
  if ("lat" in entry && !entry.code) {
    // Entry from before codes were stored: look it up again.
    delete cache[`country:${country}`];
    return cached(cache, `country:${country}`, () => nominatim({ q: country, featureType: "country" }));
  }
  return entry;
}

/**
 * A hit that is a place (city, town, region, campus), not the first post office
 * or shop whose name happens to contain the words. Places rank high in
 * Nominatim's importance; a street-level feature is close to zero.
 */
function isPlace(hit: GeoHit): boolean {
  if (/^(place|boundary)\//.test(hit.kind ?? "")) return true;
  return (hit.importance ?? 0) >= 0.2;
}

/** Geocode a place name inside a country, trying progressively simpler spellings. */
async function placeCity(cache: GeoCache, city: string, country: string, code: string | undefined): Promise<GeoEntry> {
  const variants = [city];
  const withComma = city.replace(/^(.*\S)\s+([A-Z]{2}|D\.?C\.?)$/, "$1, $2"); // "San Jose CA" → "San Jose, CA"
  if (withComma !== city) variants.push(withComma);
  const simpler = withComma.replace(/\(.*?\)/g, " ").replace(/\b(area|region|metro|greater|downtown)\b/gi, " ").replace(/\s+/g, " ").trim();
  if (simpler && !variants.includes(simpler)) variants.push(simpler);
  const firstPart = simpler.split(",")[0].trim();
  if (firstPart && !variants.includes(firstPart)) variants.push(firstPart);
  const cc = code ? { countrycodes: code } : {};
  let last: GeoEntry = { error: "no match", at: now() };
  for (const v of variants) {
    const q = [v, country].filter(Boolean).join(", ");
    last = await cached(cache, q, async () => {
      const hit = await nominatim({ q, ...cc });
      if ("error" in hit || isPlace(hit)) return hit;
      const settlement = await nominatim({ q, ...cc, featureType: "settlement" });
      if ("lat" in settlement) return settlement;
      return { error: `only matched ${hit.label} (${hit.kind})`, at: now() };
    });
    if ("lat" in last) return last;
  }
  return last;
}

/**
 * The organization's own address, from its website: schema.org JSON-LD
 * PostalAddress first, then the most repeated "City, ST 12345" in the page.
 */
function addressFromHtml(html: string): { city: string; region: string; country: string } | null {
  const scripts = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  for (const tag of scripts) {
    const body = tag.replace(/^<script[^>]*>/i, "").replace(/<\/script>$/i, "").trim();
    let json: unknown;
    try {
      json = JSON.parse(body);
    } catch {
      continue;
    }
    const found = findPostalAddress(json, 0);
    if (found) return found;
  }
  const text = decodeEntities(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "));
  const counts = new Map<string, number>();
  for (const m of text.matchAll(/([A-Z][A-Za-z.'’ -]{1,40}?),\s*([A-Z]{2})\s+\d{5}(?:-\d{4})?\b/g)) {
    const city = m[1]
      .replace(/^.*\b(St|Street|Ave|Avenue|Blvd|Boulevard|Rd|Road|Dr|Drive|Way|Ln|Lane|Suite|Ste|Floor|Fl|Pl|Place|Ct|Court|Hwy|Pkwy|Parkway|Box)\.?\s+/i, "")
      .replace(/^.*#\s*\w+\s+/, "")
      .trim();
    if (!city || city.length > 40) continue;
    const key = `${city}|${m[2]}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const best = [...counts].sort((a, b) => b[1] - a[1])[0];
  if (!best) return null;
  const [city, region] = best[0].split("|");
  return { city, region, country: "United States" };
}

function findPostalAddress(node: unknown, depth: number): { city: string; region: string; country: string } | null {
  if (depth > 6 || !node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const n of node) {
      const f = findPostalAddress(n, depth + 1);
      if (f) return f;
    }
    return null;
  }
  const o = node as Record<string, unknown>;
  const locality = o.addressLocality;
  if (typeof locality === "string" && locality.trim()) {
    const country = o.addressCountry;
    return {
      city: locality.trim(),
      region: typeof o.addressRegion === "string" ? o.addressRegion.trim() : "",
      country:
        typeof country === "string"
          ? normalizeCountry(country)
          : country && typeof country === "object" && typeof (country as { name?: unknown }).name === "string"
            ? normalizeCountry((country as { name: string }).name)
            : "",
    };
  }
  for (const key of ["address", "location", "@graph", "mainEntity", "publisher", "organization", "parentOrganization"]) {
    if (key in o) {
      const f = findPostalAddress(o[key], depth + 1);
      if (f) return f;
    }
  }
  return null;
}

/** Pin for a remote placement: the organization's address, found on its website. */
async function placeOrganization(cache: GeoCache, p: Placement): Promise<GeoEntry> {
  const domain = domainOf(p.partner_website);
  if (!domain) return { error: "no website", at: now() };
  return cached(cache, `org:${domain}`, async () => {
    const page = await getPage(p.partner_website);
    if (!page.html) return { error: `site returned ${page.status}`, at: now() };
    const addr = addressFromHtml(page.html);
    if (!addr) return { error: "no address on website", at: now() };
    const country = addr.country || p.country;
    const info = country ? await countryInfo(cache, country) : null;
    const code = info && "code" in info ? info.code : undefined;
    const q = [addr.city, addr.region, country].filter(Boolean).join(", ");
    const hit = await nominatim({ q, ...(code ? { countrycodes: code } : {}) });
    if ("error" in hit) return hit;
    return { ...hit, label: [addr.city, addr.region].filter(Boolean).join(", ") };
  });
}

async function geocode(cache: GeoCache, rows: Placement[]): Promise<void> {
  rows.forEach(checkCoords);
  for (const r of rows) {
    if (hasCoords(r)) continue;
    const place = r.city ? `${r.city}${r.country ? `, ${r.country}` : ""}` : r.country;
    const info = r.country ? await countryInfo(cache, r.country) : null;
    const code = info && "code" in info ? info.code : undefined;
    const pin = (hit: GeoHit) => {
      r.latitude = String(hit.lat);
      r.longitude = String(hit.lng);
    };

    if (r.city) {
      const hit = await placeCity(cache, r.city, r.country, code);
      if ("lat" in hit) {
        pin(hit);
        report.geocoded.push(`${place} → ${hit.lat}, ${hit.lng}${hit.label ? ` (${hit.label})` : ""}`);
        if (r.placeIndex === 0) report.suggestedCoords.push(`${r.where}: ${place}; Latitude ${hit.lat}, Longitude ${hit.lng}`);
        continue;
      }
    }

    let why = r.city ? `"${r.city}" not found` : "no city";
    if (r.remote && !r.city) {
      const org = r.partner_organization || domainOf(r.partner_website) || "the organization";
      const hit = await placeOrganization(cache, r);
      // The address on the website must be in the fellow's stated country: a
      // South African organization's New York fundraising office is not the pin.
      if ("lat" in hit && (!code || !hit.code || hit.code === code)) {
        pin(hit);
        r.fellowship_loc = `${r.fellowship_loc} (${hit.label})`;
        report.remotePlaced.push(`${r.where}: ${org} is at ${hit.label}`);
        continue;
      }
      why = "lat" in hit ? `remote; the address on ${org}'s website is in another country (${hit.label})` : `remote; no address found for ${org}`;
    }

    if (info && "lat" in info) {
      pin(info);
      report.countryFallback.push(`${r.where}: ${why}; pinned at the centre of ${r.country}`);
      continue;
    }
    report.geocodeFailed.push(`${r.where}: ${place ? `"${place}"` : "no city or country"} could not be placed`);
  }
}

// ---------------------------------------------------------------------------
// Logos
// ---------------------------------------------------------------------------

type Page = { html: string; url: string; status: string };
const pages = new Map<string, Promise<Page>>();

/** Fetch an organization's home page once per domain, shared by logo and address lookups. */
function getPage(website: string): Promise<Page> {
  const domain = domainOf(website) || website;
  let p = pages.get(domain);
  if (!p) {
    p = (async () => {
      try {
        const res = await fetchPolitely(website, { headers: { accept: "text/html,*/*;q=0.5" } });
        const html = res.ok ? await res.text() : "";
        return { html, url: res.url || website, status: `HTTP ${res.status}` };
      } catch (err) {
        return { html: "", url: website, status: (err as Error).message };
      }
    })();
    pages.set(domain, p);
  }
  return p;
}

/** File extension from the bytes themselves; servers lie about content-type and 200 their 404 pages. */
function sniffImage(b: Uint8Array): string {
  if (b.length < 12) return "";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png";
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return "gif";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return "webp";
  if (b[0] === 0 && b[1] === 0 && b[2] === 1 && b[3] === 0) return "ico";
  if (b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70) {
    const brand = String.fromCharCode(b[8], b[9], b[10], b[11]);
    if (/avi[fs]/.test(brand)) return "avif";
  }
  const head = new TextDecoder().decode(b.subarray(0, 2048)).trimStart();
  if (/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE[^>]*>\s*)?<svg[\s>]/i.test(head)) return "svg";
  return "";
}

type Candidate = { url: string; source: string };

function attr(tag: string, name: string): string {
  return tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"))?.slice(1).find((v) => v !== undefined) ?? "";
}

/**
 * Candidate icon URLs from a page, best first: apple-touch-icon, web manifest
 * icons, <link rel="icon"> largest first (PNG/SVG before ICO), then the
 * well-known paths. og:image is deliberately not used: it is almost always a
 * photo or banner.
 */
async function iconCandidates(page: Page): Promise<Candidate[]> {
  const resolve = (u: string) => {
    try {
      const href = new URL(decodeEntities(u.trim()), page.url);
      return /^https?:$/.test(href.protocol) ? href.href : "";
    } catch {
      return "";
    }
  };
  const head = page.html.slice(0, 200_000);
  const links = (head.match(/<link\b[^>]*>/gi) ?? []).map((t) => ({
    rel: attr(t, "rel").toLowerCase(),
    url: resolve(attr(t, "href")),
    size: Number(attr(t, "sizes").match(/\d+/)?.[0] ?? 0),
  }));
  const rank = (l: { url: string; size: number }) => (/\.ico(\?|$)/i.test(l.url) ? 0 : 1000) + l.size;
  const pick = (re: RegExp, source: string) =>
    links
      .filter((l) => l.url && re.test(l.rel))
      .sort((a, b) => rank(b) - rank(a))
      .map((l) => ({ url: l.url, source }));

  const manifest: Candidate[] = [];
  const manifestUrl = links.find((l) => l.url && /(^|\s)manifest(\s|$)/.test(l.rel))?.url;
  if (manifestUrl) {
    try {
      const res = await fetchPolitely(manifestUrl, { headers: { accept: "application/manifest+json,application/json,*/*" } });
      if (res.ok) {
        const m = (await res.json()) as { icons?: { src?: string; sizes?: string; purpose?: string }[] };
        const icons = (m.icons ?? [])
          .filter((i) => i.src && !/monochrome/.test(i.purpose ?? ""))
          .map((i) => ({ url: resolve(new URL(i.src!, manifestUrl).href), size: Number(i.sizes?.match(/\d+/)?.[0] ?? 0) }))
          .filter((i) => i.url)
          .sort((a, b) => b.size - a.size);
        manifest.push(...icons.map((i) => ({ url: i.url, source: "web manifest" })));
      }
    } catch {
      /* no manifest, fine */
    }
  }

  const tile = (head.match(/<meta\b[^>]*>/gi) ?? [])
    .filter((t) => /msapplication-tileimage/i.test(attr(t, "name")))
    .map((t) => ({ url: resolve(attr(t, "content")), source: "msapplication-TileImage" }))
    .filter((c) => c.url);

  const out = [
    ...pick(/apple-touch-icon/, "apple-touch-icon"),
    ...manifest,
    ...tile,
    ...pick(/(^|\s)(shortcut )?icon(\s|$)/, "icon"),
    { url: resolve("/apple-touch-icon.png"), source: "/apple-touch-icon.png" },
    { url: resolve("/apple-touch-icon-precomposed.png"), source: "/apple-touch-icon-precomposed.png" },
    { url: resolve("/favicon.ico"), source: "favicon.ico" },
  ];
  return out.filter((c) => c.url && out.findIndex((o) => o.url === c.url) === out.indexOf(c));
}

async function downloadImage(url: string): Promise<{ bytes: Uint8Array; ext: string } | null> {
  let res: Response;
  try {
    res = await fetchPolitely(url, { headers: { accept: "image/*,*/*;q=0.5" } });
  } catch (err) {
    if (!/timeout|aborted/i.test((err as Error).message)) throw err;
    res = await fetchPolitely(url, { headers: { accept: "image/*,*/*;q=0.5" } }); // one retry on timeout
  }
  if (!res.ok) return null;
  const len = Number(res.headers.get("content-length") ?? 0);
  if (len > MAX_LOGO_BYTES) return null;
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_LOGO_BYTES) return null;
  const ext = sniffImage(bytes);
  return ext ? { bytes, ext } : null;
}

/** Google Drive share links in every form the Form and Drive UI produce. */
function driveId(url: string): string {
  if (!/google\.com|googleusercontent\.com/i.test(url)) return "";
  return (
    url.match(/\/file\/d\/([a-zA-Z0-9_-]{10,})/)?.[1] ??
    url.match(/[?&]id=([a-zA-Z0-9_-]{10,})/)?.[1] ??
    url.match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]{10,})/)?.[1] ??
    ""
  );
}

/** URLs to try for a Logo cell, best first. */
function logoSources(link: string): string[] {
  const id = driveId(link);
  if (id) {
    return [
      `https://drive.google.com/uc?export=download&id=${id}`,
      `https://lh3.googleusercontent.com/d/${id}=w400`,
      `https://drive.usercontent.google.com/download?id=${id}&export=download`,
    ];
  }
  if (/^https?:\/\//i.test(link)) return [link];
  if (/^[\w.-]+\.[a-z]{2,}\/\S*\.(png|jpe?g|gif|webp|svg|ico|avif)(\?\S*)?$/i.test(link)) return [`https://${link}`];
  return [];
}

async function saveLogo(bytes: Uint8Array, base: string, ext: string): Promise<string> {
  const file = `${base}.${ext}`;
  await writeAtomic(path.join(LOGO_DIR, file), bytes);
  return file;
}

/** Download the image a Logo cell points at. */
async function fetchLinkedLogo(link: string, base: string): Promise<LogoEntry> {
  const at = now();
  const sources = logoSources(link);
  if (!sources.length) return { error: "not a link", at };
  let reason = "";
  for (const url of sources) {
    try {
      const img = await downloadImage(url);
      if (img) return { file: await saveLogo(img.bytes, base, img.ext), source: driveId(link) ? "Google Drive" : "Logo link", at };
      reason = "not an image";
    } catch (err) {
      reason = (err as Error).message;
    }
  }
  if (driveId(link)) reason = "Google Drive file is not shared with \"Anyone with the link\" (or is not an image)";
  return { error: reason, at };
}

/** Find and download an icon from the organization's website. */
async function fetchSiteLogo(website: string): Promise<LogoEntry> {
  const at = now();
  const domain = domainOf(website);
  const page = await getPage(website);
  for (const c of await iconCandidates(page)) {
    try {
      const img = await downloadImage(c.url);
      if (!img) continue;
      return { file: await saveLogo(img.bytes, domain, img.ext), source: c.source, at };
    } catch {
      /* try the next candidate */
    }
  }
  return { error: page.html ? "no usable icon" : `site returned ${page.status}`, at };
}

async function logos(cache: Record<string, LogoEntry>, rows: Placement[]): Promise<void> {
  await mkdir(LOGO_DIR, { recursive: true });

  // 1. Logo cells: one download per distinct link.
  const byLink = new Map<string, Placement[]>();
  for (const r of rows) if (r.partner_logo) byLink.set(r.partner_logo, [...(byLink.get(r.partner_logo) ?? []), r]);
  const linked = await mapLimit([...byLink], LOGO_CONCURRENCY, async ([link, group]) => {
    const base =
      domainOf(group[0].partner_website) ||
      slugify(group[0].partner_organization) ||
      createHash("sha1").update(link).digest("hex").slice(0, 12);
    const fresh = !cache[link] || ("error" in cache[link] && isStale(cache[link].at));
    return { link, group, base, fresh, entry: await cached(cache, link, () => fetchLinkedLogo(link, base)) };
  });
  // Report in sheet order, not completion order, so summaries are stable.
  const uploaded = new Map<string, string>(); // domain → a Logo cell's file
  for (const { link, group, base, fresh, entry } of linked) {
    const first = group[0];
    if ("file" in entry) {
      if (fresh) report.logosFetched.push(`${first.partner_organization || base} ← ${entry.source}`);
      for (const r of group) {
        r.partner_logo = `logos/${entry.file}`;
        const d = domainOf(r.partner_website);
        if (d && !uploaded.has(d)) uploaded.set(d, r.partner_logo);
      }
    } else {
      report.logoLinkFailed.push(`${first.where}: Logo "${link}": ${entry.error}`);
      for (const r of group) r.partner_logo = "";
    }
  }

  // 2. Everyone else: the logo another fellow uploaded for the same
  // organization, else one icon per domain. Fetching the icon anyway would
  // overwrite the upload, which is saved under the same domain-based name.
  const byDomain = new Map<string, Placement[]>();
  for (const r of rows) {
    if (r.partner_logo || !r.partner_website) continue;
    const d = domainOf(r.partner_website);
    if (d && uploaded.has(d)) r.partner_logo = uploaded.get(d)!;
    else if (d) byDomain.set(d, [...(byDomain.get(d) ?? []), r]);
  }
  const icons = await mapLimit([...byDomain], LOGO_CONCURRENCY, async ([domain, group]) => {
    const fresh = !cache[domain] || ("error" in cache[domain] && isStale(cache[domain].at));
    return { domain, group, fresh, entry: await cached(cache, domain, () => fetchSiteLogo(group[0].partner_website)) };
  });
  for (const { domain, group, fresh, entry } of icons) {
    if ("file" in entry) {
      if (fresh) report.logosFetched.push(`${domain} ← ${entry.source}`);
      for (const r of group) r.partner_logo = `logos/${entry.file}`;
    } else {
      report.logoFailed.push(`${domain}: ${entry.error}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function summary(): string {
  const lines: string[] = ["## Cardinal Quarter Map data build", ""];
  lines.push(`Lookup cache: ${report.cacheHits} hit(s); ${report.cacheMisses} new or retried entry/entries.`, "");
  lines.push("| Period | Fellows | Shown |", "| --- | ---: | --- |");
  for (const p of report.periods) lines.push(`| ${p.displayName} | ${p.count} | ${p.show ? "yes" : "hidden"} |`);
  if (report.groups.length) {
    lines.push("", "| Group | Periods | Fellows | Shown |", "| --- | --- | ---: | --- |");
    for (const g of report.groups) {
      lines.push(`| ${g.displayName} | ${g.periods.join(", ")} | ${g.count} | ${g.show ? "yes" : "hidden"} |`);
    }
  }
  const section = (title: string, items: string[]) => {
    if (!items.length) return;
    lines.push("", `### ${title} (${items.length})`, "");
    for (const i of items) lines.push(`- ${i}`);
  };
  section(
    "Rows with a Period that is not in the Periods list (not published)",
    [...report.orphans].map(([p, n]) => `"${p}": ${n} row(s)`),
  );
  section("Group notes", report.groupNotes);
  section("Column notes", report.columns);
  section("Rows skipped", report.skipped);
  section("Duplicates resolved (last row wins)", report.duplicates);
  section("Coordinates that were reversed and swapped", report.swapped);
  section("Coordinates that were invalid and replaced by geocoding or skipped", report.badCoords);
  section("Rows with several places (one pin each)", report.multi);
  section("Addresses geocoded", report.geocoded);
  section("Remote fellows pinned at the organization's address (from its website)", report.remotePlaced);
  section("Pinned at the centre of the country (add Latitude/Longitude or a city to place precisely)", report.countryFallback);
  section("Addresses that could not be geocoded", report.geocodeFailed);
  section("Logos fetched", report.logosFetched);
  section("Logo links that could not be downloaded (website icon used instead)", report.logoLinkFailed);
  section("Logos not found (fellow shown without one)", report.logoFailed);
  lines.push("", sheetReviewSection({
    unknownPeriods: [...report.orphans].map(([p,n]) => `"${p}": ${n} row(s)`),
    groups: report.groupNotes, columns: report.columns, skipped: report.skipped,
    duplicates: report.duplicates, swapped: report.swapped,
    invalidCoords: report.badCoords, suggestedCoords: report.suggestedCoords,
    remote: report.remotePlaced, countryFallback: report.countryFallback,
    failedGeocodes: report.geocodeFailed, failedLogoLinks: report.logoLinkFailed,
    failedLogos: report.logoFailed,
  }));
  return lines.join("\n") + "\n";
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const periods = await loadPeriods();
  if (periods.length === 0) throw new Error("No periods. Add a Periods tab to the sheet or entries to data/periods.json.");
  const bySlug = new Map(periods.map((p) => [slugify(p.period), p]));
  const groups = await loadGroups();

  const sources = await loadSources();
  if (sources.length === 0) throw new Error("No sources. Add a Sources tab to the sheet or CSVs to data/csv/.");
  const rows: Row[] = [];
  for (const src of sources) {
    const got = rowsFromSource(await src.load(), src);
    console.log(`${src.label}: ${got.length} row(s)`);
    rows.push(...got);
  }

  // Keep only rows in a listed period; dedup on email (or name) + period, last wins.
  const kept = new Map<string, Row>();
  for (const r of rows) {
    const slug = slugify(r.period);
    if (!bySlug.has(slug)) {
      report.orphans.set(r.period || "(blank)", (report.orphans.get(r.period || "(blank)") ?? 0) + 1);
      continue;
    }
    const key = `${slug}|${r.email || `name:${r.name.toLowerCase()}`}`;
    const prev = kept.get(key);
    if (prev) report.duplicates.push(`${prev.where} replaced by ${r.where}`);
    kept.set(key, r);
  }
  const live = placements([...kept.values()]);

  await mkdir(path.dirname(GEOCACHE), { recursive: true });
  const geocache = await readJson<GeoCache>(GEOCACHE, {});
  const logocache = await readJson<Record<string, LogoEntry>>(LOGOCACHE, {});
  // Saves run one after another so an older snapshot never lands last.
  let saving = Promise.resolve();
  const saveCaches = () => (saving = saving.then(() => Promise.all([writeJson(GEOCACHE, geocache), writeJson(LOGOCACHE, logocache)])).then(() => {}));
  const checkpoint = setInterval(() => saveCaches().catch((err) => console.warn(`Cache save failed: ${(err as Error).message}`)), CACHE_SAVE_MS);
  try {
    // Geocoding is rate-limited to one request a second; logos hit other hosts, so they overlap.
    await Promise.all([geocode(geocache, live), logos(logocache, live)]);
  } finally {
    clearInterval(checkpoint);
    await saveCaches();
  }

  const index: Index = { periods: [], views: [] };
  const peopleByPeriod = new Map<string, number>();
  for (const [slug, p] of [...bySlug].sort((a, b) => a[1].order - b[1].order)) {
    const fellows: Fellow[] = [];
    const people = new Set<string>();
    const unplaced = new Set<string>();
    for (const r of live) {
      if (slugify(r.period) !== slug) continue;
      if (!hasCoords(r)) {
        unplaced.add(r.where);
        continue;
      }
      people.add(r.person);
      fellows.push({
        id: r.person,
        name: r.name,
        class_year: r.class_year,
        major: r.major,
        school: r.school,
        fellowship: r.fellowship,
        partner_organization: r.partner_organization,
        country: r.country,
        fellowship_loc: r.fellowship_loc,
        latitude: Number(r.latitude),
        longitude: Number(r.longitude),
        affiliation: r.affiliation,
        partner_website: r.partner_website,
        partner_logo: r.partner_logo,
        interest_area: r.interest_area,
      });
    }
    for (const where of unplaced) report.skipped.push(`${where}: no coordinates and the location could not be placed`);
    fellows.sort((a, b) => a.name.localeCompare(b.name) || a.fellowship_loc.localeCompare(b.fellowship_loc));
    await writeJson(path.join(OUT_DIR, `${slug}.json`), fellows);
    index.periods.push({ slug, displayName: p.displayName, count: people.size });
    peopleByPeriod.set(slug, people.size);
    report.periods.push({ period: p.period, displayName: p.displayName, count: people.size, show: p.show });
  }
  index.views = resolveViews(periods, groups);
  for (const v of index.views) {
    if (v.periods.length === 1 && bySlug.has(v.slug)) continue;
    const labels = v.periods.map((s) => bySlug.get(s)?.displayName ?? s);
    const count = v.periods.reduce((n, s) => n + (peopleByPeriod.get(s) ?? 0), 0);
    report.groups.push({ displayName: v.displayName, periods: labels, count, show: v.show });
  }
  if (!index.views.some((v) => v.show)) throw new Error("Every period and group is hidden (Show = No); show at least one.");
  await writeJson(path.join(OUT_DIR, "index.json"), index);

  // A period removed from the sheet must not stay reachable by URL.
  const keep = new Set([...bySlug.keys()].map((s) => `${s}.json`).concat("index.json"));
  for (const f of await readdir(OUT_DIR)) {
    if (f.endsWith(".json") && !keep.has(f)) await unlink(path.join(OUT_DIR, f));
  }

  const text = summary();
  console.log("\n" + text);
  if (process.env.GITHUB_STEP_SUMMARY) await writeFile(process.env.GITHUB_STEP_SUMMARY, text, { flag: "a" });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
