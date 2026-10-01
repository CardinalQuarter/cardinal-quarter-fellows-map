import { CATEGORIES, type Category } from "../types";

type Entry = { label: string; color: string; count: number };

type Props = {
  title: string;
  loading: boolean;
  shown: number;
  total: number;
  category: Category;
  canGroupByPeriod: boolean;
  onCategory: (c: Category) => void;
  entries: Entry[];
  selected: string[];
  onToggle: (label: string) => void;
  onClearAll: () => void;
  children?: React.ReactNode;
};

export function Legend({
  title, loading, shown, total, category, canGroupByPeriod, onCategory, entries, selected, onToggle, onClearAll, children,
}: Props) {
  const categories = (Object.keys(CATEGORIES) as Category[]).filter((c) => c !== "period" || canGroupByPeriod);
  return (
    <aside className="z-10 h-2/5 w-full overflow-y-auto border-r border-black-20 bg-fog-light lg:h-full lg:w-[340px] lg:shrink-0">
      <div className="px-5 py-5">
        <h1 className="m-0 font-serif text-[28px] font-semibold leading-tight text-black">{title}</h1>
        <p className="mb-5 mt-1 text-[15px] text-cool-grey" aria-live="polite">
          {loading ? "\u00a0" : shown === total ? `${total} fellows` : `${shown} of ${total} fellows`}
        </p>

        {children}

        <div className="mb-3">
          <label htmlFor="category" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-cool-grey">
            Group by
          </label>
          <select
            id="category"
            value={category}
            onChange={(e) => onCategory(e.target.value as Category)}
            className="select w-full rounded border border-black-30 bg-white px-3 py-2 text-[15px] focus:border-digital-blue focus:outline-none focus:ring-1 focus:ring-digital-blue"
          >
            {categories.map((c) => (
              <option key={c} value={c}>{CATEGORIES[c]}</option>
            ))}
          </select>
        </div>

        {!loading && shown === 0 && (
          <p className="mb-3 rounded border border-black-20 bg-white px-3 py-2 text-sm text-cool-grey">
            No fellows match these filters.{" "}
            <button type="button" className="text-digital-blue hover:underline" onClick={onClearAll}>
              Clear all
            </button>
          </p>
        )}

        <ul className="m-0 list-none p-0" aria-label={`Filter by ${CATEGORIES[category]}`}>
          {entries.map((e) => {
            const active = selected.includes(e.label);
            const dimmed = (selected.length > 0 && !active) || e.count === 0;
            return (
              <li key={e.label}>
                <button
                  type="button"
                  onClick={() => onToggle(e.label)}
                  aria-pressed={active}
                  className={
                    "flex w-full items-center gap-3 border-l-[3px] px-2.5 py-1.5 text-left text-[15px] leading-snug transition-colors " +
                    (active ? "border-cardinal bg-white" : "border-transparent hover:bg-white") +
                    (dimmed ? " text-black-60" : " text-black")
                  }
                >
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: e.color, opacity: dimmed ? 0.45 : 1 }}
                  />
                  <span className="min-w-0 flex-1">{e.label}</span>
                  <span className="tabular-nums text-sm text-black-60">{e.count}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
