import type { Fellow, PeriodMeta } from "./types";

const base = import.meta.env.BASE_URL.replace(/\/$/, "");

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${base}/data/${path}`);
  if (!res.ok) throw new Error(`Failed to load ${path} (${res.status})`);
  return res.json() as Promise<T>;
}

export const loadPeriods = () => getJson<PeriodMeta[]>("index.json");
export const loadFellows = async (slug: string) =>
  (await getJson<Fellow[]>(`${slug}.json`)).map((f) => ({
    ...f,
    // Logos fetched at build time are stored under public/logos/.
    partner_logo: f.partner_logo && !/^https?:\/\//.test(f.partner_logo) ? `${base}/${f.partner_logo}` : f.partner_logo,
  }));
