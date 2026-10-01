import { fellowKey, type Fellow } from "../types";
import type { Pin } from "./MapView";

type Props = {
  pins: Pin[];
  selectedKey: string | null;
  onSelect: (fellow: Fellow) => void;
};

/** Every fellow on the map as a scannable list, grouped by organization. */
export function FellowList({ pins, selectedKey, onSelect }: Props) {
  const groups = new Map<string, Pin[]>();
  for (const p of pins) {
    const key = p.fellow.partner_organization;
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  const orgs = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  if (orgs.length === 0) return null;

  return (
    <ul className="m-0 list-none p-0" aria-label="Fellows by organization">
      {orgs.map(([org, members]) => {
        const first = members[0].fellow;
        const where = [first.fellowship_loc, first.country].filter(Boolean).join(", ");
        return (
          <li key={org} className="mb-4">
            <div className="mb-1 px-2.5">
              <div className="font-semibold leading-tight text-black">{org}</div>
              {where && <div className="text-xs text-cool-grey">{where}</div>}
            </div>
            <ul className="m-0 list-none p-0">
              {members
                .slice()
                .sort((a, b) => a.fellow.name.localeCompare(b.fellow.name))
                .map((p) => {
                  const key = fellowKey(p.fellow);
                  const active = key === selectedKey;
                  return (
                    <li key={key}>
                      <button
                        type="button"
                        onClick={() => onSelect(p.fellow)}
                        aria-pressed={active}
                        className={
                          "flex w-full items-center gap-3 border-l-[3px] px-2.5 py-1 text-left text-[15px] leading-snug transition-colors " +
                          (active ? "border-cardinal bg-white" : "border-transparent hover:bg-white")
                        }
                      >
                        <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: p.color }} />
                        <span className="min-w-0 flex-1 truncate">{p.fellow.name}</span>
                        {p.fellow.class_year && (
                          <span className="shrink-0 tabular-nums text-sm text-black-60">’{p.fellow.class_year.slice(-2)}</span>
                        )}
                      </button>
                    </li>
                  );
                })}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}
