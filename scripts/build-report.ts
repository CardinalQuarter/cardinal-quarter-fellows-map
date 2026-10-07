export type SheetReview = {
  unknownPeriods: string[]; groups: string[]; columns: string[];
  skipped: string[]; duplicates: string[]; swapped: string[];
  invalidCoords: string[]; suggestedCoords: string[]; remote: string[];
  countryFallback: string[]; failedGeocodes: string[];
  failedLogoLinks: string[]; failedLogos: string[];
  /** Logo links that failed but whose website icon now shows instead. */
  replacedLogoLinks?: number;
};

/** A row-level item: `<source> line <n> (<name>): <reason>`. */
const ROW_ITEM = /^(.*) line (\d+) \((.*?)\): (.*)$/;
/** Rows sharing a source and reason are merged into one line once there are this many. */
const MERGE_AT = 3;

/** "598–600, 655, 702–731": consecutive line numbers become ranges. */
export function lineRanges(lines: number[]): string {
  const sorted = [...new Set(lines)].sort((a, b) => a - b);
  const runs: string[] = [];
  for (let i = 0; i < sorted.length; i++) {
    let j = i;
    while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++;
    runs.push(i === j ? `${sorted[i]}` : `${sorted[i]}–${sorted[j]}`);
    i = j;
  }
  return runs.join(", ");
}

/**
 * Merge rows with the same source and reason into one line with line ranges;
 * the rest stay one line per row, with the student's name. Order of first
 * appearance is kept.
 */
export function condense(items: string[]): string[] {
  const unique = [...new Set(items)];
  const groups = new Map<string, { source: string; reason: string; lines: number[]; items: string[] }>();
  const order: (string | { key: string })[] = [];
  for (const item of unique) {
    const m = ROW_ITEM.exec(item);
    if (!m) { order.push(item); continue; }
    const [, source, line, , reason] = m;
    const key = `${source}\u0000${reason}`;
    let g = groups.get(key);
    if (!g) { g = { source, reason, lines: [], items: [] }; groups.set(key, g); order.push({ key }); }
    g.lines.push(Number(line));
    g.items.push(item);
  }
  return order.flatMap((o) => {
    if (typeof o === "string") return [o];
    const g = groups.get(o.key)!;
    if (g.items.length < MERGE_AT) return g.items;
    return [`${g.source}, ${g.items.length} rows: ${g.reason} (lines ${lineRanges(g.lines)})`];
  });
}

/**
 * Sheet problems, most urgent first: rows missing from the map, then rows that
 * may be placed or recorded wrong, then optional cleanup (collapsed). Each
 * problem is listed once. `limit` caps each list.
 */
export function sheetReviewSection(review: SheetReview, limit = Infinity): string {
  const lines = ["### Things to address in the sheet"];
  let total = 0;
  const list = (title: string, action: string, items: string[]) => {
    const rows = condense(items);
    if (!rows.length) return;
    total += rows.length;
    lines.push("", `**${title}** (${new Set(items).size}) — ${action}`, "");
    for (const row of rows.slice(0, limit)) lines.push(`- [ ] ${row.replace(/\r?\n/g, " ")}`);
    if (rows.length > limit) lines.push(`- …and ${rows.length - limit} more (see the full build report)`);
  };
  const tier = (heading: string, intro: string, fill: () => void, collapsed = false) => {
    const start = lines.length;
    const before = total;
    fill();
    if (total === before) return;
    const body = lines.splice(start);
    if (collapsed) {
      lines.push("", `<details><summary><strong>${heading}</strong> (${total - before} line(s))</summary>`, "", intro, ...body, "", "</details>");
    } else {
      lines.push("", `#### ${heading}`, "", intro, ...body);
    }
  };

  // A row skipped for want of a place is already listed, with the reason, under Unresolved locations.
  const rowOf = (item: string) => ROW_ITEM.exec(item)?.slice(1, 3).join(" line ");
  const unresolved = new Set(review.failedGeocodes.map(rowOf));
  const skipped = review.skipped.filter((item) => !unresolved.has(rowOf(item)));

  tier("1. Fix: rows not on the map", "These rows are missing from the published map until corrected.", () => {
    list("Unknown periods", "correct the row's Period or its source's Default Period, or add the period to Periods.", review.unknownPeriods);
    list("Headers", "rename unrecognized headers or add missing columns. Extra columns may be intentional.", review.columns);
    list("Skipped rows", "add a City and Country, or a valid Latitude and Longitude.", skipped);
    list("Unresolved locations", "correct City and Country, or add Latitude and Longitude.", review.failedGeocodes);
    list("Groups", "correct group members or remove unused example group rows.", review.groups);
  });
  tier("2. Review: on the map, possibly wrong", "The build made a best guess for these; check that it is right.", () => {
    list("Duplicate students", "keep the intended record. Later sources and rows win for the same email and period.", review.duplicates);
    list("Reversed coordinates", "swap the Latitude and Longitude cells; the map already shows them swapped.", review.swapped);
    list("Invalid coordinates", "correct both coordinate cells, or clear both so City and Country are geocoded.", review.invalidCoords);
    list("Pinned at the centre of the country", "add a more specific City, or Latitude and Longitude.", review.countryFallback);
    list("Remote fellows placed at the organization's address", "check the place; add Latitude and Longitude if you know better.", review.remote);
  });
  tier("3. Optional cleanup", "Nothing here is visibly wrong on the map.", () => {
    if (review.replacedLogoLinks) {
      lines.push("", `${review.replacedLogoLinks} Logo link(s) could not be downloaded, but the organization's website icon shows instead.`);
      total++;
    }
    list("Logo links with no fallback", "fix the link (a direct image URL, or a Drive file shared as Anyone with the link). These fellows show without a logo.", review.failedLogoLinks);
    list("Missing organization icons", "add a Logo link for these organizations, or check their Website.", review.failedLogos);
    list("Coordinates supplied by geocoding", "optionally verify and copy the suggested Latitude and Longitude into the row (for rows with several places, the first place).", review.suggestedCoords);
  }, true);

  if (lines.length === 1) lines.push("", "No sheet corrections were identified in this build.");
  return lines.join("\n") + "\n";
}
