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
  freshness: "live" | "lost" | "off" | "ended";
  pickupAddress: string;
  deliveryAddress: string;
  origin: { lat: number; lng: number } | null;
  dest: { lat: number; lng: number } | null;
  latest: Point | null;
  points: Point[];
};

declare global {
  interface Window {
    L?: {
      map: (el: HTMLElement, options?: object) => LeafletMap;
      tileLayer: (url: string, options?: object) => { addTo: (map: LeafletMap) => { on: (name: string, fn: () => void) => void } };
      polyline: (latlngs: Array<[number, number]>, options?: object) => { addTo: (map: LeafletMap) => void };
      circleMarker: (latlng: [number, number], options?: object) => { addTo: (map: LeafletMap) => { bindTooltip: (text: string) => void } };
      latLngBounds: (latlngs: Array<[number, number]>) => unknown;
    };
  }
}

type LeafletMap = {
  setView: (latlng: [number, number], zoom: number) => void;
  fitBounds: (bounds: unknown, options?: object) => void;
  remove: () => void;
  invalidateSize: () => void;
};

const FRESH: Record<TrackData["freshness"], string> = {
  live: "track.live",
  lost: "track.lost",
  off: "track.off",
  ended: "track.ended",
};

function loadLeaflet() {
  if (window.L) return Promise.resolve(window.L);
  return new Promise<NonNullable<Window["L"]>>((resolve, reject) => {
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

function TrailSketch({ points }: { points: Point[] }) {
  if (!points.length) return null;
  const lats = points.map((point) => point.lat);
  const lngs = points.map((point) => point.lng);
  let minLat = Math.min(...lats);
  let maxLat = Math.max(...lats);
  let minLng = Math.min(...lngs);
  let maxLng = Math.max(...lngs);
  if (maxLat - minLat < 0.01) {
    minLat -= 0.005;
    maxLat += 0.005;
  }
  if (maxLng - minLng < 0.01) {
    minLng -= 0.005;
    maxLng += 0.005;
  }
  const xy = (point: Point) => {
    const x = ((point.lng - minLng) / (maxLng - minLng)) * 100;
    const y = (1 - (point.lat - minLat) / (maxLat - minLat)) * 100;
    return `${x},${y}`;
  };
  const last = points[points.length - 1];
  const [cx, cy] = xy(last).split(",");
  return (
    <svg viewBox="0 0 100 100" style={{ width: "100%", height: 180, background: "#e8eef6", borderRadius: 8 }}>
      <polyline fill="none" stroke="#1677ff" strokeWidth="1.5" points={points.map(xy).join(" ")} />
      <circle cx={cx} cy={cy} r="2.2" fill="#d4380d" />
    </svg>
  );
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
    const points = data?.points || [];
    if (!mapNode.current || !points.length) return;
    let cancelled = false;
    loadLeaflet()
      .then((L) => {
        if (cancelled || !mapNode.current) return;
        mapRef.current?.remove();
        const map = L.map(mapNode.current, { zoomControl: true });
        mapRef.current = map;
        const tiles = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "&copy; OpenStreetMap" }).addTo(map);
        tiles.on("tileerror", () => setTileFailed(true));
        const line = points.map((point) => [point.lat, point.lng] as [number, number]);
        L.polyline(line, { color: "#1677ff", weight: 4 }).addTo(map);
        const last = line[line.length - 1];
        L.circleMarker(last, { radius: 8, color: "#d4380d", fillOpacity: 0.9 }).addTo(map).bindTooltip(data?.latest?.statusText || "");
        if (data?.origin) L.circleMarker([data.origin.lat, data.origin.lng], { radius: 6, color: "#1677ff" }).addTo(map).bindTooltip(t("form.section_origin", "起运"));
        if (data?.dest) L.circleMarker([data.dest.lat, data.dest.lng], { radius: 6, color: "#389e0d" }).addTo(map).bindTooltip(t("form.section_dest", "目的地"));
        const bounds = L.latLngBounds(line);
        if (line.length === 1) map.setView(last, 14);
        else map.fitBounds(bounds, { padding: [24, 24] });
        window.setTimeout(() => map.invalidateSize(), 200);
      })
      .catch(() => setTileFailed(true));
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [data, t]);

  const freshKey = data ? FRESH[data.freshness] : "track.off";
  const freshFallback: Record<TrackData["freshness"], string> = {
    live: "上报中",
    lost: "已开启，已失联",
    off: "未开启",
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
            <Tag color={data?.freshness === "live" ? "green" : data?.freshness === "lost" ? "gold" : "default"}>
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
        <div ref={mapNode} className="track-map" />
        {tileFailed || !data?.points.length ? (
          <div style={{ marginTop: 8 }}>
            <Typography.Text type="secondary">{t("track.sketch", "底图不可用时仍显示轨迹简图")}</Typography.Text>
            <TrailSketch points={data?.points || []} />
          </div>
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
