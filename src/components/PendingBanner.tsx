"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Badge, Space, message } from "antd";
import { ActionButton } from "@/components/ActionButton";
import { useI18n } from "@/components/I18nProvider";
import { apiFetch } from "@/lib/client";
import { localizeNoticeBody, localizeNoticeTitle } from "@/lib/localize";

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

function parseMeta(body: string) {
  const suggestId = body.match(/#suggest:([A-Za-z0-9_-]+)/)?.[1];
  const negId = body.match(/#neg:([A-Za-z0-9_-]+)/)?.[1];
  const href = body.match(/#href:(\/[^\s#]+)/)?.[1];
  return { suggestId, negId, href };
}

function cleanBody(body: string) {
  return body.replace(/\n?#suggest:[^\s]+/g, "").replace(/\n?#neg:[^\s]+/g, "").replace(/\n?#href:[^\s]+/g, "").trim();
}

function parseLink(note: Note, fallbackHref: string) {
  if (note.link) return note.link;
  const meta = parseMeta(note.body);
  if (meta.href) return meta.href;
  if (typeof window !== "undefined" && window.location.pathname.startsWith("/driver")) {
    return note.title.includes("撮合") || note.title.includes("顺路") || note.title.includes("协商") ? "/driver/capacity" : "/driver/orders";
  }
  return "/orders";
}

async function notifyOnce(note: Note, fallbackHref: string, title: string, body: string) {
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
    const n = new Notification(title, { body, tag: note.id });
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
  const { t } = useI18n();
  const [latest, setLatest] = useState<Note | null>(null);
  const [unread, setUnread] = useState(0);
  const [acting, setActing] = useState(false);

  const load = async () => {
    const res = await apiFetch<Note[]>(api);
    if (!res.ok) return;
    const rows = res.data || [];
    const fresh = rows.filter((row) => !row.read);
    const regIds = fresh.filter(isRegNote).map((n) => n.id);
    if (regIds.length) {
      await apiFetch(api, { method: "POST", body: JSON.stringify({ ids: regIds }) });
    }
    const actionable = fresh.filter((n) => !isRegNote(n));
    setUnread(actionable.length);
    setLatest(actionable[0] || null);
    if (actionable[0]) {
      const note = actionable[0];
      void notifyOnce(note, fallbackHref, localizeNoticeTitle(note.title, t), localizeNoticeBody(cleanBody(note.body), t));
    }
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 120000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, fallbackHref]);

  const markRead = async (ids: string[]) => {
    await apiFetch(api, { method: "POST", body: JSON.stringify({ ids }) });
  };

  const markAndOpen = async () => {
    if (!latest) return;
    await markRead([latest.id]);
    const href = parseLink(latest, fallbackHref);
    setLatest(null);
    setUnread((n) => Math.max(0, n - 1));
    router.push(href);
    load();
  };

  const respondSuggest = async (accept: boolean) => {
    if (!latest) return;
    const { suggestId } = parseMeta(latest.body);
    if (!suggestId) return markAndOpen();
    setActing(true);
    const res = await apiFetch(`/api/suggestions/${suggestId}`, {
      method: "POST",
      body: JSON.stringify({ accept }),
    });
    setActing(false);
    if (!res.ok) {
      message.error(res.message || t("suggest.fail", "处理失败"));
      return;
    }
    message.success(accept ? t("banner.ok_match", "已确认撮合") : t("banner.no_match", "已拒绝"));
    await markRead([latest.id]);
    setLatest(null);
    setUnread((n) => Math.max(0, n - 1));
    load();
    if (accept) router.push(fallbackHref.startsWith("/driver") ? "/driver/orders" : "/orders");
  };

  const respondNeg = async (accept: boolean) => {
    if (!latest) return;
    const { negId } = parseMeta(latest.body);
    if (!negId) return markAndOpen();
    setActing(true);
    const res = await apiFetch(`/api/driver/negotiations/${negId}`, {
      method: "POST",
      body: JSON.stringify({ accept }),
    });
    setActing(false);
    if (!res.ok) {
      message.error(res.message || t("suggest.fail", "处理失败"));
      return;
    }
    message.success(accept ? t("banner.ok_neg", "已接受协商，订单进入待执行") : t("banner.no_neg", "已拒绝协商"));
    await markRead([latest.id]);
    setLatest(null);
    setUnread((n) => Math.max(0, n - 1));
    load();
    if (accept) router.push("/driver/orders");
  };

  if (!latest || unread <= 0) return null;

  const meta = parseMeta(latest.body);
  const canSuggest = !!meta.suggestId && (latest.title.includes("撮合") || latest.title.includes("顺路"));
  const canNeg = !!meta.negId && latest.title.includes("协商");
  const title = localizeNoticeTitle(latest.title, t);
  const body = localizeNoticeBody(cleanBody(latest.body), t);

  return (
    <Alert
      type="warning"
      showIcon
      closable
      onClose={async () => {
        await markRead([latest.id]);
        setLatest(null);
        setUnread((n) => Math.max(0, n - 1));
      }}
      style={{ marginBottom: 12 }}
      message={
        <span>
          <Badge count={unread} size="small" offset={[6, 0]}>
            <span>{t("banner.pending", "待处理")}</span>
          </Badge>
          {`：${title}`}
        </span>
      }
      description={body}
      action={
        <Space direction="vertical" size={6}>
          {canSuggest ? (
            <>
              <ActionButton tone="primary" loading={acting} onClick={() => respondSuggest(true)}>
                {t("banner.confirm_match", "确认匹配")}
              </ActionButton>
              <ActionButton tone="danger" loading={acting} onClick={() => respondSuggest(false)}>
                {t("banner.reject_match", "不匹配")}
              </ActionButton>
            </>
          ) : canNeg ? (
            <>
              <ActionButton tone="primary" loading={acting} onClick={() => respondNeg(true)}>
                {t("banner.accept_neg", "接受协商")}
              </ActionButton>
              <ActionButton tone="danger" loading={acting} onClick={() => respondNeg(false)}>
                {t("banner.reject_neg", "拒绝")}
              </ActionButton>
            </>
          ) : (
            <ActionButton tone="primary" onClick={markAndOpen}>
              {t("banner.view", "查看")}
            </ActionButton>
          )}
        </Space>
      }
    />
  );
}
