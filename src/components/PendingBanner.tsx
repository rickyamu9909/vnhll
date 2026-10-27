"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Badge, Button } from "antd";
import { apiFetch } from "@/lib/client";

type Note = { id: string; title: string; body: string; read: boolean; createdAt: string; link?: string | null };

const NOTIFIED_KEY = "ants_notified_ids";
const REG_TITLES = ["注册已通过", "注册未通过"];

function loadNotified() {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(NOTIFIED_KEY) || "[]"));
  } catch {
    return new Set<string>();
  }
}

function saveNotified(set: Set<string>) {
  localStorage.setItem(NOTIFIED_KEY, JSON.stringify([...set].slice(-200)));
}

function isRegNote(note: Note) {
  return REG_TITLES.some((t) => note.title.includes(t));
}

function parseLink(note: Note, fallbackHref: string) {
  if (note.link) return note.link;
  const match = note.body.match(/ANTS-\d{8}-\d+/);
  if (!match) return fallbackHref;
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/driver")) {
    return `/driver/orders`;
  }
  return `/orders`;
}

async function notifyOnce(note: Note, fallbackHref: string) {
  if (typeof window === "undefined") return;
  if (isRegNote(note)) return;
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
      window.location.href = parseLink(note, fallbackHref);
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
    // 已登录用户不再提示「注册已通过」——自动标已读
    const regIds = fresh.filter(isRegNote).map((n) => n.id);
    if (regIds.length) {
      await apiFetch(api, { method: "POST", body: JSON.stringify({ ids: regIds }) });
    }
    const actionable = fresh.filter((n) => !isRegNote(n));
    setUnread(actionable.length);
    setLatest(actionable[0] || null);
    if (actionable[0]) void notifyOnce(actionable[0], fallbackHref);
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 120000);
    return () => clearInterval(timer);
  }, [api, fallbackHref]);

  const markAndOpen = async () => {
    if (!latest) return;
    await apiFetch(api, { method: "POST", body: JSON.stringify({ ids: [latest.id] }) });
    const href = parseLink(latest, fallbackHref);
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
        <Button type="primary" size="small" onClick={markAndOpen}>
          查看
        </Button>
      }
    />
  );
}
