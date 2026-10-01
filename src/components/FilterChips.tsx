import { SEARCH_LABELS, type Fellow, type Filters } from "../types";

type Props = {
  filters: Filters;
  text: string;
  onRemove: (col: keyof Fellow, value: string) => void;
  onClearText: () => void;
  onClearAll: () => void;
};

export function FilterChips({ filters, text, onRemove, onClearText, onClearAll }: Props) {
  const chips = (Object.entries(filters) as Array<[keyof Fellow, string[]]>).flatMap(([col, vals]) =>
    vals.map((value) => ({ col, value })),
  );
  if (chips.length === 0 && !text) return null;

  const chipClass =
    "inline-flex max-w-full items-center gap-1.5 rounded-sm border border-black-30 bg-white py-1 pl-2.5 pr-1.5 text-sm text-black hover:border-cardinal";
  const x = (
    <span aria-hidden className="text-black-60">
      ×
    </span>
  );

  return (
    <div className="mb-5 border-b border-black-20 pb-4">
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-cool-grey">Active filters</span>
        <button type="button" className="text-sm text-digital-blue hover:underline" onClick={onClearAll}>
          Clear all
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {text && (
          <button type="button" className={chipClass} onClick={onClearText} aria-label={`Remove search “${text}”`}>
            <span className="shrink-0 text-cool-grey">Search</span>
            <span className="truncate">“{text}”</span>
            {x}
          </button>
        )}
        {chips.map(({ col, value }) => (
          <button
            key={`${col}:${value}`}
            type="button"
            className={chipClass}
            onClick={() => onRemove(col, value)}
            aria-label={`Remove ${SEARCH_LABELS[col]} ${value}`}
          >
            <span className="shrink-0 whitespace-nowrap text-cool-grey">{SEARCH_LABELS[col]}</span>
            <span className="truncate">{value}</span>
            {x}
          </button>
        ))}
      </div>
    </div>
  );
}
