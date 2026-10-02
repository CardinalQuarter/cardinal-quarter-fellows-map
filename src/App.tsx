import { useEffect, useMemo, useRef, useState } from "react";
import { Header } from "./components/Header";
import { Legend } from "./components/Legend";
import { FilterChips } from "./components/FilterChips";
import { MapView, type Pin, type Selection } from "./components/MapView";
import { colorMap } from "./colors";
import { loadFellows, loadIndex } from "./data";
import { applyFilters, toggleFilter } from "./filter";
import { countPeople, sameSpot, type Category, type Fellow, type Filters, type Index, type ViewMeta } from "./types";
import { readHash, writeHash } from "./urlState";

const EMPTY_INDEX: Index = { periods: [], views: [] };

export default function App() {
  const initial = useRef(readHash());
  const [index, setIndex] = useState<Index>(EMPTY_INDEX);
  const [viewSlug, setViewSlug] = useState<string>("");
  const [fellows, setFellows] = useState<Fellow[] | null>(null);
  const [category, setCategory] = useState<Category>(initial.current.category ?? "interest_area");
  const [filters, setFilters] = useState<Filters>(initial.current.filters ?? {});
  const [text, setText] = useState(initial.current.text ?? "");
  const [selection, setSelection] = useState<Selection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const embed = initial.current.embed ?? false;

  const { periods, views } = index;
  // Tabs show only views marked Show in the sheet; a link may still open a hidden one.
  const tabs = useMemo(() => views.filter((v) => v.show), [views]);
  const defaultSlug = tabs[0]?.slug ?? "";
  const view: ViewMeta | undefined = views.find((v) => v.slug === viewSlug);
  const multi = (view?.periods.length ?? 0) > 1;

  useEffect(() => {
    loadIndex()
      .then((idx) => {
        setIndex(idx);
        const wanted = initial.current.period;
        const valid = idx.views.some((v) => v.slug === wanted);
        setViewSlug(valid && wanted ? wanted : (idx.views.find((v) => v.show)?.slug ?? ""));
      })
      .catch((e) => setError(String(e)));
  }, []);

  // Load the view's period(s). Filters persist across views so years can be compared;
  // only a Period filter is dropped when entering a single-period view, where it has no meaning.
  useEffect(() => {
    if (!view) return;
    if (view.periods.length === 1) {
      setFilters((f) => {
        if (!f.period) return f;
        const next = { ...f };
        delete next.period;
        return next;
      });
      setCategory((c) => (c === "period" ? "interest_area" : c));
    }
    const wanted = view.periods.map((slug) => periods.find((p) => p.slug === slug)).filter((p) => p !== undefined);
    let cancelled = false;
    Promise.all(
      wanted.map((p) => loadFellows(p.slug).then((rows) => rows.map((f) => ({ ...f, period: p.displayName })))),
    )
      .then((lists) => {
        if (cancelled) return;
        const rows = lists.flat();
        setFellows(rows);
        // A shared link can open straight onto a fellow (by name) or an organization.
        const pin = initial.current.pin;
        if (pin) {
          initial.current.pin = undefined;
          const hit = rows.find((f) => f.name === pin) ?? rows.find((f) => f.partner_organization === pin);
          if (hit) setSelection({ fellow: hit, fly: true });
        }
      })
      .catch((e) => setError(String(e)));
    return () => { cancelled = true; };
  }, [view, periods]);

  // Grouping by Period only makes sense across periods, so choosing it in a
  // single-period view switches to the widest view available (a visible one if possible).
  const widest = useMemo(() => {
    const pick = (list: ViewMeta[]) => list.reduce<ViewMeta | undefined>((best, v) => (v.periods.length > (best?.periods.length ?? 1) ? v : best), undefined);
    return pick(tabs) ?? pick(views);
  }, [tabs, views]);
  const chooseCategory = (c: Category) => {
    setCategory(c);
    if (c === "period" && !multi && widest) setViewSlug(widest.slug);
  };

  const loaded = fellows ?? [];
  const visible = useMemo(() => applyFilters(loaded, filters, text), [loaded, filters, text]);

  // The URL names the open pin by fellow when alone at the spot, else by organization.
  const pinParam = useMemo(() => {
    if (!selection) return "";
    const here = visible.filter((f) => sameSpot(f, selection.fellow));
    return here.length === 1 ? selection.fellow.name : selection.fellow.partner_organization;
  }, [selection, visible]);

  useEffect(() => {
    if (!viewSlug) return;
    writeHash({ period: viewSlug, category, filters, text, pin: pinParam, embed }, defaultSlug);
  }, [viewSlug, category, filters, text, pinParam, embed, defaultSlug]);

  // Colors cover every value of the category in the view, so they stay stable while filtering.
  const colors = useMemo(() => colorMap(loaded.map((f) => f[category])), [loaded, category]);

  // Facet counts ignore this category's own filter so users can see what adding a value would give.
  const entries = useMemo(() => {
    const facet = applyFilters(loaded, filters, text, [category]);
    const counts = new Map<string, number>();
    for (const f of facet) counts.set(f[category], (counts.get(f[category]) ?? 0) + 1);
    const list = [...colors.entries()].map(([label, color]) => ({ label, color, count: counts.get(label) ?? 0 }));
    // Periods keep their configured order (most recent first) rather than alphabetical.
    if (category === "period") {
      const rank = new Map(periods.map((p, i) => [p.displayName, i]));
      list.sort((a, b) => (rank.get(a.label) ?? 0) - (rank.get(b.label) ?? 0));
    }
    return list;
  }, [loaded, filters, text, category, colors, periods]);

  const pins: Pin[] = useMemo(
    () => visible.map((f) => ({ fellow: f, color: colors.get(f[category]) ?? "#000" })),
    [visible, colors, category],
  );

  // A fellow with several places has one pin per place; count people, not pins.
  const stats = useMemo(
    () => ({
      shown: countPeople(visible),
      total: countPeople(loaded),
      organizations: new Set(visible.map((f) => f.partner_organization)).size,
      countries: new Set(visible.filter((f) => f.country).map((f) => f.country)).size,
    }),
    [visible],
  );

  // Any change to what is on the map closes the open pin, so a popup never describes a hidden fellow.
  const changeFilters = (fn: (f: Filters) => Filters) => { setSelection(null); setFilters(fn); };
  const changeText = (t: string) => { setSelection(null); setText(t); };
  const changeView = (slug: string) => { setSelection(null); setViewSlug(slug); };
  const clearAll = () => { setSelection(null); setFilters({}); setText(""); };

  if (error) {
    return <p className="p-6 text-digital-red">The fellow data could not be loaded. {error}</p>;
  }

  return (
    <div className="flex h-full flex-col">
      <Header
        embed={embed}
        tabs={tabs}
        viewSlug={viewSlug}
        onView={changeView}
        fellows={loaded}
        onSearch={(hit) => changeFilters((f) => toggleFilter(f, hit.column, hit.value))}
        onText={changeText}
      />
      <main className="flex min-h-0 flex-1 flex-col-reverse lg:flex-row">
        <Legend
          title={view?.displayName ?? ""}
          loading={fellows === null}
          shown={stats.shown}
          total={stats.total}
          organizations={stats.organizations}
          countries={stats.countries}
          category={category}
          canGroupByPeriod={widest !== undefined}
          onCategory={chooseCategory}
          entries={entries}
          selected={filters[category] ?? []}
          onToggle={(label) => changeFilters((f) => toggleFilter(f, category, label))}
          onClearAll={clearAll}
        >
          <FilterChips
            filters={filters}
            text={text}
            onRemove={(col, value) => changeFilters((f) => toggleFilter(f, col, value))}
            onClearText={() => changeText("")}
            onClearAll={clearAll}
          />
        </Legend>
        <MapView pins={pins} selection={selection} onSelect={setSelection} />
      </main>
    </div>
  );
}
