import { useEffect, useMemo, useRef, useState } from "react";
import { SEARCHABLE, SEARCH_LABELS, type Fellow } from "../types";

export type SearchHit = { column: keyof Fellow; value: string };

type Props = {
  fellows: Fellow[];
  onSelect: (hit: SearchHit) => void;
  onText: (text: string) => void;
};

/** Autocomplete over every distinct value; Enter applies free text instead. */
export function Search({ fellows, onSelect, onText }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(-1);
  const wrap = useRef<HTMLDivElement>(null);

  const candidates = useMemo(() => {
    const out: SearchHit[] = [];
    const seen = new Set<string>();
    for (const f of fellows) {
      for (const column of SEARCHABLE) {
        const value = String(f[column] ?? "");
        const key = `${column}\u0000${value}`;
        if (value && !seen.has(key)) {
          seen.add(key);
          out.push({ column, value });
        }
      }
    }
    return out;
  }, [fellows]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return candidates
      .filter((c) => c.value.toLowerCase().includes(q))
      .sort((a, b) => {
        const as = a.value.toLowerCase().startsWith(q) ? 0 : 1;
        const bs = b.value.toLowerCase().startsWith(q) ? 0 : 1;
        return as - bs || a.value.localeCompare(b.value);
      })
      .slice(0, 30);
  }, [candidates, query]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const choose = (hit: SearchHit) => {
    setQuery("");
    setOpen(false);
    setCursor(-1);
    onSelect(hit);
  };

  return (
    <div ref={wrap} className="relative">
      <input
        type="search"
        aria-label="Search"
        placeholder="Search"
        className="w-full rounded border border-black-30 bg-white px-3 py-1.5 text-[15px] placeholder:text-black-60 focus:border-digital-blue focus:outline-none focus:ring-1 focus:ring-digital-blue"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setCursor(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setCursor((c) => Math.min(c + 1, matches.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setCursor((c) => Math.max(c - 1, -1));
          } else if (e.key === "Enter") {
            e.preventDefault();
            if (cursor >= 0 && matches[cursor]) choose(matches[cursor]);
            else if (query.trim()) {
              onText(query.trim());
              setQuery("");
              setOpen(false);
            }
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {open && query.trim() && (
        <ul className="absolute right-0 z-[1002] mt-1 max-h-96 w-full min-w-80 list-none overflow-y-auto rounded border border-black-20 bg-white p-1 shadow-[0_4px_16px_rgba(46,45,41,.18)]">
          {matches.map((m, i) => (
            <li key={`${m.column}:${m.value}`}>
              <button
                type="button"
                className={
                  "flex w-full items-baseline justify-between gap-3 rounded-sm px-2.5 py-1.5 text-left text-[15px] hover:bg-fog-light " +
                  (i === cursor ? "bg-fog-light" : "")
                }
                onMouseEnter={() => setCursor(i)}
                onClick={() => choose(m)}
              >
                <span>{m.value}</span>
                <span className="shrink-0 text-xs uppercase tracking-wider text-cool-grey">{SEARCH_LABELS[m.column]}</span>
              </button>
            </li>
          ))}
          <li className={matches.length ? "mt-1 border-t border-black-20" : ""}>
            <button
              type="button"
              className="flex w-full items-baseline justify-between gap-3 rounded-sm px-2.5 py-1.5 text-left text-[15px] hover:bg-fog-light"
              onClick={() => { onText(query.trim()); setQuery(""); setOpen(false); }}
            >
              <span>“{query.trim()}”</span>
              <span className="shrink-0 text-xs uppercase tracking-wider text-cool-grey">All fields</span>
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
