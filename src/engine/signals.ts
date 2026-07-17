import type { ShockId, SignalPack, SectorId } from "./types";
import { stateName, stateOfDistrict } from "../data/locations";
import { resolveCoord } from "../lib/geocode";
import { commodityFor } from "./commodities";

// ── District Signal Packs: cached, refreshable market/climate signals ───────
// Tier 1 of the intelligence model. Each district has a built-in baseline
// (deterministic, calibrated ranges). When online we refresh with REAL live
// data, preferring the sync server's merged feed:
//   feed_price ← Agmarknet daily mandi prices (data.gov.in, government)
//   monsoon    ← Open-Meteo 16-day rain outlook
// If the server is unreachable we fall back to a direct Open-Meteo call
// (monsoon only), then to the built-in baseline. The whole pack is cached to
// the device, so the core forecast never depends on the network.

const LS_PREFIX = "dp.signal.";
const SYNC_URL: string =
  (import.meta.env?.VITE_SYNC_URL as string | undefined) ?? "http://localhost:8787";

// Hand-calibrated packs for the four original demo districts (keeps the
// Meena/Nashik feed-price story stable).
const CURATED: Record<string, Partial<Record<ShockId, number>>> = {
  nashik: { feed_price: 1.18, monsoon: 0.92, demand: 1.05 },
  guntur: { feed_price: 1.05, monsoon: 1.1 },
  jaipur: { demand: 1.2, fuel: 1.1, monsoon: 0.85 },
  ludhiana: { feed_price: 1.1, fuel: 1.05 },
};

// Deterministic pseudo-random in [0,1) from a string - so every district gets
// stable, plausible baseline shocks without shipping 50 hand-written packs.
function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 10000) / 10000;
}

function baseShocks(districtId: string): Record<ShockId, number> {
  const curated = CURATED[districtId];
  const r = (salt: string, lo: number, hi: number) =>
    Math.round((lo + hash01(districtId + salt) * (hi - lo)) * 100) / 100;
  return {
    feed_price: curated?.feed_price ?? r("feed", 0.96, 1.16),
    monsoon: curated?.monsoon ?? r("rain", 0.88, 1.12),
    demand: curated?.demand ?? r("dem", 0.92, 1.18),
    fuel: curated?.fuel ?? r("fuel", 0.97, 1.12),
  };
}

interface CachedPack {
  shocks: Record<ShockId, number>;
  fetchedAt: number;
  sources?: string[]; // e.g. ["agmarknet:data.gov.in", "open-meteo"]
  meta?: Record<string, number>; // commodityPrice, commodityPctVsNormal, rain16dMm, tempMaxC, ...
  commodity?: string; // the tracked commodity name (e.g. "Maize", "Onion")
}

// Read the source labels of the cached pack, for the "live data" UI.
export function signalSources(districtId: string): string[] {
  return readCache(districtId)?.sources ?? [];
}
export function signalMeta(districtId: string): Record<string, number> {
  return readCache(districtId)?.meta ?? {};
}
export function signalCommodity(districtId: string): string | undefined {
  return readCache(districtId)?.commodity;
}

function readCache(districtId: string): CachedPack | null {
  try {
    const raw = localStorage.getItem(LS_PREFIX + districtId);
    return raw ? (JSON.parse(raw) as CachedPack) : null;
  } catch {
    return null;
  }
}

// Synchronous accessor used by the forecast engine: cached live pack if we
// have one, else the built-in baseline.
export function getSignalPack(districtId: string): SignalPack {
  const cached = readCache(districtId);
  return {
    districtId,
    shocks: cached?.shocks ?? baseShocks(districtId),
    fetchedAt: cached?.fetchedAt ?? null,
  };
}

// Convert a 16-day precipitation total (mm) into a monsoon multiplier.
// More rain in the outlook → stronger monsoon signal (0.85 … 1.15).
function rainToMonsoon(totalMm: number): number {
  const m = 0.88 + (Math.min(totalMm, 180) / 180) * 0.27;
  return Math.round(m * 100) / 100;
}

function writePack(districtId: string, pack: CachedPack) {
  localStorage.setItem(LS_PREFIX + districtId, JSON.stringify(pack));
}

// Preferred path: the sync server merges live Agmarknet commodity prices with
// the Open-Meteo rain outlook. Returns a partial shock set + metadata, or null.
async function fetchFromServer(
  districtId: string,
  d: { lat: number; lon: number },
  commodity: string,
  ref: number,
) {
  const st = encodeURIComponent(stateName(stateOfDistrict(districtId)));
  const url =
    `${SYNC_URL}/api/signals/${districtId}?state=${st}&lat=${d.lat}&lon=${d.lon}` +
    `&commodity=${encodeURIComponent(commodity)}&ref=${ref}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    return (await res.json()) as {
      shocks: Partial<Record<ShockId, number>>;
      meta?: { sources?: string[]; commodity?: string } & Record<string, number | string | string[]>;
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Fallback: direct Open-Meteo (monsoon only), used when the server is down.
async function fetchDirectMonsoon(d: { lat: number; lon: number }) {
  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${d.lat}&longitude=${d.lon}` +
      `&daily=precipitation_sum&forecast_days=16&timezone=auto`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const json = (await res.json()) as { daily?: { precipitation_sum?: (number | null)[] } };
    const sums = json.daily?.precipitation_sum;
    if (!sums) return null;
    const total = sums.reduce<number>((a, b) => a + (b ?? 0), 0);
    return { monsoon: rainToMonsoon(total), rainMm: Math.round(total) };
  } catch {
    return null;
  }
}

// Refresh the district's signal pack from live sources and cache it. Pass the
// enterprise's sector so the market signal tracks THAT business's commodity
// (poultry→Maize, dairy→Bajra, handicrafts→Cotton, retail→Onion, …).
// Returns true if the cache was updated. Never throws.
export async function refreshSignalPack(districtId: string, sector?: SectorId): Promise<boolean> {
  if (!navigator.onLine) return false;
  const d = await resolveCoord(districtId);
  if (!d) return false;

  const base = baseShocks(districtId);
  const { name: commodity, ref } = sector
    ? commodityFor(sector)
    : { name: "Maize", ref: 2000 };

  const server = await fetchFromServer(districtId, d, commodity, ref);
  if (server?.shocks) {
    const metaSrc = server.meta ?? {};
    const numericMeta: Record<string, number> = {};
    for (const [k, v] of Object.entries(metaSrc)) if (typeof v === "number") numericMeta[k] = v;
    writePack(districtId, {
      shocks: { ...base, ...server.shocks },
      fetchedAt: Date.now(),
      sources: (metaSrc.sources as string[]) ?? [],
      meta: numericMeta,
      commodity: typeof metaSrc.commodity === "string" ? metaSrc.commodity : commodity,
    });
    return true;
  }

  const direct = await fetchDirectMonsoon(d);
  if (direct) {
    writePack(districtId, {
      shocks: { ...base, monsoon: direct.monsoon },
      fetchedAt: Date.now(),
      sources: ["open-meteo"],
      meta: { rain16dMm: direct.rainMm },
    });
    return true;
  }
  return false;
}
