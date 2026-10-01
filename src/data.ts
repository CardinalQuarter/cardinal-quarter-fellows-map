import { CATEGORIES, UNSPECIFIED, type Category, type Fellow, type PeriodMeta } from "./types";

const GROUPABLE = (Object.keys(CATEGORIES) as Category[]).filter((c) => c !== "period");

const base = import.meta.env.BASE_URL.replace(/\/$/, "");

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${base}/data/${path}`);
  if (!res.ok) throw new Error(`Failed to load ${path} (${res.status})`);
  return res.json() as Promise<T>;
}

export const loadPeriods = () => getJson<PeriodMeta[]>("index.json");
export const loadFellows = async (slug: string) =>
  (await getJson<Fellow[]>(`${slug}.json`)).map((f) => {
    const out = { ...f };
    for (const c of GROUPABLE) if (!out[c]) out[c] = UNSPECIFIED;
    // Logos fetched at build time are stored under public/logos/.
    if (out.partner_logo && !/^https?:\/\//.test(out.partner_logo)) out.partner_logo = `${base}/${out.partner_logo}`;
    return out;
  });
