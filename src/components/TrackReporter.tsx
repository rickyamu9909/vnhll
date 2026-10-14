"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Select, Space, Typography } from "antd";
import { useI18n } from "@/components/I18nProvider";
import { apiFetch } from "@/lib/client";

type ActiveOrder = { id: string; orderNo: string; status: string };
type Queued = { orderId: string; lat: number; lng: number; speedKmh: number | null; statusText: string; recordedAt: string };

const QUEUE_KEY = "ants_track_queue";
const STATUS_KEYS = ["track.going", "track.picked", "track.moving", "track.unloading", "track.arrived", "track.issue"] as const;

function readQueue(): Queued[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Queued[]) : [];
    return Array.isArray(parsed) ? parsed.slice(-500) : [];
  } catch {
    return [];
  }
}

function writeQueue(rows: Queued[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(rows.slice(-500)));
  } catch {
    /* ignore quota */
  }
}

export function TrackReporter() {
  const { t } = useI18n();
  const [phase, setPhase] = useState<"boot" | "empty" | "need" | "on" | "denied">("empty");
  const [orders, setOrders] = useState<ActiveOrder[]>([]);
  const [statusKey, setStatusKey] = useState<(typeof STATUS_KEYS)[number]>("track.moving");
  const statusRef = useRef(statusKey);
  statusRef.current = statusKey;

  useEffect(() => {
    let stopped = false;
    let timer = 0;
    let delay = 30000;

    const schedule = (ms: number) => {
      if (!stopped) timer = window.setTimeout(run, ms);
    };

    const run = async () => {
      const res = await apiFetch<ActiveOrder[]>("/api/driver/tracking");
      const active = res.ok ? res.data || [] : [];
      if (stopped) return;
      setOrders(active);
      if (!active.length) {
        setPhase("empty");
        schedule(30000);
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
          const speed = Number.isFinite(pos.coords.speed) && pos.coords.speed != null && pos.coords.speed >= 0 ? Math.round(pos.coords.speed * 3.6) : null;
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
          const queued = readQueue();
          const reports = [...queued, ...fresh].slice(-500);
          const saved = await apiFetch("/api/driver/tracking", { method: "POST", body: JSON.stringify({ reports }) });
          if (saved.ok) {
            writeQueue([]);
            setPhase("on");
            delay = 30000;
          } else {
            writeQueue(reports);
            delay = Math.min(delay * 2, 120000);
            setPhase("on");
          }
          schedule(delay);
        },
        (error) => {
          if (stopped) return;
          setPhase(error.code === 1 ? "denied" : "need");
          delay = Math.min(Math.max(delay * 2, 30000), 120000);
          schedule(delay);
        },
        { enableHighAccuracy: false, timeout: 15000, maximumAge: 15000 }
      );
    };

    run();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [t]);

  if (phase === "empty") return null;

  return (
    <Alert
      style={{ marginBottom: 12 }}
      type={phase === "denied" ? "warning" : "info"}
      message={
        <Space wrap>
          <Typography.Text strong>
            {phase === "on" ? t("track.reporting", "轨迹自动上报中") : phase === "denied" ? t("track.denied", "定位权限被拒绝") : t("track.waiting", "正在获取位置")}
          </Typography.Text>
          <span>{orders.map((order) => order.orderNo).join("、")}</span>
          <Select
            size="small"
            value={statusKey}
            style={{ width: 140 }}
            onChange={setStatusKey}
            options={STATUS_KEYS.map((key) => ({ value: key, label: t(key, key) }))}
          />
          <Typography.Text type="secondary">{t("track.keep_open", "请保持本页打开，每 30 秒上报一次。关掉浏览器后会停止。")}</Typography.Text>
        </Space>
      }
    />
  );
}
