import { ALL_PERIODS, type Fellow, type PeriodMeta } from "../types";
import { Search, type SearchHit } from "./Search";

const MAX_TABS = 6;

type Props = {
  /** Hide the Stanford identity bar and site title (for iframes on other Haas pages). */
  embed?: boolean;
  periods: PeriodMeta[];
  periodSlug: string;
  onPeriod: (slug: string) => void;
  fellows: Fellow[];
  onSearch: (hit: SearchHit) => void;
  onText: (text: string) => void;
};

export function Header({ embed = false, periods, periodSlug, onPeriod, fellows, onSearch, onText }: Props) {
  const tabs = [...periods.map((p) => ({ slug: p.slug, label: p.displayName }))];
  if (periods.length > 1) tabs.push({ slug: ALL_PERIODS, label: "All periods" });
  // Tabs stop scanning well past a handful; beyond that a select scales without wrapping.
  const useTabs = tabs.length <= MAX_TABS;

  return (
    <header className="relative z-20 shadow-[0_1px_3px_rgba(46,45,41,.12)]">
      {/* Stanford identity bar */}
      {!embed && (
      <div className="bg-black px-5">
        <div className="flex h-9 items-center gap-3 text-sm text-white">
          <a href="https://www.stanford.edu" className="font-serif text-[19px] font-bold leading-none tracking-tight text-white no-underline">
            Stanford
          </a>
          <span className="h-5 w-px bg-white/40" aria-hidden />
          <a href="https://haas.stanford.edu" className="text-[15px] leading-none text-white no-underline hover:underline">
            Haas Center for Public Service
          </a>
        </div>
      </div>
      )}

      {/* Site header */}
      <div className="border-b border-black-20 bg-white px-5">
        <div className={"flex flex-wrap items-end justify-between gap-x-8 gap-y-3 " + (embed ? "pt-2" : "pt-4")}>
          {!embed && (
            <div className="pb-3">
              <a href="./" className="font-serif text-[26px] font-semibold leading-none text-cardinal no-underline">
                Cardinal Quarter Fellows Map
              </a>
            </div>
          )}

          {!useTabs && (
            <label className="flex items-center gap-2 pb-3 text-[15px]">
              <span className="text-cool-grey">Period</span>
              <select
                value={periodSlug}
                onChange={(e) => onPeriod(e.target.value)}
                className="select rounded border border-black-30 bg-white px-3 py-1.5 font-semibold focus:border-digital-blue focus:outline-none focus:ring-1 focus:ring-digital-blue"
              >
                {tabs.map((t) => (
                  <option key={t.slug} value={t.slug}>{t.label}</option>
                ))}
              </select>
            </label>
          )}
          {useTabs && (
          <nav aria-label="Fellowship period" className="-mb-px flex gap-1 overflow-x-auto">
            {tabs.map((t) => {
              const active = t.slug === periodSlug;
              return (
                <button
                  key={t.slug}
                  type="button"
                  aria-current={active ? "page" : undefined}
                  onClick={() => onPeriod(t.slug)}
                  className={
                    "whitespace-nowrap border-b-[3px] px-3 pb-2.5 pt-1 text-[15px] font-semibold transition-colors " +
                    (active
                      ? "border-cardinal text-cardinal"
                      : "border-transparent text-cool-grey hover:border-black-30 hover:text-black")
                  }
                >
                  {t.label}
                </button>
              );
            })}
          </nav>
          )}

          <div className="w-full pb-3 lg:w-72">
            <Search fellows={fellows} onSelect={onSearch} onText={onText} />
          </div>
        </div>
      </div>
    </header>
  );
}
