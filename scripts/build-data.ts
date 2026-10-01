/**
 * Build-time data pipeline. Runs on Node 24+ (no transpile step).
 *
 *   SHEET_ID=<id> node scripts/build-data.ts
 *
 * Inputs (see data/README.md for the contract):
 *   - Google Sheet (when SHEET_ID is set): a "Periods" tab, a "Sources" tab,
 *     and the student tabs the Sources tab lists.
 *   - Local CSVs: every data/csv/*.csv, with periods from data/periods.json.
 *
 * Student columns are matched by header name, in any order. Rows are grouped
 * by their Period column (CSV file name when the column is absent), kept
 * only when that period is listed, and deduplicated on email + period.
 * Missing coordinates are geocoded from City + Country (Nominatim, cached in
 * data/geocache.json). Missing logos are fetched from the organization's
 * website into public/logos/ (tracked in data/logocache.json).
 *
 * Output: public/data/<period>.json + index.json, pretty-printed so commits
 * from the nightly workflow show readable diffs. Emails never reach output.
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import Papa from "papaparse";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT_DIR = path.join(ROOT, "public", "data");
const LOGO_DIR = path.join(ROOT, "public", "logos");
const CSV_DIR = path.join(ROOT, "data", "csv");
const LOCAL_PERIODS = path.join(ROOT, "data", "periods.json");
const GEOCACHE = path.join(ROOT, "data", "geocache.json");
const LOGOCACHE = path.join(ROOT, "data", "logocache.json");

const SHEET_ID = process.env.SHEET_ID?.trim();
const PERIODS_TAB = process.env.PERIODS_TAB?.trim() || "Periods";
const SOURCES_TAB = process.env.SOURCES_TAB?.trim() || "Sources";
const USER_AGENT = "cardinal-quarter-map build (https://github.com/CardinalQuarter/cardinal-quarter-map)";
const RETRY_FAILURES_AFTER_DAYS = 30;
const FETCH_TIMEOUT_MS = 15_000;
const MAX_LOGO_BYTES = 2_000_000;

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
  interest_area: ["interestarea", "interestareas"],
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

type Period = { period: string; displayName: string; order: number };
type PeriodMeta = { slug: string; displayName: string; count: number };

type GeoEntry = { lat: number; lng: number; label?: string } | { error: string; at: string };
type LogoEntry = { file: string; source: string; at: string } | { error: string; at: string };

/** Everything worth telling a human about, printed and written to the job summary. */
const report = {
  periods: [] as { period: string; displayName: string; count: number }[],
  columns: [] as string[],
  orphans: new Map<string, number>(),
  duplicates: [] as string[],
  skipped: [] as string[],
  swapped: [] as string[],
  badCoords: [] as string[],
  geocoded: [] as string[],
  geocodeFailed: [] as string[],
  logosFetched: [] as string[],
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

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...init,
    headers: { "user-agent": USER_AGENT, ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    redirect: "follow",
  });
}

async function fetchText(url: string): Promise<string> {
  const res = await fetchWithTimeout(url);
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
  await writeFile(file, JSON.stringify(value, null, 2) + "\n");
}

function isStale(at: string): boolean {
  const age = Date.now() - new Date(at).getTime();
  return !Number.isFinite(age) || age > RETRY_FAILURES_AFTER_DAYS * 86_400_000;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Turn any Google Drive share link into a directly embeddable image URL. */
function normalizeLogoUrl(url: string): string {
  const m =
    url.match(/\/file\/d\/([a-zA-Z0-9_-]{10,})/) ??
    url.match(/[?&]id=([a-zA-Z0-9_-]{10,})/) ??
    url.match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]{10,})/);
  return m ? `https://lh3.googleusercontent.com/d/${m[1]}=w200` : url;
}

function normalizeWebsite(url: string): string {
  const u = url.trim();
  if (!u) return "";
  return /^https?:\/\//i.test(u) ? u : `https://${u}`;
}

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

function parsePeriods(rows: string[][], label: string): Period[] {
  const [header = [], ...body] = rows;
  const cols = header.map(normalizeHeader);
  const iPeriod = cols.indexOf("period");
  const iName = cols.indexOf("displayname");
  const iOrder = cols.indexOf("order");
  if (iPeriod < 0) throw new Error(`${label}: needs a "Period" column`);
  return body
    .map((r, i) => ({
      period: (r[iPeriod] ?? "").trim(),
      displayName: (r[iName] ?? "").trim() || (r[iPeriod] ?? "").trim(),
      order: Number(r[iOrder]) || i + 1,
    }))
    .filter((p) => p.period);
}

async function loadPeriods(): Promise<Period[]> {
  const periods: Period[] = [];
  if (SHEET_ID) periods.push(...parsePeriods(parseCsv(await fetchText(sheetCsvUrl(PERIODS_TAB))), PERIODS_TAB));
  const local = await readJson<Partial<Period>[]>(LOCAL_PERIODS, []);
  local.forEach((p, i) => {
    if (!p.period) return;
    periods.push({ period: p.period, displayName: p.displayName ?? p.period, order: p.order ?? i + 1 });
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

type Source = { label: string; load: () => Promise<string[][]>; defaultPeriod?: string };

async function loadSources(): Promise<Source[]> {
  const sources: Source[] = [];
  if (SHEET_ID) {
    const rows = parseCsv(await fetchText(sheetCsvUrl(SOURCES_TAB)));
    const [header = [], ...body] = rows;
    const iTab = Math.max(0, header.map(normalizeHeader).findIndex((h) => h === "tab" || h === "tabname"));
    for (const r of body) {
      const tab = (r[iTab] ?? "").trim();
      if (tab) sources.push({ label: `sheet tab "${tab}"`, load: () => fetchText(sheetCsvUrl(tab)).then(parseCsv) });
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

function rowsFromSource(rows: string[][], src: Source): Row[] {
  const [header, ...body] = rows;
  if (!header) return [];
  const cols = mapHeader(header, src.label);
  const required: Field[] = ["name"];
  for (const f of required) {
    if (cols[f] === undefined) throw new Error(`${src.label}: no "${ALIASES[f][0]}" column (headers: ${header.join(", ")})`);
  }
  if (cols.period === undefined && !src.defaultPeriod) {
    throw new Error(`${src.label}: no "Period" column`);
  }
  const out: Row[] = [];
  body.forEach((raw, i) => {
    const get = (f: Field) => (cols[f] === undefined ? "" : (raw[cols[f]!] ?? "").trim());
    const name = get("name");
    if (!name) return; // blank row
    const where = `${src.label} line ${i + 2} (${name})`;
    const row = Object.fromEntries((Object.keys(ALIASES) as Field[]).map((f) => [f, get(f)])) as Row;
    row.where = where;
    row.period ||= src.defaultPeriod ?? "";
    row.email = row.email.toLowerCase();
    row.partner_website = normalizeWebsite(row.partner_website);
    row.partner_logo = row.partner_logo ? normalizeLogoUrl(row.partner_logo) : "";
    out.push(row);
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
  if (!hasCoords(r)) return;
  const lat = Number(r.latitude);
  const lng = Number(r.longitude);
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

async function geocode(cache: Record<string, GeoEntry>, rows: Row[]): Promise<void> {
  rows.forEach(checkCoords);
  const pending = rows.filter((r) => !hasCoords(r));
  const queries = new Map<string, Row[]>();
  for (const r of pending) {
    const q = [r.fellowship_loc, r.country].filter(Boolean).join(", ");
    if (!q) continue;
    queries.set(q, [...(queries.get(q) ?? []), r]);
  }
  let calls = 0;
  for (const [q, group] of queries) {
    let entry = cache[q];
    if (!entry || ("error" in entry && isStale(entry.at))) {
      if (calls++ > 0) await sleep(1100); // Nominatim usage policy: max 1 request/second
      entry = await lookup(q);
      cache[q] = entry;
      if ("error" in entry) report.geocodeFailed.push(`${q}: ${entry.error}`);
      else report.geocoded.push(`${q} → ${entry.lat}, ${entry.lng}${entry.label ? ` (${entry.label})` : ""}`);
    }
    if ("lat" in entry) {
      for (const r of group) {
        r.latitude = String(entry.lat);
        r.longitude = String(entry.lng);
      }
    }
  }
}

async function lookup(q: string): Promise<GeoEntry> {
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`;
  try {
    const res = await fetchWithTimeout(url);
    if (!res.ok) return { error: `HTTP ${res.status}`, at: new Date().toISOString() };
    const hits = (await res.json()) as { lat: string; lon: string; display_name?: string }[];
    const hit = hits[0];
    if (!hit) return { error: "no match", at: new Date().toISOString() };
    const lat = Number(Number(hit.lat).toFixed(4));
    const lng = Number(Number(hit.lon).toFixed(4));
    return { lat, lng, label: hit.display_name?.split(",").slice(0, 2).join(",") };
  } catch (err) {
    return { error: (err as Error).message, at: new Date().toISOString() };
  }
}

// ---------------------------------------------------------------------------
// Logos
// ---------------------------------------------------------------------------

const IMAGE_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico",
  "image/avif": "avif",
};

function domainOf(website: string): string {
  try {
    return new URL(website).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

/**
 * Candidate icon URLs from a page, best first: apple-touch-icon, then <link
 * rel="icon"> largest first (PNG/SVG before ICO), then /favicon.ico.
 * og:image is deliberately not used: it is almost always a photo or banner.
 */
function iconCandidates(html: string, pageUrl: string): { url: string; source: string }[] {
  const resolve = (u: string) => {
    try {
      return new URL(u.replace(/&amp;/g, "&"), pageUrl).href;
    } catch {
      return "";
    }
  };
  const attr = (tag: string, name: string) => tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']+)["']`, "i"))?.[1] ?? "";
  const links = (html.match(/<link\b[^>]*>/gi) ?? []).map((t) => ({
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
  const out = [
    ...pick(/apple-touch-icon/, "apple-touch-icon"),
    ...pick(/(^|\s)(shortcut )?icon(\s|$)/, "icon"),
    { url: resolve("/favicon.ico"), source: "favicon.ico" },
  ];
  return out.filter((c, i) => out.findIndex((o) => o.url === c.url) === i);
}

async function download(url: string): Promise<{ bytes: Uint8Array; ext: string } | null> {
  const res = await fetchWithTimeout(url, { headers: { accept: "image/*" } });
  if (!res.ok) return null;
  const type = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  const ext = IMAGE_EXT[type] ?? (url.match(/\.(png|jpe?g|gif|webp|svg|ico|avif)(\?|$)/i)?.[1]?.toLowerCase().replace("jpeg", "jpg") ?? "");
  if (!ext) return null;
  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length === 0 || bytes.length > MAX_LOGO_BYTES) return null;
  return { bytes, ext };
}

async function fetchLogo(website: string): Promise<LogoEntry> {
  const domain = domainOf(website);
  const at = new Date().toISOString();
  let html = "";
  let pageUrl = website;
  let status = "";
  try {
    const page = await fetchWithTimeout(website, { headers: { accept: "text/html" } });
    status = `HTTP ${page.status}`;
    if (page.ok) {
      html = await page.text();
      pageUrl = page.url || website;
    }
  } catch (err) {
    status = (err as Error).message;
  }
  for (const c of iconCandidates(html, pageUrl)) {
    try {
      const img = await download(c.url);
      if (!img) continue;
      const file = `${domain}.${img.ext}`;
      await writeFile(path.join(LOGO_DIR, file), img.bytes);
      return { file, source: c.source, at };
    } catch {
      /* try the next candidate */
    }
  }
  return { error: html ? "no usable icon" : `site returned ${status}`, at };
}

async function logos(cache: Record<string, LogoEntry>, rows: Row[]): Promise<void> {
  await mkdir(LOGO_DIR, { recursive: true });
  const byDomain = new Map<string, Row[]>();
  for (const r of rows) {
    if (r.partner_logo || !r.partner_website) continue;
    const d = domainOf(r.partner_website);
    if (d) byDomain.set(d, [...(byDomain.get(d) ?? []), r]);
  }
  for (const [domain, group] of byDomain) {
    let entry = cache[domain];
    if (!entry || ("error" in entry && isStale(entry.at))) {
      entry = await fetchLogo(group[0].partner_website);
      cache[domain] = entry;
      if ("error" in entry) report.logoFailed.push(`${domain}: ${entry.error}`);
      else report.logosFetched.push(`${domain} ← ${entry.source}`);
    }
    if ("file" in entry) for (const r of group) r.partner_logo = `logos/${entry.file}`;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function summary(): string {
  const lines: string[] = ["## Cardinal Quarter Map data build", ""];
  lines.push("| Period | Fellows |", "| --- | ---: |");
  for (const p of report.periods) lines.push(`| ${p.displayName} | ${p.count} |`);
  const section = (title: string, items: string[]) => {
    if (!items.length) return;
    lines.push("", `### ${title} (${items.length})`, "");
    for (const i of items) lines.push(`- ${i}`);
  };
  section(
    "Rows with a Period that is not in the Periods list (not published)",
    [...report.orphans].map(([p, n]) => `"${p}": ${n} row(s)`),
  );
  section("Column notes", report.columns);
  section("Rows skipped", report.skipped);
  section("Duplicates resolved (last row wins)", report.duplicates);
  section("Coordinates that were reversed and swapped", report.swapped);
  section("Coordinates that were invalid and replaced by geocoding or skipped", report.badCoords);
  section("Addresses geocoded", report.geocoded);
  section("Addresses that could not be geocoded", report.geocodeFailed);
  section("Logos fetched", report.logosFetched);
  section("Logos not found (fellow shown without one)", report.logoFailed);
  return lines.join("\n") + "\n";
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const periods = await loadPeriods();
  if (periods.length === 0) throw new Error("No periods. Add a Periods tab to the sheet or entries to data/periods.json.");
  const bySlug = new Map(periods.map((p) => [slugify(p.period), p]));

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
  const live = [...kept.values()];

  await mkdir(path.dirname(GEOCACHE), { recursive: true });
  const geocache = await readJson<Record<string, GeoEntry>>(GEOCACHE, {});
  await geocode(geocache, live);
  await writeJson(GEOCACHE, geocache);

  const logocache = await readJson<Record<string, LogoEntry>>(LOGOCACHE, {});
  await logos(logocache, live);
  await writeJson(LOGOCACHE, logocache);

  const index: PeriodMeta[] = [];
  for (const [slug, p] of [...bySlug].sort((a, b) => a[1].order - b[1].order)) {
    const fellows: Fellow[] = [];
    for (const r of live) {
      if (slugify(r.period) !== slug) continue;
      if (!hasCoords(r)) {
        report.skipped.push(`${r.where}: no coordinates and address could not be geocoded`);
        continue;
      }
      const latitude = Number(r.latitude);
      const longitude = Number(r.longitude);
      fellows.push({
        name: r.name,
        class_year: r.class_year,
        major: r.major,
        school: r.school,
        fellowship: r.fellowship,
        partner_organization: r.partner_organization,
        country: r.country,
        fellowship_loc: r.fellowship_loc,
        latitude,
        longitude,
        affiliation: r.affiliation,
        partner_website: r.partner_website,
        partner_logo: r.partner_logo,
        interest_area: r.interest_area,
      });
    }
    fellows.sort((a, b) => a.name.localeCompare(b.name));
    await writeJson(path.join(OUT_DIR, `${slug}.json`), fellows);
    index.push({ slug, displayName: p.displayName, count: fellows.length });
    report.periods.push({ period: p.period, displayName: p.displayName, count: fellows.length });
  }
  await writeJson(path.join(OUT_DIR, "index.json"), index);

  const text = summary();
  console.log("\n" + text);
  if (process.env.GITHUB_STEP_SUMMARY) await writeFile(process.env.GITHUB_STEP_SUMMARY, text, { flag: "a" });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
