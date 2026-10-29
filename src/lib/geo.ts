import { placeFromText } from "./places";

export type Coord = { lat: number; lng: number };

const geocodeCache = new Map<string, Coord | null>();
const searchCache = new Map<string, PlaceHit[]>();
const routeCache = new Map<string, RouteEstimate | null>();

/** @deprecated 5km 圆已退出主匹配；保留常量仅兼容旧测试/数据 */
export const MATCH_RADIUS_KM = 5;

export type MatchBasis = "DEST" | "PICKUP" | "ROUTE";

export type PlaceHit = {
  label: string;
  lat: number;
  lng: number;
  province?: string;
  ward?: string;
  address?: string;
};

export type RouteEstimate = {
  distanceKm: number;
  durationMin: number;
  source: "osrm" | "straight";
  /** [lat, lng][] 道路导航折线；直线降级时为起终点两点 */
  coordinates?: Array<[number, number]>;
};

const polylineCache = new Map<string, Array<[number, number]> | null>();

export function haversineKm(a: Coord, b: Coord) {
  const radius = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * radius * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** 旧 5km 硬过滤，主流程勿再用；测试兼容保留 */
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

async function nominatimFetch(pathAndQuery: string) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 3500);
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org${pathAndQuery}`, {
      signal: ctrl.signal,
      headers: {
        "User-Agent": "ANTS-Vietnam-Freight/1.0 (address-assist)",
        Accept: "application/json",
      },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function searchPlaces(query: string, limit = 6): Promise<PlaceHit[]> {
  const text = query.replace(/\s+/g, " ").trim();
  if (text.length < 2) return [];
  const key = `${text}|${limit}`;
  if (searchCache.has(key)) return searchCache.get(key) || [];
  const data = (await nominatimFetch(
    `/search?format=jsonv2&addressdetails=1&limit=${limit}&countrycodes=vn&q=${encodeURIComponent(`${text}, Vietnam`)}`
  )) as Array<{
    display_name?: string;
    lat?: string;
    lon?: string;
    address?: Record<string, string>;
  }> | null;
  if (!data?.length) {
    searchCache.set(key, []);
    return [];
  }
  const hits: PlaceHit[] = data
    .map((row) => {
      const lat = Number(row.lat);
      const lng = Number(row.lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      const addr = row.address || {};
      const province = addr.state || addr.city || addr.province || "";
      const ward = addr.suburb || addr.quarter || addr.village || addr.town || addr.city_district || "";
      const road = [addr.house_number, addr.road].filter(Boolean).join(" ");
      return {
        label: row.display_name || text,
        lat,
        lng,
        province: province || undefined,
        ward: ward || undefined,
        address: road || row.display_name || text,
      };
    })
    .filter(Boolean) as PlaceHit[];
  searchCache.set(key, hits);
  return hits;
}

export async function geocode(query: string): Promise<Coord | null> {
  const text = query.replace(/\s+/g, " ").trim();
  if (text.length < 2) return null;
  const known = placeFromText(text);
  if (known?.lat != null && known.lng != null) return { lat: known.lat, lng: known.lng };
  if (geocodeCache.has(text)) return geocodeCache.get(text) || null;
  const hits = await searchPlaces(text, 1);
  const coord = hits[0] ? { lat: hits[0].lat, lng: hits[0].lng } : null;
  geocodeCache.set(text, coord);
  return coord;
}

/** 服务端向 OSRM 拉完整道路折线（供轨迹地图画真导航线） */
export async function routePolyline(origin: Coord, dest: Coord): Promise<Array<[number, number]> | null> {
  const key = `${origin.lat.toFixed(5)},${origin.lng.toFixed(5)}>${dest.lat.toFixed(5)},${dest.lng.toFixed(5)}`;
  if (polylineCache.has(key)) return polylineCache.get(key) || null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${dest.lng},${dest.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
    if (!res.ok) {
      polylineCache.set(key, null);
      return null;
    }
    const data = (await res.json()) as {
      routes?: Array<{ geometry?: { coordinates?: Array<[number, number]> } }>;
    };
    const raw = data.routes?.[0]?.geometry?.coordinates;
    if (!raw?.length) {
      polylineCache.set(key, null);
      return null;
    }
    const line = raw.map(([lng, lat]) => [lat, lng] as [number, number]);
    polylineCache.set(key, line);
    return line;
  } catch {
    polylineCache.set(key, null);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function routeEstimate(origin: Coord, dest: Coord): Promise<RouteEstimate> {
  const key = `${origin.lat.toFixed(5)},${origin.lng.toFixed(5)}>${dest.lat.toFixed(5)},${dest.lng.toFixed(5)}`;
  if (routeCache.has(key)) return routeCache.get(key)!;
  const straightKm = haversineKm(origin, dest);
  // 越南城际/市区拖车平均更慢，直线降级按约 28km/h，不用中国高速假设
  const fallback: RouteEstimate = {
    distanceKm: Math.round(straightKm * 100) / 100,
    durationMin: Math.max(1, Math.round((straightKm / 28) * 60)),
    source: "straight",
  };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${dest.lng},${dest.lat}?overview=false`;
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
    if (!res.ok) {
      routeCache.set(key, fallback);
      return fallback;
    }
    const data = (await res.json()) as { routes?: Array<{ distance?: number; duration?: number }> };
    const route = data.routes?.[0];
    if (!route?.distance) {
      routeCache.set(key, fallback);
      return fallback;
    }
    // OSRM 默认偏小客车；越南货车/拥堵按 1.35 倍修正
    const rawMin = Math.max(1, Math.round((route.duration || 0) / 60));
    const estimate: RouteEstimate = {
      distanceKm: Math.round((route.distance / 1000) * 100) / 100,
      durationMin: Math.max(1, Math.round(rawMin * 1.35)),
      source: "osrm",
    };
    routeCache.set(key, estimate);
    return estimate;
  } catch {
    routeCache.set(key, fallback);
    return fallback;
  } finally {
    clearTimeout(timer);
  }
}

export function formatRouteLabel(estimate: RouteEstimate) {
  const hours = Math.floor(estimate.durationMin / 60);
  const mins = estimate.durationMin % 60;
  const time = hours > 0 ? `${hours} 小时 ${mins} 分钟` : `${mins} 分钟`;
  const note = estimate.source === "straight" ? "（直线距离，供参考）" : "";
  return `约 ${estimate.distanceKm} 公里 · 约 ${time}${note}`;
}
