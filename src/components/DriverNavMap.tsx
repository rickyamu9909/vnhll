"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Button, Modal, Space, Typography } from "antd";
import { useI18n } from "@/components/I18nProvider";
import { apiFetch } from "@/lib/client";
import { attachBaseTiles, haversineKm, inVietnamBBox } from "@/lib/map-tiles";

type Props = {
  destLat?: number | null;
  destLng?: number | null;
  destAddress: string;
  title: string;
  autoStart?: boolean;
  /** 受控展开（用于提货/送货互斥） */
  expanded?: boolean;
  onExpandedChange?: (open: boolean) => void;
};

type NavRouteData = {
  distanceKm: number;
  durationMin: number;
  source: string;
  coordinates: Array<[number, number]>;
  cached?: boolean;
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

export function DriverNavMap({
  destLat,
  destLng,
  destAddress,
  title,
  autoStart = false,
  expanded,
  onExpandedChange,
}: Props) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [warn, setWarn] = useState("");
  const [innerOpen, setInnerOpen] = useState(autoStart);
  const open = expanded !== undefined ? expanded : innerOpen;
  const setOpen = (v: boolean) => {
    if (onExpandedChange) onExpandedChange(v);
    else setInnerOpen(v);
  };
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);
  const [eta, setEta] = useState("");
  const [tileFail, setTileFail] = useState(false);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (!open) {
      setMapReady(false);
      return;
    }
    // 等 DOM 挂上再标 ready，触发地图初始化
    const id = window.requestAnimationFrame(() => setMapReady(true));
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open || !mapReady || !ref.current) return;
    let watchId = 0;
    let map: any;
    let meMarker: any;
    let routeLine: any;
    let cancelled = false;
    let lastRouteAt = 0;
    let lastRouteFrom: { lat: number; lng: number } | null = null;
    let routeBusy = false;

    (async () => {
      try {
        const L = await loadLeaflet();
        if (cancelled || !ref.current) return;
        const dest = destLat != null && destLng != null ? { lat: destLat, lng: destLng } : null;
        const center = dest && inVietnamBBox(dest.lat, dest.lng) ? [dest.lat, dest.lng] : [10.77, 106.7];
        map = L.map(ref.current, { preferCanvas: true, zoomControl: true }).setView(center, 12);
        attachBaseTiles(L, map, () => setTileFail(true));
        if (dest) L.marker([dest.lat, dest.lng]).addTo(map).bindPopup(destAddress || title);
        // 移动端布局后需刷新尺寸
        window.setTimeout(() => map.invalidateSize(), 80);

        const applyRoute = (from: { lat: number; lng: number }, data: NavRouteData) => {
          const latlngs = data.coordinates?.length
            ? data.coordinates
            : [
                [from.lat, from.lng],
                [dest!.lat, dest!.lng],
              ];
          if (routeLine) map.removeLayer(routeLine);
          routeLine = L.polyline(latlngs, { color: "#2563eb", weight: 5 }).addTo(map);
          map.fitBounds(routeLine.getBounds(), { padding: [24, 24] });
          setWarn("");
          setEta(
            t("nav.eta", "距{dest}约 {km} 公里 · {min} 分钟（越南路况）")
              .replace("{dest}", title)
              .replace("{km}", String(data.distanceKm))
              .replace("{min}", String(data.durationMin))
          );
        };

        const drawRoute = async (from: { lat: number; lng: number }, to: { lat: number; lng: number }, force = false) => {
          const now = Date.now();
          const movedKm = lastRouteFrom ? haversineKm(lastRouteFrom, from) : 999;
          if (!force && routeBusy) return;
          if (!force && now - lastRouteAt < 45000 && movedKm < 0.4) return;

          if (!inVietnamBBox(from.lat, from.lng) || !inVietnamBBox(to.lat, to.lng)) {
            setWarn(t("nav.gps_vn", "当前定位不在越南境内，已只显示终点标记，请检查手机定位或到现场后再导航。"));
            setEta("");
            map.fitBounds(
              L.latLngBounds([
                [from.lat, from.lng],
                [to.lat, to.lng],
              ]),
              { padding: [40, 40], maxZoom: 8 }
            );
            return;
          }

          if (haversineKm(from, to) > 800) {
            setWarn(t("nav.too_far", "起终点过远，已跳过路网规划，仅显示标记。"));
            setEta(t("nav.straight", "直线约 {km} 公里").replace("{km}", String(Math.round(haversineKm(from, to)))));
            return;
          }

          routeBusy = true;
          lastRouteAt = now;
          lastRouteFrom = from;
          try {
            const qs = `oLat=${from.lat}&oLng=${from.lng}&dLat=${to.lat}&dLng=${to.lng}`;
            const res = await apiFetch<NavRouteData>(`/api/geo/nav-route?${qs}`);
            if (cancelled) return;
            if (!res.ok || !res.data) {
              setWarn(t("nav.route_slow", "路网规划超时或不可用，已显示当前位置与终点。"));
              return;
            }
            applyRoute(from, res.data);
          } catch {
            setWarn(t("nav.route_slow", "路网规划超时或不可用，已显示当前位置与终点。"));
          } finally {
            routeBusy = false;
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
              if (dest) void drawRoute(here, dest, true);
              else map.setView([here.lat, here.lng], 14);
            } else {
              meMarker.setLatLng([here.lat, here.lng]);
              if (dest) void drawRoute(here, dest, false);
            }
          },
          () => setError(t("nav.geo_fail", "定位失败，请允许位置权限后重试")),
          { enableHighAccuracy: false, maximumAge: 15000, timeout: 12000 }
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
  }, [open, mapReady, destLat, destLng, destAddress, title, t]);

  const gmaps = pos
    ? `https://www.google.com/maps/dir/?api=1&origin=${pos.lat},${pos.lng}&destination=${
        destLat != null && destLng != null ? `${destLat},${destLng}` : encodeURIComponent(destAddress)
      }&travelmode=driving`
    : `https://www.google.com/maps/dir/?api=1&destination=${
        destLat != null && destLng != null ? `${destLat},${destLng}` : encodeURIComponent(destAddress)
      }&travelmode=driving`;

  const openGoogleMaps = () => {
    Modal.confirm({
      title: t("nav.google_confirm_title", "打开谷歌地图？"),
      content: t(
        "nav.google_confirm_body",
        "跳转到谷歌地图后，本页位置上报会暂停。导航结束后请返回本页，上报会自动恢复。"
      ),
      okText: t("nav.google_confirm_ok", "仍要打开"),
      cancelText: t("action.cancel", "取消"),
      onOk: () => {
        window.open(gmaps, "_blank", "noopener,noreferrer");
      },
    });
  };

  return (
    <div style={{ marginTop: 12 }}>
      <Space wrap>
        <Button
          type="primary"
          onClick={() => {
            setError("");
            setWarn("");
            setTileFail(false);
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
        <Button onClick={openGoogleMaps} style={{ background: "#0ea5e9", borderColor: "#0ea5e9", color: "#fff" }}>
          {t("nav.google", "用谷歌地图打开")}
        </Button>
      </Space>
      {open ? (
        <div style={{ marginTop: 8 }}>
          {error ? <Alert type="warning" showIcon message={error} style={{ marginBottom: 8 }} /> : null}
          {warn ? <Alert type="info" showIcon message={warn} style={{ marginBottom: 8 }} /> : null}
          {tileFail ? <Alert type="warning" showIcon message={t("track.tile_fail", "底图加载失败，已切换备用图层")} style={{ marginBottom: 8 }} /> : null}
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 8 }}
            message={t("nav.report_tip", "页内导航可继续位置上报；跳到谷歌地图或切走浏览器后，上报会暂停，请尽快回到本页。")}
          />
          {eta ? (
            <Typography.Text type="secondary">{eta}</Typography.Text>
          ) : (
            <Typography.Text type="secondary">{t("nav.locating", "正在获取当前位置并规划到{dest}…").replace("{dest}", title)}</Typography.Text>
          )}
          <div ref={ref} style={{ height: 280, width: "100%", marginTop: 8, borderRadius: 8, border: "1px solid #e2e8f0" }} />
        </div>
      ) : null}
    </div>
  );
}
