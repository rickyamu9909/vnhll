"use client";

import { useEffect, useRef, useState } from "react";
import { Card, Descriptions, Space, Table, Tag, Typography, message } from "antd";
import dayjs from "dayjs";
import { BackButton } from "@/components/BackButton";
import { useI18n } from "@/components/I18nProvider";
import { apiFetch, statusLabel } from "@/lib/client";

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
  latest: Point | null;
  points: Point[];
};

type LeafletNS = {
  map: (el: HTMLElement, options?: object) => LeafletMap;
  tileLayer: (url: string, options?: object) => { addTo: (map: LeafletMap) => { on: (name: string, fn: () => void) => void } };
  polyline: (latlngs: Array<[number, number]>, options?: object) => { addTo: (map: LeafletMap) => void };
  marker: (latlng: [number, number], options?: object) => {
    addTo: (map: LeafletMap) => { bindPopup: (html: string, options?: object) => void };
  };
  divIcon: (options: object) => unknown;
  latLngBounds: (latlngs: Array<[number, number]>) => unknown;
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

async function fetchNavRoute(origin: { lat: number; lng: number }, dest: { lat: number; lng: number }) {
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${dest.lng},${dest.lat}?overview=full&geometries=geojson`;
    const res = await fetch(url);
    const data = await res.json();
    const coords = data.routes?.[0]?.geometry?.coordinates as Array<[number, number]> | undefined;
    if (!coords?.length) return null;
    return coords.map(([lng, lat]) => [lat, lng] as [number, number]);
  } catch {
    return null;
  }
}

function placeIconHtml(kind: "fa" | "shou", label: string) {
  const bg = kind === "fa" ? "#52c41a" : "#237804";
  const word = kind === "fa" ? "发" : "收";
  return `<div style="display:flex;align-items:center;gap:4px;transform:translate(-8px,-28px)">
    <div style="width:28px;height:28px;border-radius:50%;background:${bg};color:#fff;font-weight:700;font-size:14px;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(0,0,0,.25)">${word}</div>
    <div style="background:#fff;border-radius:14px;padding:4px 10px;font-size:12px;color:#262626;box-shadow:0 2px 8px rgba(0,0,0,.15);white-space:nowrap;max-width:140px;overflow:hidden;text-overflow:ellipsis">${label}</div>
  </div>`;
}

function truckIconHtml(statusText: string, destHint: string) {
  const line1 = statusText || "运输中";
  const line2 = destHint ? `正在发往${destHint}` : "";
  return `<div style="position:relative;transform:translate(-40px,-70px);width:120px;text-align:center">
    <div style="display:inline-block;background:#52c41a;color:#fff;border-radius:8px;padding:6px 10px;font-size:12px;line-height:1.35;box-shadow:0 4px 12px rgba(82,196,26,.45);max-width:160px;text-align:left">
      <div style="font-weight:600">${line1}</div>
      ${line2 ? `<div style="opacity:.95;margin-top:2px">${line2}</div>` : ""}
    </div>
    <div style="width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-top:8px solid #52c41a;margin:0 auto"></div>
    <div style="font-size:34px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,.3))">🚚</div>
  </div>`;
}

export function TrackView({ apiUrl, backHref }: { apiUrl: string; backHref: string }) {
  const { t } = useI18n();
  const [data, setData] = useState<TrackData | null>(null);
  const [tileFailed, setTileFailed] = useState(false);
  const mapNode = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);

  useEffect(() => {
    let stopped = false;
    const load = async () => {
      const res = await apiFetch<TrackData>(apiUrl);
      if (stopped) return;
      if (!res.ok || !res.data) message.error(res.message || t("track.fail", "轨迹加载失败"));
      else setData(res.data);
    };
    load();
    const timer = window.setInterval(load, 30000);
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
    if (!origin && !dest && !points.length) return;

    let cancelled = false;
    (async () => {
      try {
        const L = await loadLeaflet();
        if (cancelled || !mapNode.current) return;
        mapRef.current?.remove();
        const map = L.map(mapNode.current, { zoomControl: true });
        mapRef.current = map;
        const tiles = L.tileLayer("https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", {
          maxZoom: 20,
          subdomains: ["mt0", "mt1", "mt2", "mt3"],
          attribution: "Google",
        }).addTo(map);
        tiles.on("tileerror", () => setTileFailed(true));

        const boundsPts: Array<[number, number]> = [];

        // 默认：起运地 → 目的地导航路线
        if (origin && dest) {
          const nav = await fetchNavRoute(origin, dest);
          if (cancelled) return;
          const navLine = nav?.length ? nav : ([[origin.lat, origin.lng], [dest.lat, dest.lng]] as Array<[number, number]>);
          L.polyline(navLine, { color: "#95de64", weight: 5, opacity: 0.85 }).addTo(map);
          boundsPts.push(...navLine);
        }

        // 已上报轨迹（实线加深）
        if (points.length >= 2) {
          const trail = points.map((p) => [p.lat, p.lng] as [number, number]);
          L.polyline(trail, { color: "#237804", weight: 4, opacity: 0.95 }).addTo(map);
          boundsPts.push(...trail);
        } else if (points.length === 1) {
          boundsPts.push([points[0].lat, points[0].lng]);
        }

        const originName = shortLabel(data.originLabel, t("form.section_origin", "起运"));
        const destName = shortLabel(data.destLabel, t("form.section_dest", "目的地"));

        if (origin) {
          L.marker([origin.lat, origin.lng], {
            icon: L.divIcon({
              className: "",
              html: placeIconHtml("fa", originName),
              iconSize: [120, 36],
              iconAnchor: [14, 28],
            }),
          }).addTo(map);
          boundsPts.push([origin.lat, origin.lng]);
        }
        if (dest) {
          L.marker([dest.lat, dest.lng], {
            icon: L.divIcon({
              className: "",
              html: placeIconHtml("shou", destName),
              iconSize: [120, 36],
              iconAnchor: [14, 28],
            }),
          }).addTo(map);
          boundsPts.push([dest.lat, dest.lng]);
        }

        const vehicle = data.latest || (points.length ? points[points.length - 1] : null);
        if (vehicle) {
          L.marker([vehicle.lat, vehicle.lng], {
            icon: L.divIcon({
              className: "",
              html: truckIconHtml(vehicle.statusText, destName),
              iconSize: [120, 90],
              iconAnchor: [40, 70],
            }),
            zIndexOffset: 1000,
          }).addTo(map);
          boundsPts.push([vehicle.lat, vehicle.lng]);
        }

        if (boundsPts.length === 1) map.setView(boundsPts[0], 14);
        else if (boundsPts.length > 1) map.fitBounds(L.latLngBounds(boundsPts), { padding: [48, 48] });
        else map.setView([10.77, 106.7], 11);
        window.setTimeout(() => map.invalidateSize(), 200);
      } catch {
        setTileFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [data, t]);

  const freshKey = data ? FRESH[data.freshness] : "track.off";
  const freshFallback: Record<TrackData["freshness"], string> = {
    live: "上报中",
    off: "未开启（需司机点前往提货）",
    ended: "已结束",
  };

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <BackButton href={backHref} />
        <Typography.Title level={3} style={{ margin: 0 }}>
          {data?.orderNo || t("track.title", "查看轨迹")}
        </Typography.Title>
      </Space>
      <Card style={{ marginBottom: 12 }}>
        <Descriptions size="small" column={{ xs: 1, sm: 2 }}>
          <Descriptions.Item label={t("order.status", "订单状态")}>{data ? statusLabel(data.status, t) : "-"}</Descriptions.Item>
          <Descriptions.Item label={t("track.report", "上报状态")}>
            <Tag color={data?.freshness === "live" ? "green" : data?.freshness === "ended" ? "default" : "default"}>
              {t(freshKey, data ? freshFallback[data.freshness] : "未开启")}
            </Tag>
          </Descriptions.Item>
          <Descriptions.Item label={t("track.text", "文字状态")}>{data?.latest?.statusText || "-"}</Descriptions.Item>
          <Descriptions.Item label={t("track.speed", "速度")}>{data?.latest?.speedKmh != null ? `${data.latest.speedKmh} km/h` : "-"}</Descriptions.Item>
          <Descriptions.Item label={t("track.last", "最后上报")}>{data?.latest ? dayjs(data.latest.recordedAt).format("MM-DD HH:mm:ss") : "-"}</Descriptions.Item>
          <Descriptions.Item label={t("track.count", "轨迹点数")}>{data?.points.length || 0}</Descriptions.Item>
          <Descriptions.Item label={t("form.section_origin", "起运")}>{data?.pickupAddress || "-"}</Descriptions.Item>
          <Descriptions.Item label={t("form.section_dest", "目的地")}>{data?.deliveryAddress || "-"}</Descriptions.Item>
        </Descriptions>
      </Card>
      <Card title={t("track.map", "轨迹地图")} style={{ marginBottom: 12 }}>
        <Typography.Paragraph type="secondary" style={{ marginTop: 0 }}>
          默认展示起运地到目的地导航路线；司机点「前往提货」后持续上报当前位置（货车图标）。
        </Typography.Paragraph>
        <div ref={mapNode} className="track-map" style={{ height: 420, borderRadius: 8, background: "#e8eef6" }} />
        {tileFailed ? (
          <Typography.Text type="secondary" style={{ display: "block", marginTop: 8 }}>
            {t("track.sketch", "底图加载异常时仍可查看上方信息与上报记录")}
          </Typography.Text>
        ) : null}
      </Card>
      <Card title={t("track.list", "上报记录")}>
        <Table
          size="small"
          rowKey={(row) => row.recordedAt + row.lat}
          dataSource={[...(data?.points || [])].reverse()}
          pagination={{ pageSize: 15 }}
          columns={[
            { title: t("track.time", "时间"), dataIndex: "recordedAt", render: (value: string) => dayjs(value).format("MM-DD HH:mm:ss") },
            { title: t("track.text", "文字状态"), dataIndex: "statusText" },
            { title: t("track.speed", "速度"), dataIndex: "speedKmh", render: (value: number | null) => (value == null ? "-" : `${value} km/h`) },
            { title: t("track.coord", "坐标"), render: (_, row: Point) => `${row.lat.toFixed(5)}, ${row.lng.toFixed(5)}` },
          ]}
        />
      </Card>
    </div>
  );
}
