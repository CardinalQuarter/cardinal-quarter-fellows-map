import { SEARCHABLE, type Fellow, type Filters } from "./types";

export function matchesText(f: Fellow, text: string): boolean {
  const q = text.trim().toLowerCase();
  if (!q) return true;
  return SEARCHABLE.some((col) => String(f[col] ?? "").toLowerCase().includes(q));
}

/** Apply every filter except the columns in `skip` (used for facet counts). */
export function applyFilters(
  fellows: Fellow[],
  filters: Filters,
  text: string,
  skip: Array<keyof Fellow> = [],
): Fellow[] {
  const active = (Object.entries(filters) as Array<[keyof Fellow, string[]]>).filter(
    ([col, vals]) => vals.length > 0 && !skip.includes(col),
  );
  return fellows.filter(
    (f) => matchesText(f, text) && active.every(([col, vals]) => vals.includes(String(f[col]))),
  );
}

export function toggleFilter(filters: Filters, col: keyof Fellow, value: string): Filters {
  const current = filters[col] ?? [];
  const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
  const out = { ...filters, [col]: next };
  if (next.length === 0) delete out[col];
  return out;
}

export function countFilters(filters: Filters): number {
  return Object.values(filters).reduce((n, v) => n + (v?.length ?? 0), 0);
}
