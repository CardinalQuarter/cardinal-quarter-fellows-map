import { UNSPECIFIED } from "./types";

/**
 * Category colors. Values are sorted and assigned in order from a palette of
 * well-separated hues, so the legend for any one view is maximally distinct and
 * the same set of values always gets the same colors. (The old site stored
 * random RGB per upload, so "Health" changed color between periods.)
 */
export const PALETTE = [
  "#8c1515", // cardinal
  "#0f7ba6", // blue
  "#e98300", // orange
  "#2e8b57", // green
  "#6a3d9a", // purple
  "#c0392b", // red
  "#007c92", // teal
  "#b58900", // gold
  "#d6559a", // pink
  "#5d4b3c", // brown
  "#1f5fbf", // royal blue
  "#4d8c2b", // olive green
  "#e04e39", // coral
  "#53284f", // plum
  "#279989", // aquamarine
  "#7a6f2b", // khaki
  "#2d5f9a", // slate blue
  "#a6317a", // magenta
  "#8f993e", // moss
  "#d35400", // burnt orange
];

const UNSPECIFIED_COLOR = "#9a9a9a";

export function colorMap(values: string[]): Map<string, string> {
  const sorted = [...new Set(values)].filter((v) => v !== UNSPECIFIED).sort((a, b) => a.localeCompare(b));
  const out = new Map<string, string>();
  sorted.forEach((v, i) => out.set(v, PALETTE[i % PALETTE.length]));
  if (values.includes(UNSPECIFIED)) out.set(UNSPECIFIED, UNSPECIFIED_COLOR);
  return out;
}
