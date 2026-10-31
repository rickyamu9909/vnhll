"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Card, Descriptions, Space, Table, Tag, Typography, message } from "antd";
import dayjs from "dayjs";
import { BackButton } from "@/components/BackButton";
import { useI18n } from "@/components/I18nProvider";
import { apiFetch, statusLabel } from "@/lib/client";
import { localizeStatusText } from "@/lib/localize";

type Point = { lat: number; lng: number; speedKmh: number | null; statusText: string; recordedAt: string };
type TrackData = {
  orderNo: string;
  status: string;
  shareOn: boolean;
  freshness: "live" | "off" | "ended";
  pickupAddress: string;
  deliveryAddress: string;
  originLabel?: string;
  destLabel?: string;
  origin: { lat: number; lng: number } | null;
  dest: { lat: number; lng: number } | null;
  navPolyline?: Array<[number, number]> | null;
  navSource?: string | null;
  historyPolyline?: Array<[number, number]> | null;
  historySource?: string | null;
  latest: Point | null;
  points: Point[];
};

type LeafletNS = {
  map: (el: HTMLElement, options?: object) => LeafletMap;
  tileLayer: (url: string, options?: object) => { addTo: (map: LeafletMap) => { on: (name: string, fn: () => void) => void } };
  polyline: (
    latlngs: Array<[number, number]>,
    options?: object
  ) => { addTo: (map: LeafletMap) => void; setLatLngs?: (ll: Array<[number, number]>) => void; remove?: () => void; getBounds?: () => unknown };
  marker: (latlng: [number, number], options?: object) => {
    addTo: (map: LeafletMap) => unknown;
    setLatLng: (ll: [number, number]) => void;
    setIcon: (icon: unknown) => void;
    remove: () => void;
  };
  divIcon: (options: object) => unknown;
  latLngBounds: (latlngs: Array<[number, number]>) => unknown;
  circleMarker: (latlng: [number, number], options?: object) => { addTo: (map: LeafletMap) => void; remove?: () => void };
};

type LeafletMap = {
  setView: (latlng: [number, number], zoom: number) => void;
  fitBounds: (bounds: unknown, options?: object) => void;
  remove: () => void;
  invalidateSize: () => void;
};

declare global {
  interface Window {
    L?: LeafletNS;
  }
}

const FRESH: Record<TrackData["freshness"], string> = {
  live: "track.live",
  off: "track.off",
  ended: "track.ended",
};

function shortLabel(text?: string | null, fallback = "") {
  const raw = (text || fallback || "").trim();
  if (!raw) return fallback;
  const part = raw.split(/[,，/]/)[0]?.trim() || raw;
  return part.length > 12 ? `${part.slice(0, 12)}…` : part;
}

function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  return new Promise<LeafletNS>((resolve, reject) => {
    if (!document.querySelector("link[data-leaflet]")) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      link.setAttribute("data-leaflet", "1");
      document.head.appendChild(link);
    }
    const existing = document.querySelector("script[data-leaflet]") as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => (window.L ? resolve(window.L) : reject(new Error("leaflet"))));
      existing.addEventListener("error", () => reject(new Error("leaflet")));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.setAttribute("data-leaflet", "1");
    script.onload = () => (window.L ? resolve(window.L) : reject(new Error("leaflet")));
    script.onerror = () => reject(new Error("leaflet"));
    document.body.appendChild(script);
  });
}

function placeIconHtml(kind: "fa" | "shou", label: string, word: string) {
  const bg = kind === "fa" ? "#52c41a" : "#237804";
  return `<div style="display:flex;align-items:center;gap:4px;transform:translate(-8px,-28px)">
    <div style="width:28px;height:28px;border-radius:50%;background:${bg};color:#fff;font-weight:700;font-size:14px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.25)">${word}</div>
    <div style="background:#fff;border-radius:14px;padding:4px 10px;font-size:12px;color:#262626;box-shadow:0 2px 8px rgba(0,0,0,.15);white-space:nowrap;max-width:140px;overflow:hidden;text-overflow:ellipsis">${label}</div>
  </div>`;
}

function truckIconHtml(statusText: string, destLine: string) {
  const line1 = statusText || "…";
  // 锚点对准车头底部中心，避免气泡偏移造成「车与轨迹分离」观感
  return `<div style="position:relative;width:1px;height:1px">
    <div style="position:absolute;left:50%;bottom:18px;transform:translateX(-50%);width:140px;text-align:center;pointer-events:none">
      <div style="display:inline-block;background:#52c41a;color:#fff;border-radius:8px;padding:6px 10px;font-size:12px;line-height:1.35;box-shadow:0 4px 12px rgba(82,196,26,.45);max-width:160px;text-align:left">
        <div style="font-weight:600">${line1}</div>
        ${destLine ? `<div style="opacity:.95;margin-top:2px">${destLine}</div>` : ""}
      </div>
      <div style="width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-top:8px solid #52c41a;margin:0 auto"></div>
    </div>
    <div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-70%);font-size:28px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,.3))">🚚</div>
  </div>`;
}

function kmBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** 业务仅越南：过滤明显境外噪点坐标 */
function inVietnam(p: { lat: number; lng: number }) {
  return p.lat >= 8 && p.lat <= 24.5 && p.lng >= 102 && p.lng <= 110.5;
}

type TileLayerLike = { addTo: (map: LeafletMap) => { on: (name: string, fn: () => void) => void }; remove?: () => void };

function attachBaseTiles(L: LeafletNS, map: LeafletMap, onFail: () => void) {
  // Google 非官方瓦片常被墙/拒载导致空白；优先 OSM / Carto（越南路网可用）
  const sources: Array<{ url: string; options: object }> = [
    {
      url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
      options: {
        maxZoom: 20,
        subdomains: "abcd",
        attribution: '&copy; OpenStreetMap &copy; CARTO',
      },
    },
    {
      url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      options: {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap',
      },
    },
    {
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
      options: {
        maxZoom: 19,
        attribution: "Esri",
      },
    },
  ];
  let idx = 0;
  let layer: TileLayerLike | null = null;
  let errors = 0;
  const mount = () => {
    const src = sources[idx];
    if (!src) {
      onFail();
      return;
    }
    layer = L.tileLayer(src.url, src.options) as TileLayerLike;
    layer.addTo(map).on("tileerror", () => {
      errors += 1;
      if (errors < 3) return;
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

export function TrackView({ apiUrl, backHref }: { apiUrl: string; backHref: string }) {
  const { t } = useI18n();
  const [data, setData] = useState<TrackData | null>(null);
  const [tileFailed, setTileFailed] = useState(false);
  const [navHint, setNavHint] = useState("");
  const mapNode = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const LRef = useRef<LeafletNS | null>(null);
  const overlaysRef = useRef<{
    truck?: ReturnType<LeafletNS["marker"]>;
    trail?: { remove: () => void };
    dots?: Array<{ remove?: () => void }>;
    builtKey?: string;
  }>({});

  useEffect(() => {
    let stopped = false;
    const load = async () => {
      const res = await apiFetch<TrackData>(apiUrl);
      if (stopped) return;
      if (!res.ok || !res.data) message.error(res.message || t("track.fail", "轨迹加载失败"));
      else setData(res.data);
    };
    load();
    const timer = window.setInterval(load, 45000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [apiUrl, t]);

  useEffect(() => {
    if (!mapNode.current || !data) return;
    const origin = data.origin;
    const dest = data.dest;
    const points = data.points || [];
    const history = data.historyPolyline && data.historyPolyline.length >= 2 ? data.historyPolyline : null;
    if (!origin && !dest && !points.length && !history) return;

    let cancelled = false;
    const originName = shortLabel(data.originLabel, t("form.section_origin", "起运"));
    const destName = shortLabel(data.destLabel, t("form.section_dest", "目的地"));
    const trailKey = history?.length || points.length;
    const latestKey = data.latest ? `${data.latest.lat.toFixed(4)},${data.latest.lng.toFixed(4)}` : "";
    const builtKey = `${data.orderNo}:${origin?.lat},${origin?.lng}:${dest?.lat},${dest?.lng}:${data.navPolyline?.length || 0}:${trailKey}:${data.historySource || ""}`;

    (async () => {
      try {
        const L = LRef.current || (await loadLeaflet());
        if (cancelled || !mapNode.current) return;
        LRef.current = L;

        if (!mapRef.current || overlaysRef.current.builtKey !== builtKey) {
          mapRef.current?.remove();
          overlaysRef.current = {};
          const map = L.map(mapNode.current, { zoomControl: true, preferCanvas: true });
          mapRef.current = map;
          attachBaseTiles(L, map, () => setTileFailed(true));

          const rawVehicle = data.latest || (points.length ? points[points.length - 1] : null);
          const vehicleOk = rawVehicle && inVietnam(rawVehicle) ? rawVehicle : null;
          const vnPoints = points.filter((p) => inVietnam(p));
          const vnHistory =
            history?.filter((ll) => inVietnam({ lat: ll[0], lng: ll[1] })) ||
            null;
          const trailLine: Array<[number, number]> | null =
            vnHistory && vnHistory.length >= 2
              ? vnHistory
              : vnPoints.length >= 2
                ? vnPoints.map((p) => [p.lat, p.lng] as [number, number])
                : vnPoints.length === 1
                  ? [[vnPoints[0].lat, vnPoints[0].lng]]
                  : null;

          // 计划导航线（起讫道路）— 越南业务主视野
          const nav = data.navPolyline && data.navPolyline.length >= 2 ? data.navPolyline : null;
          if (nav) {
            L.polyline(nav, { color: "#52c41a", weight: 5, opacity: 0.75 }).addTo(map);
          }

          // 历史上报轨迹（仅越南境内点）
          if (trailLine && trailLine.length >= 2) {
            L.polyline(trailLine, { color: "#0958d9", weight: 5, opacity: 0.95 }).addTo(map);
          }

          if (origin) {
            L.marker([origin.lat, origin.lng], {
              icon: L.divIcon({
                className: "",
                html: placeIconHtml("fa", originName, t("track.fa", "发")),
                iconSize: [120, 36],
                iconAnchor: [14, 28],
              }),
            }).addTo(map);
          }
          if (dest) {
            L.marker([dest.lat, dest.lng], {
              icon: L.divIcon({
                className: "",
                html: placeIconHtml("shou", destName, t("track.shou", "收")),
                iconSize: [120, 36],
                iconAnchor: [14, 28],
              }),
            }).addTo(map);
          }

          const sampleEvery = Math.max(1, Math.floor(Math.max(vnPoints.length - 1, 1) / 10));
          const dots: Array<{ remove?: () => void }> = [];
          vnPoints.forEach((p, idx) => {
            if (idx === vnPoints.length - 1) return;
            if (idx % sampleEvery !== 0 && idx !== 0) return;
            const dot = L.circleMarker([p.lat, p.lng], {
              radius: 4,
              color: "#0958d9",
              fillColor: "#69b1ff",
              fillOpacity: 0.95,
              weight: 1,
            }).addTo(map);
            dots.push(dot as unknown as { remove?: () => void });
          });
          overlaysRef.current.dots = dots;

          // 视野：收发货区域 +（越南境内）车辆轨迹，类似导航范围
          const focusPts: Array<[number, number]> = [];
          if (origin) focusPts.push([origin.lat, origin.lng]);
          if (dest) focusPts.push([dest.lat, dest.lng]);
          if (nav) focusPts.push(...nav);
          if (trailLine) focusPts.push(...trailLine);
          if (vehicleOk) focusPts.push([vehicleOk.lat, vehicleOk.lng]);

          if (focusPts.length === 1) map.setView(focusPts[0], 14);
          else if (focusPts.length > 1) map.fitBounds(L.latLngBounds(focusPts), { padding: [48, 48], maxZoom: 15 });
          else map.setView([10.77, 106.7], 11);

          const gpsFar = !!rawVehicle && !inVietnam(rawVehicle);
          if (gpsFar) setNavHint(t("track.gps_warn", "车辆上报坐标远离订单起讫点，已按历史上报轨迹局部展示（请检查司机定位）"));
          else if (trailLine && trailLine.length >= 2)
            setNavHint(
              data.historySource === "osrm-match"
                ? t("track.hist_ok", "已绘制历史上报轨迹（贴路）")
                : t("track.focus_hist", "已按历史上报轨迹绘制；货车图标为最新位置")
            );
          else if (nav) setNavHint(t("track.nav_ok", "已按道路导航绘制路线"));
          else if (origin && dest) setNavHint(t("track.nav_fail", "导航路线暂不可用，仅显示起讫点与车辆位置（未画直线）"));
          else setNavHint("");

          overlaysRef.current.builtKey = builtKey;
          window.setTimeout(() => map.invalidateSize(), 120);
        }

        const map = mapRef.current!;
        const rawVehicle = data.latest || (points.length ? points[points.length - 1] : null);
        const vehicle = rawVehicle && inVietnam(rawVehicle) ? rawVehicle : null;
        if (vehicle) {
          const statusText = localizeStatusText(vehicle.statusText, t);
          const destLine = destName ? t("track.to_dest", "正在发往{dest}").replace("{dest}", destName) : "";
          const icon = L.divIcon({
            className: "",
            html: truckIconHtml(statusText, destLine),
            iconSize: [1, 1],
            iconAnchor: [0, 0],
          });
          if (overlaysRef.current.truck) {
            overlaysRef.current.truck.setLatLng([vehicle.lat, vehicle.lng]);
            overlaysRef.current.truck.setIcon(icon);
          } else {
            overlaysRef.current.truck = L.marker([vehicle.lat, vehicle.lng], { icon, zIndexOffset: 1000 }).addTo(map) as ReturnType<
              LeafletNS["marker"]
            >;
          }
        } else if (overlaysRef.current.truck) {
          overlaysRef.current.truck.remove();
          overlaysRef.current.truck = undefined;
        }
        void latestKey;
      } catch {
        setTileFailed(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [data, t]);

  useEffect(() => {
    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
      overlaysRef.current = {};
    };
  }, []);

  const freshKey = data ? FRESH[data.freshness] : "track.off";
  const freshFallback: Record<TrackData["freshness"], string> = {
    live: t("track.live", "上报中"),
    off: t("track.off_hint", "未开启（需司机点前往提货）"),
    ended: t("track.ended", "已结束"),
  };

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <BackButton href={backHref} />
        <Typography.Title level={3} style={{ margin: 0 }}>
          {data?.orderNo || t("track.title", "查看轨迹")}
        </Typography.Title>
      </Space>
      <Card style={{ marginBottom: 12 }} size="small">
        <Descriptions size="small" column={{ xs: 1, sm: 2 }}>
          <Descriptions.Item label={t("order.status", "订单状态")}>{data ? statusLabel(data.status, t) : "-"}</Descriptions.Item>
          <Descriptions.Item label={t("track.report", "上报状态")}>
            <Tag color={data?.freshness === "live" ? "green" : "default"}>{t(freshKey, data ? freshFallback[data.freshness] : "未开启")}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label={t("track.text", "文字状态")}>
            {data?.latest ? localizeStatusText(data.latest.statusText, t) : "-"}
          </Descriptions.Item>
          <Descriptions.Item label={t("track.last", "最后上报")}>
            {data?.latest ? dayjs(data.latest.recordedAt).format("MM-DD HH:mm:ss") : "-"}
          </Descriptions.Item>
          <Descriptions.Item label={t("form.section_origin", "起运")}>{data?.pickupAddress || "-"}</Descriptions.Item>
          <Descriptions.Item label={t("form.section_dest", "目的地")}>{data?.deliveryAddress || "-"}</Descriptions.Item>
        </Descriptions>
      </Card>
      <Card title={t("track.map", "轨迹地图")} style={{ marginBottom: 12 }} size="small">
        {navHint ? (
          <Alert type={data?.historyPolyline?.length || data?.navSource === "osrm" ? "success" : "warning"} showIcon style={{ marginBottom: 8 }} message={navHint} />
        ) : null}
        <div ref={mapNode} className="track-map" style={{ height: 420, borderRadius: 8, background: "#e8eef6" }} />
        {tileFailed ? (
          <Typography.Text type="secondary" style={{ display: "block", marginTop: 8 }}>
            {t("track.sketch", "底图加载异常时仍可查看上方信息与上报记录")}
          </Typography.Text>
        ) : null}
      </Card>
      <Card title={t("track.list", "上报记录")} size="small">
        <Table
          size="small"
          rowKey={(row) => row.recordedAt + row.lat}
          dataSource={[...(data?.points || [])].reverse()}
          pagination={{ pageSize: 10 }}
          columns={[
            { title: t("track.time", "时间"), dataIndex: "recordedAt", render: (value: string) => dayjs(value).format("MM-DD HH:mm:ss") },
            {
              title: t("track.text", "文字状态"),
              dataIndex: "statusText",
              render: (value: string) => localizeStatusText(value, t),
            },
            { title: t("track.coord", "坐标"), render: (_, row: Point) => `${row.lat.toFixed(5)}, ${row.lng.toFixed(5)}` },
          ]}
        />
      </Card>
    </div>
  );
}
