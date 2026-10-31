"use client";

import { useEffect, useState } from "react";
import { Card, List, Space, Typography, message } from "antd";
import dayjs from "dayjs";
import { ActionButton } from "@/components/ActionButton";
import { DriverShell } from "@/components/DriverShell";
import { useI18n } from "@/components/I18nProvider";
import { apiFetch } from "@/lib/client";
import { localizeNoticeBody, localizeNoticeTitle } from "@/lib/localize";

type Note = { id: string; title: string; body: string; read: boolean; createdAt: string };

function parseMeta(body: string) {
  return {
    suggestId: body.match(/#suggest:([A-Za-z0-9_-]+)/)?.[1],
    negId: body.match(/#neg:([A-Za-z0-9_-]+)/)?.[1],
    href: body.match(/#href:(\/[^\s#]+)/)?.[1],
  };
}

function cleanBody(body: string) {
  return body.replace(/\n?#suggest:[^\s]+/g, "").replace(/\n?#neg:[^\s]+/g, "").replace(/\n?#href:[^\s]+/g, "").trim();
}

export default function DriverNotificationsPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<Note[]>([]);
  const [acting, setActing] = useState<string | null>(null);
  const load = async () => {
    const res = await apiFetch<Note[]>("/api/driver/notifications");
    if (!res.ok) message.error(res.message || t("msg.load_fail", "加载失败"));
    else setRows(res.data || []);
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const respondSuggest = async (note: Note, accept: boolean) => {
    const { suggestId } = parseMeta(note.body);
    if (!suggestId) return;
    setActing(note.id);
    const res = await apiFetch(`/api/suggestions/${suggestId}`, { method: "POST", body: JSON.stringify({ accept }) });
    setActing(null);
    if (!res.ok) return message.error(res.message || t("suggest.fail", "处理失败"));
    message.success(accept ? t("banner.ok_match", "已确认撮合") : t("banner.no_match", "已拒绝"));
    await apiFetch("/api/driver/notifications", { method: "POST", body: JSON.stringify({ ids: [note.id] }) });
    load();
  };

  const respondNeg = async (note: Note, accept: boolean) => {
    const { negId } = parseMeta(note.body);
    if (!negId) return;
    setActing(note.id);
    const res = await apiFetch(`/api/driver/negotiations/${negId}`, { method: "POST", body: JSON.stringify({ accept }) });
    setActing(null);
    if (!res.ok) return message.error(res.message || t("suggest.fail", "处理失败"));
    message.success(accept ? t("banner.ok_neg", "已接受协商，订单进入待执行") : t("banner.no_neg", "已拒绝协商"));
    await apiFetch("/api/driver/notifications", { method: "POST", body: JSON.stringify({ ids: [note.id] }) });
    load();
  };

  return (
    <DriverShell>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, gap: 8, flexWrap: "wrap" }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {t("nav.notes", "通知")}
        </Typography.Title>
        <ActionButton
          tone="primary"
          onClick={async () => {
            await apiFetch("/api/driver/notifications", { method: "POST", body: JSON.stringify({ all: true }) });
            message.success(t("msg.read_all", "已全部标为已读"));
            load();
          }}
        >
          {t("banner.read_all", "全部已读")}
        </ActionButton>
      </div>
      <Card>
        <List
          dataSource={rows}
          locale={{ emptyText: t("banner.empty", "暂无通知") }}
          renderItem={(item) => {
            const meta = parseMeta(item.body);
            const canSuggest = !!meta.suggestId && (item.title.includes("撮合") || item.title.includes("顺路"));
            const canNeg = !!meta.negId && item.title.includes("协商");
            const title = localizeNoticeTitle(item.title, t);
            const body = localizeNoticeBody(cleanBody(item.body), t);
            return (
              <List.Item
                actions={[
                  canSuggest ? (
                    <Space key="act" wrap>
                      <ActionButton tone="primary" loading={acting === item.id} onClick={() => respondSuggest(item, true)}>
                        {t("banner.confirm_match", "确认匹配")}
                      </ActionButton>
                      <ActionButton tone="danger" loading={acting === item.id} onClick={() => respondSuggest(item, false)}>
                        {t("banner.reject_match", "不匹配")}
                      </ActionButton>
                    </Space>
                  ) : canNeg ? (
                    <Space key="neg" wrap>
                      <ActionButton tone="primary" loading={acting === item.id} onClick={() => respondNeg(item, true)}>
                        {t("banner.accept_neg", "接受协商")}
                      </ActionButton>
                      <ActionButton tone="danger" loading={acting === item.id} onClick={() => respondNeg(item, false)}>
                        {t("banner.reject_neg", "拒绝")}
                      </ActionButton>
                    </Space>
                  ) : (
                    <ActionButton key="go" href={meta.href || "/driver/capacity"} tone="cyan">
                      {t("banner.go", "去处理")}
                    </ActionButton>
                  ),
                ]}
              >
                <List.Item.Meta
                  title={`${item.read ? "" : "· "}${title} · ${dayjs(item.createdAt).format("YYYY-MM-DD HH:mm")}`}
                  description={body}
                />
              </List.Item>
            );
          }}
        />
      </Card>
    </DriverShell>
  );
}
