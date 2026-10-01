export type Fellow = {
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
  /** Display name of the period this row came from (set client-side). */
  period: string;
};

export type PeriodMeta = { slug: string; displayName: string; count: number };

/** The four legend groupings from the nav bar. */
export const CATEGORIES = {
  interest_area: "Interest Area",
  affiliation: "Affiliation",
  school: "School",
  class_year: "Class Year",
  country: "Country",
  partner_organization: "Partner Organization",
  period: "Period",
} as const;

export type Category = keyof typeof CATEGORIES;

/** Columns the search box matches against. */
export const SEARCHABLE: Array<keyof Fellow> = [
  "name",
  "major",
  "class_year",
  "school",
  "fellowship",
  "partner_organization",
  "country",
  "affiliation",
  "fellowship_loc",
  "interest_area",
  "period",
];

export const SEARCH_LABELS: Partial<Record<keyof Fellow, string>> = {
  name: "Name",
  major: "Major",
  class_year: "Class Year",
  school: "School",
  fellowship: "Fellowship",
  partner_organization: "Partner",
  country: "Country",
  affiliation: "Affiliation",
  fellowship_loc: "Location",
  interest_area: "Interest Area",
  period: "Period",
};

/** Active filters: OR within a column, AND across columns. */
export type Filters = Partial<Record<keyof Fellow, string[]>>;

export const ALL_PERIODS = "all";

/** Fellows at exactly the same coordinates as `f` (the same org address, usually). */
export const sameSpot = (a: Fellow, b: Fellow) =>
  Math.abs(a.latitude - b.latitude) < 1e-6 && Math.abs(a.longitude - b.longitude) < 1e-6;

/** Shown for a blank value in any grouping column so it can still be filtered on. */
export const UNSPECIFIED = "Not specified";
