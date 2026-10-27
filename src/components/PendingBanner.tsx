"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Badge, Button } from "antd";
import { apiFetch } from "@/lib/client";

type Note = { id: string; title: string; body: string; read: boolean; createdAt: string; link?: string | null };

const NOTIFIED_KEY = "ants_notified_ids";

function loadNotified() {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(NOTIFIED_KEY) || "[]"));
  } catch {
    return new Set<string>();
  }
}

function saveNotified(set: Set<string>) {
  const arr = [...set].slice(-200);
  localStorage.setItem(NOTIFIED_KEY, JSON.stringify(arr));
}

function parseLink(note: Note) {
  if (note.link) return note.link;
  const match = note.body.match(/ANTS-\d{8}-\d+/);
  if (match && note.body.includes("订单")) {
    if (typeof window !== "undefined" && window.location.pathname.startsWith("/driver")) {
      return `/driver/orders?q=${encodeURIComponent(match[0])}`;
    }
    return `/orders?q=${encodeURIComponent(match[0])}`;
  }
  return null;
}

async function notifyOnce(note: Note) {
  if (typeof window === "undefined") return;
  const seen = loadNotified();
  if (seen.has(note.id)) return;
  seen.add(note.id);
  saveNotified(seen);
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    try {
      await Notification.requestPermission();
    } catch {
      return;
    }
  }
  if (Notification.permission !== "granted") return;
  try {
    const n = new Notification(note.title, { body: note.body, tag: note.id });
    n.onclick = () => {
      window.focus();
      const href = parseLink(note);
      if (href) window.location.href = href;
      n.close();
    };
  } catch {
    /* ignore */
  }
}

export function PendingBanner({
  api = "/api/notifications",
  fallbackHref = "/orders",
}: {
  api?: string;
  fallbackHref?: string;
}) {
  const router = useRouter();
  const [latest, setLatest] = useState<Note | null>(null);
  const [unread, setUnread] = useState(0);

  const load = async () => {
    const res = await apiFetch<Note[]>(api);
    if (!res.ok) return;
    const rows = res.data || [];
    const fresh = rows.filter((row) => !row.read);
    setUnread(fresh.length);
    setLatest(fresh[0] || null);
    if (fresh[0]) void notifyOnce(fresh[0]);
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 90000);
    return () => clearInterval(timer);
  }, [api]);

  const markAndOpen = async () => {
    if (!latest) return;
    await apiFetch(api, { method: "POST", body: JSON.stringify({ ids: [latest.id] }) });
    const href = parseLink(latest) || fallbackHref;
    setLatest(null);
    setUnread((n) => Math.max(0, n - 1));
    router.push(href);
    load();
  };

  if (!latest || unread <= 0) return null;
  return (
    <Alert
      type="warning"
      showIcon
      closable
      onClose={async () => {
        await apiFetch(api, { method: "POST", body: JSON.stringify({ ids: [latest.id] }) });
        setLatest(null);
        setUnread((n) => Math.max(0, n - 1));
      }}
      style={{ marginBottom: 12 }}
      message={
        <span>
          <Badge count={unread} size="small" offset={[6, 0]}>
            <span>待处理</span>
          </Badge>
          {`：${latest.title}`}
        </span>
      }
      description={latest.body}
      action={
        <Button type="link" size="small" onClick={markAndOpen}>
          查看
        </Button>
      }
    />
  );
}
