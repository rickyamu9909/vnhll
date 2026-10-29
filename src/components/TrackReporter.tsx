"use client";

import { useEffect, useRef, useState } from "react";
import { Alert, Select, Space, Typography } from "antd";
import { useI18n } from "@/components/I18nProvider";
import { apiFetch } from "@/lib/client";

type ActiveOrder = { id: string; orderNo: string; status: string };
type Queued = { orderId: string; lat: number; lng: number; speedKmh: number | null; statusText: string; recordedAt: string };

type NativeShell = { isNative?: boolean; setStatus?: (text: string) => void; start?: () => void };

function nativeShell(): NativeShell | null {
  if (typeof window === "undefined") return null;
  const shell = (window as Window & { DriverShell?: NativeShell }).DriverShell;
  return shell?.isNative ? shell : null;
}

const QUEUE_KEY = "ants_track_queue";
const STATUS_KEYS = ["track.going", "track.picked", "track.moving", "track.unloading", "track.arrived", "track.issue"] as const;

function readQueue(): Queued[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Queued[]) : [];
    return Array.isArray(parsed) ? parsed.slice(-200) : [];
  } catch {
    return [];
  }
}

function writeQueue(rows: Queued[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(rows.slice(-200)));
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
  const [native, setNative] = useState(false);
  const activeRef = useRef<ActiveOrder[]>([]);

  useEffect(() => {
    const shell = nativeShell();
    setNative(!!shell);
    let stopped = false;
    const sync = async () => {
      const res = await apiFetch<ActiveOrder[]>("/api/driver/tracking");
      if (stopped) return;
      const active = res.ok ? res.data || [] : [];
      activeRef.current = active;
      setOrders(active);
      setPhase(active.length ? "on" : "empty");
      if (shell && active.length) {
        shell.start?.();
        shell.setStatus?.(t(statusRef.current, "运输中"));
      }
    };
    sync();
    // 有任务 20s 刷一次，无任务 60s，减轻卡顿
    const timer = window.setInterval(() => {
      void sync();
    }, activeRef.current.length ? 20000 : 60000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [t]);

  useEffect(() => {
    nativeShell()?.setStatus?.(t(statusKey, "运输中"));
  }, [statusKey, t]);

  useEffect(() => {
    if (nativeShell()) return;
    let stopped = false;
    let timer = 0;

    const schedule = (ms: number) => {
      if (!stopped) timer = window.setTimeout(run, ms);
    };

    const run = async () => {
      const res = await apiFetch<ActiveOrder[]>("/api/driver/tracking");
      const active = res.ok ? res.data || [] : [];
      if (stopped) return;
      activeRef.current = active;
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
      // 低精度 + 允许缓存，避免每次等 GPS 把整页拖慢
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
          const saved = await apiFetch("/api/driver/tracking", { method: "POST", body: JSON.stringify({ reports }) });
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

    run();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [t]);

  if (phase === "empty" || orders.length === 0) return null;

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
          <Typography.Text type="secondary">
            {native
              ? t("track.native_on", "已点「前往提货」的订单持续上报；切屏或锁屏仍每 30 秒一次。通知栏「停止」可结束。")
              : t("track.keep_open", "已点「前往提货」后持续上报（约 30 秒一次）。请保持本页打开；关掉浏览器会停止。")}
          </Typography.Text>
        </Space>
      }
    />
  );
}
