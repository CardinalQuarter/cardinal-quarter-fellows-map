import assert from "node:assert/strict";
import test from "node:test";
import { parseSources, rowsFromSource, splitCountries } from "./build-data.ts";
import { countPeople, type Fellow } from "../src/types.ts";
import { CLUSTER_PALETTE, PALETTE, UNSPECIFIED_COLOR, clusterColorIndex } from "../src/colors.ts";
import { sheetReviewSection, type SheetReview } from "./build-report.ts";

const legacyHeaders = ["Affiliation", "Fellowship/Opportunity", "Name", "Stanford Email", "Class Year", "Major", "School", "Name of Partner Organization", "Location of Fellowship (City/Town)", "Location of Fellowship (Country)", "Latitude", "Longitude", "Partner Organization Website", "Organization's Logo", "Fellowship Interest Area"];
const student = ["Haas Center", "Fellowship", "Test Student", "STUDENT@example.edu", "2027", "Biology", "Humanities & Sciences", "Partner", "Boston", "United States", "42.36", "-71.06", "https://example.org", "", "Health"];
const source = { label: 'sheet tab "Legacy Students"', defaultPeriod: "Summer 2026", load: async () => [] };

test("official Haas headers retain all student fields with a source-wide period", () => {
  const [row] = rowsFromSource([legacyHeaders, student], source);
  assert.equal(row.period, "Summer 2026");
  assert.equal(row.interest_area, "Health");
  assert.equal(row.partner_organization, "Partner");
  assert.equal(row.fellowship_loc, "Boston");
  assert.equal(row.country, "United States");
  assert.equal(row.partner_website, "https://example.org");
  assert.equal(row.latitude, "42.36");
  assert.equal(row.email, "student@example.edu");
});

test("explicit row period wins; blank period uses the source default", () => {
  const rows = rowsFromSource([[...legacyHeaders, "Period"], [...student, "Summer 2025"], [...student, ""]], source);
  assert.deepEqual(rows.map((r) => r.period), ["Summer 2025", "Summer 2026"]);
});

test("missing period fails rather than guessing from graduation year", () => {
  assert.throws(() => rowsFromSource([legacyHeaders, student], {...source,defaultPeriod:undefined}), /Default Period/);
});

test("unrecognized key columns fail and name the headers found", () => {
  const renamed = legacyHeaders.map((h) => (h === "Location of Fellowship (City/Town)" ? "What city will you work in?" : h));
  const noCoords = renamed.filter((h) => h !== "Latitude" && h !== "Longitude");
  assert.throws(() => rowsFromSource([noCoords], source), /no "city" column.*What city will you work in\?/);
  // A tab with Latitude and Longitude can place pins without a city.
  assert.deepEqual(rowsFromSource([renamed], source), []);
  const noOrg = legacyHeaders.filter((h) => h !== "Name of Partner Organization");
  assert.throws(() => rowsFromSource([noOrg], source), /no "organization" column/);
});

test("Google Form response headers map without renaming", () => {
  const form = ["Timestamp", "Email Address", "Period", "Name", "Class Year", "Major", "School", "Affiliation", "Fellowship / Opportunity", "Interest Area", "Organization", "City", "Country", "Website", "Logo (optional)"];
  const [row] = rowsFromSource([form, ["10/6/2026 9:00", "A@stanford.edu", "Summer 2027", "Ann", "2028", "CS", "Engineering", "Haas", "Fellowship", "Health", "Org", "Lima", "Peru", "org.pe", ""]], source);
  assert.equal(row.email, "a@stanford.edu");
  assert.equal(row.period, "Summer 2027");
  assert.equal(row.fellowship_loc, "Lima");
  assert.equal(row.partner_website, "https://org.pe");
});

test("current Students layout accepts blank tabs and future rows with a source default", () => {
  assert.deepEqual(rowsFromSource([legacyHeaders], {...source,label:'sheet tab "Students"'}), []);
  const [row] = rowsFromSource([legacyHeaders, student], {...source,label:'sheet tab "Students"'});
  assert.equal(row.period, "Summer 2026");
  assert.equal(row.interest_area, "Health");
});

test("Sources supports optional defaults and ignores blank rows", () => {
  assert.deepEqual(parseSources([["Tab", "Default Period"], ["Legacy Students", "Summer 2026"], ["Students", ""], ["", "Summer 2025"]]), [{tab:"Legacy Students",defaultPeriod:"Summer 2026"},{tab:"Students",defaultPeriod:undefined}]);
  assert.deepEqual(parseSources([["Tab"],["Students"]]), [{tab:"Students",defaultPeriod:undefined}]);
  assert.throws(() => parseSources([["Unrelated"],["Data"]]), /needs a "Tab" column/);
});

test("same-name students count separately while multiple pins count once", () => {
  const fellow = {name:"Shared Name",period:"Summer 2026"} as Fellow;
  assert.equal(countPeople([{...fellow,id:"summer-2026|1"},{...fellow,id:"summer-2026|2"},{...fellow,id:"summer-2026|1"}]),2);
  assert.equal(countPeople([fellow,{...fellow,period:"Summer 2025"}]),2);
});

test("compound country names stay intact in single and multi-country placements", () => {
  assert.deepEqual(splitCountries("Bosnia and Herzegovina"), ["Bosnia and Herzegovina"]);
  assert.deepEqual(splitCountries("United States and Bosnia and Herzegovina"), ["United States", "Bosnia and Herzegovina"]);
  assert.deepEqual(splitCountries("United States/Belize"), ["United States", "Belize"]);
  assert.deepEqual(splitCountries("Trinidad and Tobago"), ["Trinidad and Tobago"]);
});

test("cluster rings preserve gray for unspecified values", () => {
  assert.equal(CLUSTER_PALETTE[clusterColorIndex(UNSPECIFIED_COLOR)], UNSPECIFIED_COLOR);
  for (const color of PALETTE) assert.equal(CLUSTER_PALETTE[clusterColorIndex(color)], color);
});

test("sheet checklist includes automatic corrections and optional coordinates", () => {
  const review: SheetReview = {unknownPeriods:[],groups:[],columns:[],skipped:[],duplicates:[],swapped:[],invalidCoords:[],suggestedCoords:[],remote:[],countryFallback:[],failedGeocodes:[],failedLogoLinks:[],failedLogos:[]};
  assert.match(sheetReviewSection(review), /No sheet corrections/);
  review.swapped = ['Students line 2 (Test): reversed', 'Students line 2 (Test): reversed'];
  review.suggestedCoords = ['Students line 3 (Other): Latitude 42, Longitude -71'];
  const output = sheetReviewSection(review);
  assert.match(output, /build already swapped/);
  assert.match(output, /Latitude 42, Longitude -71/);
  assert.equal(output.match(/- \[ \] Students line 2/g)?.length, 1);
  assert.doesNotMatch(output, /No sheet corrections/);
});

test("sheet checklist caps each list and says how many were cut", () => {
  const empty: SheetReview = { unknownPeriods: [], groups: [], columns: [], skipped: [], duplicates: [], swapped: [], invalidCoords: [], suggestedCoords: [], remote: [], countryFallback: [], failedGeocodes: [], failedLogoLinks: [], failedLogos: [] };
  const text = sheetReviewSection({ ...empty, duplicates: ["a", "b", "c", "d"] }, 2);
  assert.match(text, /- \[ \] a\n- \[ \] b\n- …and 2 more/);
  assert.doesNotMatch(text, /- \[ \] c/);
});
