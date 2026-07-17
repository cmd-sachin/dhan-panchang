import { getDistrict, districtName } from "@/data/locations";

// ── District → coordinates, resolved on demand ───────────────────────────────
// Built-in coords (a few common districts) win first, then a localStorage
// cache, then the free Open-Meteo geocoding API. Cached forever per district.
// Never throws; returns null when offline with no cache.

const LS = "dp.coord.";

export interface Coord {
  lat: number;
  lon: number;
}

export function cachedCoord(districtId: string): Coord | null {
  const d = getDistrict(districtId);
  if (d?.lat != null && d?.lon != null) return { lat: d.lat, lon: d.lon };
  try {
    const raw = localStorage.getItem(LS + districtId);
    return raw ? (JSON.parse(raw) as Coord) : null;
  } catch {
    return null;
  }
}

export async function resolveCoord(districtId: string): Promise<Coord | null> {
  const hit = cachedCoord(districtId);
  if (hit) return hit;
  if (!navigator.onLine) return null;
  try {
    const name = districtName(districtId);
    const url =
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}` +
      `&count=1&country=IN&language=en&format=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const json = (await res.json()) as { results?: { latitude: number; longitude: number }[] };
    const r = json.results?.[0];
    if (!r) return null;
    const coord: Coord = { lat: r.latitude, lon: r.longitude };
    localStorage.setItem(LS + districtId, JSON.stringify(coord));
    return coord;
  } catch {
    return null;
  }
}
