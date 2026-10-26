"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Alert, Badge } from "antd";
import { apiFetch } from "@/lib/client";

type Note = { id: string; title: string; body: string; read: boolean; createdAt: string };

async function ensureBrowserNotify(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission === "default") {
    try {
      await Notification.requestPermission();
    } catch {
      return;
    }
  }
  if (Notification.permission === "granted") {
    try {
      new Notification(title, { body });
    } catch {
      /* ignore */
    }
  }
  const shell = (window as unknown as { DriverShell?: { notify?: (t: string, b: string) => void } }).DriverShell;
  shell?.notify?.(title, body);
}

export function PendingBanner({ href = "/driver/notifications" }: { href?: string }) {
  const [unread, setUnread] = useState(0);
  const [latest, setLatest] = useState<Note | null>(null);
  const seen = useState(() => new Set<string>())[0];

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const res = await apiFetch<Note[]>("/api/driver/notifications");
      if (!alive || !res.ok) return;
      const rows = res.data || [];
      const fresh = rows.filter((row) => !row.read);
      setUnread(fresh.length);
      setLatest(fresh[0] || rows[0] || null);
      for (const row of fresh.slice(0, 3)) {
        if (seen.has(row.id)) continue;
        seen.add(row.id);
        void ensureBrowserNotify(row.title, row.body);
      }
    };
    load();
    const timer = setInterval(load, 45000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [seen]);

  if (!unread && !latest) return null;
  return (
    <Alert
      type="warning"
      showIcon
      style={{ marginBottom: 12 }}
      message={
        <span>
          <Badge count={unread} size="small" offset={[6, 0]}>
            <span>待处理</span>
          </Badge>
          {latest ? `：${latest.title}` : ""}
        </span>
      }
      description={latest?.body}
      action={
        <Link href={href} style={{ whiteSpace: "nowrap" }}>
          查看
        </Link>
      }
    />
  );
}
