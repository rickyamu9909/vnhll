import { placeFromText } from "./places";

export type Coord = { lat: number; lng: number };

const geocodeCache = new Map<string, Coord | null>();

export const MATCH_RADIUS_KM = 5;

export type MatchBasis = "DEST" | "PICKUP";

export function haversineKm(a: Coord, b: Coord) {
  const radius = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function matchPair(
  order: { origin?: Coord | null; dest?: Coord | null },
  capacity: { location?: Coord | null; dest?: Coord | null }
): { km: number; basis: MatchBasis } | null {
  if (capacity.dest && order.dest) {
    const km = haversineKm(order.dest, capacity.dest);
    return km <= MATCH_RADIUS_KM ? { km, basis: "DEST" } : null;
  }
  if (!capacity.dest && capacity.location && order.origin) {
    const km = haversineKm(order.origin, capacity.location);
    return km <= MATCH_RADIUS_KM ? { km, basis: "PICKUP" } : null;
  }
  return null;
}

export async function geocode(query: string): Promise<Coord | null> {
  const text = query.replace(/\s+/g, " ").trim();
  if (text.length < 2) return null;
  const known = placeFromText(text);
  if (known?.lat != null && known.lng != null) return { lat: known.lat, lng: known.lng };
  if (geocodeCache.has(text)) return geocodeCache.get(text) || null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 2500);
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=vn&q=${encodeURIComponent(`${text}, Vietnam`)}`;
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "ANTS-Vietnam-Freight/1.0 (address-match)",
        Accept: "application/json",
      },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ lat?: string; lon?: string }>;
    const hit = data[0];
    const lat = Number(hit?.lat);
    const lng = Number(hit?.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      geocodeCache.set(text, null);
      return null;
    }
    const coord = { lat, lng };
    geocodeCache.set(text, coord);
    return coord;
  } catch {
    geocodeCache.set(text, null);
    return null;
  } finally {
    clearTimeout(timer);
  }
}
