/** Leaflet 底图：Carto 现常要求 API Key（灰底 API KEY REQUIRED），优先 OSM / Esri */
export const MAP_TILE_SOURCES: Array<{ url: string; options: Record<string, unknown> }> = [
  {
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    options: {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap",
    },
  },
  {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    options: {
      maxZoom: 19,
      attribution: "Esri",
    },
  },
  {
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    options: {
      maxZoom: 20,
      subdomains: "abcd",
      attribution: "&copy; OpenStreetMap &copy; CARTO",
    },
  },
];

export function inVietnamBBox(lat: number, lng: number) {
  return lat >= 8 && lat <= 24.5 && lng >= 102 && lng <= 110.5;
}

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

type TileLayerHandle = {
  addTo: (map: unknown) => { on: (name: string, fn: () => void) => void };
  remove?: () => void;
};

type LeafletLike = {
  tileLayer: (url: string, options?: object) => TileLayerHandle;
};

/** 挂载底图，瓦片连续失败时自动切下一源 */
export function attachBaseTiles(L: LeafletLike, map: unknown, onFail?: () => void) {
  let idx = 0;
  let layer: TileLayerHandle | null = null;
  let errors = 0;
  const mount = () => {
    const src = MAP_TILE_SOURCES[idx];
    if (!src) {
      onFail?.();
      return;
    }
    layer = L.tileLayer(src.url, src.options);
    layer.addTo(map).on("tileerror", () => {
      errors += 1;
      if (errors < 4) return;
      errors = 0;
      try {
        layer?.remove?.();
      } catch {
        /* ignore */
      }
      idx += 1;
      mount();
    });
  };
  mount();
}
