export type SheetReview = {
  unknownPeriods: string[]; groups: string[]; columns: string[];
  skipped: string[]; duplicates: string[]; swapped: string[];
  invalidCoords: string[]; suggestedCoords: string[]; remote: string[];
  countryFallback: string[]; failedGeocodes: string[];
  failedLogoLinks: string[]; failedLogos: string[];
};

/** Keep input issues visible even when caches or fallbacks fix the map. `limit` caps each list. */
export function sheetReviewSection(review: SheetReview, limit = Infinity): string {
  const lines = ["### Things to address in the sheet", "", "Review these sheet edits, including issues the build corrected automatically. They remain until the input is corrected. Row references are CSV line numbers; use the student name to locate the row if the sheet has blank rows."];
  const group = (title: string, action: string, items: string[]) => {
    if (!items.length) return;
    lines.push("", `#### ${title}`, "", action, "");
    const unique = [...new Set(items)];
    for (const item of unique.slice(0, limit)) lines.push(`- [ ] ${item.replace(/\r?\n/g, " ")}`);
    if (unique.length > limit) lines.push(`- …and ${unique.length - limit} more (see the full build report)`);
  };
  group("Periods", "Correct each row's Period or its source's Default Period, and list the period in Periods.", review.unknownPeriods);
  group("Groups", "Correct group members or remove unused example group rows.", review.groups);
  group("Headers", "Correct unrecognized headers or supply missing columns where applicable. Extra columns may be intentional.", review.columns);
  group("Skipped students", "Supply a usable City and Country or valid Latitude and Longitude so these rows can publish.", review.skipped);
  group("Duplicate students", "Review these rows and keep the intended record. Later sources and rows win for the same email and period.", review.duplicates);
  group("Reversed coordinates", "Swap the Latitude and Longitude cells in the sheet; the build already swapped them for the map.", review.swapped);
  group("Incomplete or invalid coordinates", "Correct both coordinate cells, or clear both to geocode City and Country. The map may already use a corrected fallback.", review.invalidCoords);
  group("Coordinates supplied by geocoding", "Optionally verify these locations and copy the suggested Latitude and Longitude into the row. For rows with multiple places, the override applies only to the first place.", review.suggestedCoords);
  group("Remote placements", "Verify the organization's inferred location; supply Latitude and Longitude if a more precise placement is known.", review.remote);
  group("Country-centre placements", "Supply a more specific City or valid Latitude and Longitude to replace the approximate pin.", review.countryFallback);
  group("Unresolved locations", "Correct City and Country or provide valid Latitude and Longitude.", review.failedGeocodes);
  group("Logo links", "Correct Logo or share the linked image/upload folder as Anyone with the link. A website icon may already be substituting for it.", review.failedLogoLinks);
  group("Missing organization icons", "Provide a direct image URL or shared Google Drive image link in Logo; verify Website.", review.failedLogos);
  if (lines.length === 3) lines.push("", "No sheet corrections were identified in this build.");
  return lines.join("\n") + "\n";
}
