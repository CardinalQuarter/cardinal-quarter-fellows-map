import { useEffect, useMemo, useRef, useState } from "react";
import { Header } from "./components/Header";
import { Legend } from "./components/Legend";
import { FilterChips } from "./components/FilterChips";
import { MapView, type Pin } from "./components/MapView";
import { colorMap } from "./colors";
import { loadFellows, loadPeriods } from "./data";
import { applyFilters, toggleFilter } from "./filter";
import { ALL_PERIODS, type Category, type Fellow, type Filters, type PeriodMeta } from "./types";
import { readHash, writeHash } from "./urlState";

export default function App() {
  const initial = useRef(readHash());
  const [periods, setPeriods] = useState<PeriodMeta[]>([]);
  const [periodSlug, setPeriodSlug] = useState<string>("");
  const [fellows, setFellows] = useState<Fellow[] | null>(null);
  const [category, setCategory] = useState<Category>(initial.current.category ?? "interest_area");
  const [filters, setFilters] = useState<Filters>(initial.current.filters ?? {});
  const [text, setText] = useState(initial.current.text ?? "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPeriods()
      .then((list) => {
        setPeriods(list);
        const wanted = initial.current.period;
        const valid = wanted === ALL_PERIODS || list.some((p) => p.slug === wanted);
        setPeriodSlug(valid && wanted ? wanted : (list[0]?.slug ?? ""));
      })
      .catch((e) => setError(String(e)));
  }, []);

  // Load the selected period(s). Filters persist across periods so years can be compared;
  // only a Period filter is dropped when leaving "All periods", where it has no meaning.
  useEffect(() => {
    if (!periodSlug) return;
    const all = periodSlug === ALL_PERIODS;
    if (!all) {
      setFilters((f) => {
        if (!f.period) return f;
        const next = { ...f };
        delete next.period;
        return next;
      });
      setCategory((c) => (c === "period" ? "interest_area" : c));
    }
    const wanted = all ? periods : periods.filter((p) => p.slug === periodSlug);
    let cancelled = false;
    Promise.all(
      wanted.map((p) => loadFellows(p.slug).then((rows) => rows.map((f) => ({ ...f, period: p.displayName })))),
    )
      .then((lists) => { if (!cancelled) setFellows(lists.flat()); })
      .catch((e) => setError(String(e)));
    return () => { cancelled = true; };
  }, [periodSlug, periods]);

  // Grouping by Period only makes sense across periods, so choosing it switches to All periods.
  const chooseCategory = (c: Category) => {
    setCategory(c);
    if (c === "period" && periodSlug !== ALL_PERIODS) setPeriodSlug(ALL_PERIODS);
  };

  useEffect(() => {
    if (!periodSlug) return;
    writeHash({ period: periodSlug, category, filters, text }, periods[0]?.slug ?? "");
  }, [periodSlug, category, filters, text, periods]);

  const loaded = fellows ?? [];
  const visible = useMemo(() => applyFilters(loaded, filters, text), [loaded, filters, text]);

  // Colors cover every value of the category in the period, so they stay stable while filtering.
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

  const title =
    periodSlug === ALL_PERIODS ? "All periods" : (periods.find((p) => p.slug === periodSlug)?.displayName ?? "");

  const clearAll = () => {
    setFilters({});
    setText("");
  };

  if (error) {
    return <p className="p-6 text-digital-red">The fellow data could not be loaded. {error}</p>;
  }

  return (
    <div className="flex h-full flex-col">
      <Header
        periods={periods}
        periodSlug={periodSlug}
        onPeriod={setPeriodSlug}
        fellows={loaded}
        onSearch={(hit) => setFilters((f) => toggleFilter(f, hit.column, hit.value))}
        onText={setText}
      />
      <main className="flex min-h-0 flex-1 flex-col-reverse lg:flex-row">
        <Legend
          title={title}
          loading={fellows === null}
          shown={visible.length}
          total={loaded.length}
          category={category}
          canGroupByPeriod={periods.length > 1}
          onCategory={chooseCategory}
          entries={entries}
          selected={filters[category] ?? []}
          onToggle={(label) => setFilters((f) => toggleFilter(f, category, label))}
          onClearAll={clearAll}
        >
          <FilterChips
            filters={filters}
            text={text}
            onRemove={(col, value) => setFilters((f) => toggleFilter(f, col, value))}
            onClearText={() => setText("")}
            onClearAll={clearAll}
          />
        </Legend>
        <MapView pins={pins} />
      </main>
    </div>
  );
}
