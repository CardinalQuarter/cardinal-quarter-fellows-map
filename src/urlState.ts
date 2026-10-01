import { CATEGORIES, type Category, type Fellow, type Filters } from "./types";

/**
 * View state that is worth sharing in a link: period, grouping, filters, search,
 * and an open pin (a fellow's name, or an
 * organization's name when several fellows share its address).
 */
export type ViewState = {
  period: string;
  category: Category;
  filters: Filters;
  text: string;
  pin: string;
  /** Embed mode hides the Stanford chrome for use inside an iframe on another Haas page. */
  embed: boolean;
};

/** URL key for each filterable column. The Period column is "cohort" because "period" names the tab. */
const URL_KEYS: Partial<Record<keyof Fellow, string>> = {
  interest_area: "interest_area", affiliation: "affiliation", school: "school", class_year: "class_year",
  period: "cohort", name: "name", major: "major", fellowship: "fellowship",
  partner_organization: "partner_organization", country: "country", fellowship_loc: "fellowship_loc",
};
const COLUMN_FOR_KEY = new Map(Object.entries(URL_KEYS).map(([col, key]) => [key, col as keyof Fellow]));

export function readHash(): Partial<ViewState> {
  const params = new URLSearchParams(location.search);
  const out: Partial<ViewState> = {};
  const period = params.get("period");
  if (period) out.period = period;
  const category = params.get("group");
  if (category && category in CATEGORIES) out.category = category as Category;
  const text = params.get("q");
  if (text) out.text = text;
  const pin = params.get("pin");
  if (pin) out.pin = pin;
  if (params.get("embed") === "1") out.embed = true;
  const filters: Filters = {};
  for (const [key, value] of params) {
    const col = COLUMN_FOR_KEY.get(key);
    if (!col || !value) continue;
    filters[col] = value.split("|").filter(Boolean);
  }
  if (Object.keys(filters).length) out.filters = filters;
  return out;
}

export function writeHash(state: ViewState, defaultPeriod: string): void {
  const params = new URLSearchParams();
  if (state.period && state.period !== defaultPeriod) params.set("period", state.period);
  if (state.category !== "interest_area") params.set("group", state.category);
  for (const [col, vals] of Object.entries(state.filters)) {
    const key = URL_KEYS[col as keyof Fellow];
    if (key && vals?.length) params.set(key, vals.join("|"));
  }
  if (state.text) params.set("q", state.text);
  if (state.pin) params.set("pin", state.pin);
  if (state.embed) params.set("embed", "1");
  const next = params.toString();
  if (next === location.search.replace(/^\?/, "")) return;
  history.replaceState(null, "", (next ? `?${next}` : location.pathname) + location.hash);
}
