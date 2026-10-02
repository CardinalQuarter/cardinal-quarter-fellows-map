import { useLayoutEffect, useRef, useState } from "react";
import type { Fellow, ViewMeta } from "../types";
import { Search, type SearchHit } from "./Search";

type Props = {
  /** Hide the Stanford identity bar and site title (for iframes on other Haas pages). */
  embed?: boolean;
  /** Periods and groups marked Show in the sheet, in nav order. */
  tabs: ViewMeta[];
  viewSlug: string;
  onView: (slug: string) => void;
  fellows: Fellow[];
  onSearch: (hit: SearchHit) => void;
  onText: (text: string) => void;
};

const TAB_CLASS = "whitespace-nowrap border-b-[3px] px-3 pb-2.5 pt-1 text-[15px] font-semibold";

export function Header({ embed = false, tabs, viewSlug, onView, fellows, onSearch, onText }: Props) {
  // The header is one row: title, period nav, search. The nav takes what is left and
  // becomes a dropdown when its tabs would not fit, so the search box never wraps.
  const slotRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  const [fits, setFits] = useState(true);
  useLayoutEffect(() => {
    const slot = slotRef.current;
    const measure = measureRef.current;
    if (!slot || !measure) return;
    const check = () => setFits(measure.scrollWidth <= slot.clientWidth);
    check();
    const ro = new ResizeObserver(check);
    ro.observe(slot);
    return () => ro.disconnect();
  }, [tabs]);

  return (
    <header className="relative z-20 shadow-[0_1px_3px_rgba(46,45,41,.12)]">
      {/* Stanford identity bar: 30px, cardinal, as on haas.stanford.edu */}
      {!embed && (
        <div className="bg-cardinal px-5">
          <div className="flex h-[30px] items-center gap-3 text-sm text-white">
            <a href="https://www.stanford.edu" className="font-serif text-[19px] font-bold leading-none tracking-tight text-white no-underline">
              Stanford
            </a>
            <span className="h-4 w-px bg-white/40" aria-hidden />
            <a href="https://haas.stanford.edu" className="text-[14px] leading-none text-white no-underline hover:underline">
              Haas Center for Public Service
            </a>
          </div>
        </div>
      )}

      {/* Site header */}
      <div className="border-b border-black-20 bg-white px-5">
        <div className={"flex flex-wrap items-end gap-x-8 gap-y-2 lg:flex-nowrap " + (embed ? "pt-2" : "pt-4")}>
          {!embed && (
            <div className="shrink-0 pb-3">
              <a href="./" className="font-serif text-[26px] font-semibold leading-none text-cardinal no-underline">
                Cardinal Quarter Fellows Map
              </a>
            </div>
          )}

          <div ref={slotRef} className="relative order-3 min-w-0 w-full lg:order-none lg:flex-1">
            {/* Natural width of the tabs, measured against the slot; never visible. */}
            <div ref={measureRef} aria-hidden className="invisible absolute left-0 top-0 flex gap-1 whitespace-nowrap">
              {tabs.map((t) => <span key={t.slug} className={TAB_CLASS}>{t.displayName}</span>)}
            </div>

            {fits ? (
              <nav aria-label="Fellowship period" className="-mb-px flex gap-1">
                {tabs.map((t) => {
                  const active = t.slug === viewSlug;
                  return (
                    <button
                      key={t.slug}
                      type="button"
                      aria-current={active ? "page" : undefined}
                      onClick={() => onView(t.slug)}
                      className={
                        TAB_CLASS + " transition-colors " +
                        (active
                          ? "border-cardinal text-cardinal"
                          : "border-transparent text-cool-grey hover:border-black-30 hover:text-black")
                      }
                    >
                      {t.displayName}
                    </button>
                  );
                })}
              </nav>
            ) : (
              <label className="flex items-center gap-2 pb-3 text-[15px]">
                <span className="text-cool-grey">Period</span>
                <select
                  value={tabs.some((t) => t.slug === viewSlug) ? viewSlug : ""}
                  onChange={(e) => onView(e.target.value)}
                  className="select rounded border border-black-30 bg-white px-3 py-1.5 font-semibold focus:border-digital-blue focus:outline-none focus:ring-1 focus:ring-digital-blue"
                >
                  {!tabs.some((t) => t.slug === viewSlug) && <option value="">Choose a period</option>}
                  {tabs.map((t) => (
                    <option key={t.slug} value={t.slug}>{t.displayName}</option>
                  ))}
                </select>
              </label>
            )}
          </div>

          <div className="order-2 w-full shrink-0 pb-3 lg:order-none lg:w-72">
            <Search fellows={fellows} onSelect={onSearch} onText={onText} />
          </div>
        </div>
      </div>
    </header>
  );
}
