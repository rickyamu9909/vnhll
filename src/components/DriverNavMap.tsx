"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Button, Space, Typography } from "antd";
import { useI18n } from "@/components/I18nProvider";

type Props = {
  destLat?: number | null;
  destLng?: number | null;
  destAddress: string;
  title: string;
  autoStart?: boolean;
};

function leafletGlobal() {
  return (window as unknown as { L?: unknown }).L as any;
}

function loadLeaflet(): Promise<any> {
  return new Promise((resolve, reject) => {
    const existingL = leafletGlobal();
    if (existingL) return resolve(existingL);
    if (!document.querySelector("link[data-leaflet]")) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      link.setAttribute("data-leaflet", "1");
      document.head.appendChild(link);
    }
    const existing = document.querySelector("script[data-leaflet]") as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => (leafletGlobal() ? resolve(leafletGlobal()) : reject(new Error("leaflet"))));
      existing.addEventListener("error", () => reject(new Error("leaflet")));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.async = true;
    script.setAttribute("data-leaflet", "1");
    script.onload = () => (leafletGlobal() ? resolve(leafletGlobal()) : reject(new Error("leaflet")));
    script.onerror = () => reject(new Error("leaflet"));
    document.body.appendChild(script);
  });
}

export function DriverNavMap({ destLat, destLng, destAddress, title, autoStart = false }: Props) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(autoStart);
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [eta, setEta] = useState("");

  useEffect(() => {
    if (!open || !ref.current) return;
    let watchId = 0;
    let map: any;
    let meMarker: any;
    let routeLine: any;
    let cancelled = false;

    (async () => {
      try {
        const L = await loadLeaflet();
        if (cancelled || !ref.current) return;
        map = L.map(ref.current).setView([10.77, 106.7], 12);
        L.tileLayer("https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", {
          maxZoom: 20,
          subdomains: ["mt0", "mt1", "mt2", "mt3"],
          attribution: "Google",
        }).addTo(map);

        const dest = destLat != null && destLng != null ? { lat: destLat, lng: destLng } : null;
        if (dest) L.marker([dest.lat, dest.lng]).addTo(map).bindPopup(destAddress || title);

        const drawRoute = async (from: { lat: number; lng: number }, to: { lat: number; lng: number }) => {
          try {
            const url = `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
            const res = await fetch(url);
            const data = await res.json();
            const route = data.routes?.[0];
            const coords = route?.geometry?.coordinates;
            if (!coords) return;
            const latlngs = coords.map((c: number[]) => [c[1], c[0]]);
            if (routeLine) map.removeLayer(routeLine);
            routeLine = L.polyline(latlngs, { color: "#2563eb", weight: 5 }).addTo(map);
            map.fitBounds(routeLine.getBounds(), { padding: [24, 24] });
            const km = Math.round((route.distance / 1000) * 10) / 10;
            const min = Math.max(1, Math.round((route.duration / 60) * 1.35));
            setEta(t("nav.eta", "距{dest}约 {km} 公里 · {min} 分钟（越南路况）").replace("{dest}", title).replace("{km}", String(km)).replace("{min}", String(min)));
          } catch {
            /* ignore */
          }
        };

        if (!navigator.geolocation) {
          setError(t("nav.no_geo", "当前浏览器不支持定位"));
          return;
        }
        watchId = navigator.geolocation.watchPosition(
          (p) => {
            const here = { lat: p.coords.latitude, lng: p.coords.longitude };
            setPos(here);
            if (!meMarker) {
              meMarker = L.circleMarker([here.lat, here.lng], {
                radius: 8,
                color: "#16a34a",
                fillColor: "#22c55e",
                fillOpacity: 0.9,
              }).addTo(map);
            } else meMarker.setLatLng([here.lat, here.lng]);
            if (dest) void drawRoute(here, dest);
            else map.setView([here.lat, here.lng], 14);
          },
          () => setError(t("nav.geo_fail", "定位失败，请允许位置权限后重试")),
          { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 }
        );
      } catch {
        setError(t("nav.map_fail", "地图加载失败"));
      }
    })();

    return () => {
      cancelled = true;
      if (watchId) navigator.geolocation.clearWatch(watchId);
      if (map) map.remove();
    };
  }, [open, destLat, destLng, destAddress, title, t]);

  const gmaps = pos
    ? `https://www.google.com/maps/dir/?api=1&origin=${pos.lat},${pos.lng}&destination=${
        destLat != null && destLng != null ? `${destLat},${destLng}` : encodeURIComponent(destAddress)
      }&travelmode=driving`
    : `https://www.google.com/maps/dir/?api=1&destination=${
        destLat != null && destLng != null ? `${destLat},${destLng}` : encodeURIComponent(destAddress)
      }&travelmode=driving`;

  return (
    <div style={{ marginTop: 12 }}>
      <Space wrap>
        <Button
          type="primary"
          onClick={() => {
            setError("");
            setOpen(true);
          }}
        >
          {open
            ? t("nav.opening", "导航中：当前位置 → {dest}").replace("{dest}", title)
            : t("nav.start_to", "从当前位置导航到{dest}").replace("{dest}", title)}
        </Button>
        {open ? (
          <Button onClick={() => setOpen(false)} size="small">
            {t("nav.collapse", "收起")}
          </Button>
        ) : null}
        <Button href={gmaps} target="_blank" style={{ background: "#0ea5e9", borderColor: "#0ea5e9", color: "#fff" }}>
          {t("nav.google", "用谷歌地图打开")}
        </Button>
      </Space>
      {open ? (
        <div style={{ marginTop: 8 }}>
          {error ? <Alert type="warning" showIcon message={error} style={{ marginBottom: 8 }} /> : null}
          {eta ? (
            <Typography.Text type="secondary">{eta}</Typography.Text>
          ) : (
            <Typography.Text type="secondary">{t("nav.locating", "正在获取当前位置并规划到{dest}…").replace("{dest}", title)}</Typography.Text>
          )}
          <div ref={ref} style={{ height: 360, width: "100%", marginTop: 8, borderRadius: 8, border: "1px solid #e2e8f0" }} />
        </div>
      ) : null}
    </div>
  );
}
