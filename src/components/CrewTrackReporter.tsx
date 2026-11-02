"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Select, Space, Typography } from "antd";
import { useI18n } from "@/components/I18nProvider";
import { apiFetch } from "@/lib/client";

type ActiveOrder = { id: string; orderNo: string; status: string };
type Queued = { orderId: string; lat: number; lng: number; speedKmh: number | null; statusText: string; recordedAt: string };

const STATUS_KEYS = ["track.going", "track.picked", "track.moving", "track.unloading", "track.arrived", "track.issue"] as const;

export function CrewTrackReporter({ token }: { token: string }) {
  const { t } = useI18n();
  const [phase, setPhase] = useState<"empty" | "need" | "on" | "denied" | "paused">("empty");
  const [orders, setOrders] = useState<ActiveOrder[]>([]);
  const [statusKey, setStatusKey] = useState<(typeof STATUS_KEYS)[number]>("track.moving");
  const statusRef = useRef(statusKey);
  statusRef.current = statusKey;
  const queueKey = `ants_crew_track_queue_${token}`;
  const kickRef = useRef<(() => void) | null>(null);

  const readQueue = (): Queued[] => {
    try {
      const raw = localStorage.getItem(queueKey);
      const parsed = raw ? (JSON.parse(raw) as Queued[]) : [];
      return Array.isArray(parsed) ? parsed.slice(-200) : [];
    } catch {
      return [];
    }
  };

  const writeQueue = (rows: Queued[]) => {
    try {
      localStorage.setItem(queueKey, JSON.stringify(rows.slice(-200)));
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    let stopped = false;
    let timer = 0;

    const schedule = (ms: number) => {
      if (!stopped) timer = window.setTimeout(run, ms);
    };

    const run = async () => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") {
        setPhase((p) => (p === "empty" ? p : "paused"));
        schedule(15000);
        return;
      }
      const res = await apiFetch<ActiveOrder[]>(`/api/crew/${token}/tracking`);
      const active = res.ok ? res.data || [] : [];
      if (stopped) return;
      setOrders(active);
      if (!active.length) {
        setPhase("empty");
        schedule(60000);
        return;
      }
      if (!navigator.geolocation) {
        setPhase("denied");
        schedule(120000);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          if (stopped) return;
          const speed =
            Number.isFinite(pos.coords.speed) && pos.coords.speed != null && pos.coords.speed >= 0 ? Math.round(pos.coords.speed * 3.6) : null;
          const recordedAt = new Date(pos.timestamp || Date.now()).toISOString();
          const statusText = t(statusRef.current, "运输中");
          const fresh: Queued[] = active.map((order) => ({
            orderId: order.id,
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            speedKmh: speed,
            statusText,
            recordedAt,
          }));
          const reports = [...readQueue(), ...fresh].slice(-200);
          const saved = await apiFetch(`/api/crew/${token}/tracking`, { method: "POST", body: JSON.stringify({ reports }) });
          if (saved.ok) writeQueue([]);
          else writeQueue(reports);
          setPhase("on");
          schedule(30000);
        },
        (error) => {
          if (stopped) return;
          setPhase(error.code === 1 ? "denied" : "need");
          schedule(45000);
        },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 20000 }
      );
    };

    kickRef.current = () => {
      window.clearTimeout(timer);
      void run();
    };
    run();

    const onVis = () => {
      if (document.visibilityState === "visible") kickRef.current?.();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      stopped = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
      kickRef.current = null;
    };
  }, [t, token]);

  if (phase === "empty" || (orders.length === 0 && phase !== "paused")) return null;

  return (
    <Alert
      style={{ marginBottom: 12 }}
      type={phase === "denied" || phase === "paused" ? "warning" : "info"}
      message={
        <Space wrap>
          <Typography.Text strong>
            {phase === "on"
              ? t("track.reporting", "轨迹自动上报中")
              : phase === "paused"
                ? t("track.paused", "页面在后台，位置上报已暂停")
                : phase === "denied"
                  ? t("track.denied", "定位权限被拒绝")
                  : t("track.waiting", "正在获取位置")}
          </Typography.Text>
          <span>{orders.map((order) => order.orderNo).join("、")}</span>
          <Select
            size="small"
            value={statusKey}
            style={{ width: 140 }}
            onChange={setStatusKey}
            options={STATUS_KEYS.map((key) => ({ value: key, label: t(key, key) }))}
          />
          <Typography.Text type="secondary">
            {t("track.keep_open", "已点「前往提货」后持续上报（约 30 秒一次）。请保持本页打开；关掉浏览器会停止。")}
          </Typography.Text>
        </Space>
      }
    />
  );
}
