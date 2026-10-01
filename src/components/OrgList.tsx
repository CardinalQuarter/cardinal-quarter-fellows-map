import type { Fellow } from "../types";
import type { Pin } from "./MapView";

type Props = {
  pins: Pin[];
  /** Organization of the open pin, if any. */
  selectedOrg: string | null;
  onSelect: (fellow: Fellow) => void;
};

/**
 * Every partner organization on the map with its location and how many fellows
 * are there. Names stay in the popup: the site is about where fellows serve,
 * not a roster of students.
 */
export function OrgList({ pins, selectedOrg, onSelect }: Props) {
  const groups = new Map<string, Pin[]>();
  for (const p of pins) {
    const key = p.fellow.partner_organization;
    groups.set(key, [...(groups.get(key) ?? []), p]);
  }
  const orgs = [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  if (orgs.length === 0) return null;

  return (
    <ul className="m-0 list-none p-0" aria-label="Partner organizations">
      {orgs.map(([org, members]) => {
        const first = members[0].fellow;
        const where = [first.fellowship_loc, first.country].filter(Boolean).join(", ");
        const active = org === selectedOrg;
        return (
          <li key={org}>
            <button
              type="button"
              onClick={() => onSelect(first)}
              aria-pressed={active}
              className={
                "flex w-full items-start gap-3 border-l-[3px] px-2.5 py-2 text-left leading-snug transition-colors " +
                (active ? "border-cardinal bg-white" : "border-transparent hover:bg-white")
              }
            >
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-black">{org}</span>
                {where && <span className="block text-xs text-cool-grey">{where}</span>}
              </span>
              <span className="shrink-0 tabular-nums text-sm text-black-60" aria-label={`${members.length} fellows`}>
                {members.length}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
