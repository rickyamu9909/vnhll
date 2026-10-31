"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, Modal, Space, Table, Typography, message } from "antd";
import { ActionButton } from "@/components/ActionButton";
import { DriverShell } from "@/components/DriverShell";
import { MatchSuggestions } from "@/components/MatchSuggestions";
import { useI18n } from "@/components/I18nProvider";
import { QueryFields } from "@/components/QueryFields";
import { apiFetch, vehicleLabel } from "@/lib/client";
import { localizeCapStatus } from "@/lib/localize";
import { includesText } from "@/lib/order-view";
import { formatVnd } from "@/lib/money";

type Row = {
  id: string;
  location: string;
  destPreference?: string | null;
  vehicleType?: string | null;
  expectedPriceVnd: string;
  status: string;
  orderId?: string | null;
  negotiations: Array<{ id: string; status: string; priceVnd: string; orderId?: string | null }>;
};

export default function CapacityListPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<Row[]>([]);
  const [query, setQuery] = useState<Record<string, string>>({});
  const load = async () => {
    const res = await apiFetch<Row[]>("/api/driver/capacity");
    if (!res.ok) message.error(res.message || t("msg.load_fail", "加载失败"));
    else setRows(res.data || []);
  };
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const shown = useMemo(
    () =>
      rows.filter(
        (row) =>
          includesText(row.location, query.location) &&
          includesText(row.destPreference, query.dest) &&
          includesText(`${row.vehicleType || ""} ${row.vehicleType ? vehicleLabel(row.vehicleType, t) : ""}`, query.vehicle) &&
          includesText(row.expectedPriceVnd, query.price) &&
          includesText(`${row.status} ${localizeCapStatus(row.status, t)}`, query.status)
      ),
    [rows, query, t]
  );
  return (
    <DriverShell>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <Typography.Title level={3}>{t("cap.mine", "我的运力")}</Typography.Title>
        <ActionButton href="/driver/capacity/new" tone="primary">
          {t("cap.title", "发布运力")}
        </ActionButton>
      </div>
      <MatchSuggestions />
      <Card>
        <QueryFields
          fields={[
            { name: "location", placeholder: t("cap.location", "空车位置") },
            { name: "dest", placeholder: t("cap.dest_pref", "目的偏好") },
            { name: "vehicle", placeholder: t("form.vehicle", "车型") },
            { name: "price", placeholder: t("cap.expected", "期望价") },
            { name: "status", placeholder: t("form.status", "状态") },
          ]}
          onSearch={setQuery}
        />
        <Table
          rowKey="id"
          dataSource={shown}
          columns={[
            { title: t("cap.location", "空车位置"), dataIndex: "location" },
            { title: t("cap.dest_pref", "目的偏好"), dataIndex: "destPreference", render: (value) => value || "-" },
            { title: t("form.vehicle", "车型"), dataIndex: "vehicleType", render: (value) => (value ? vehicleLabel(value, t) : "-") },
            { title: t("cap.expected", "期望价"), dataIndex: "expectedPriceVnd", render: (v) => formatVnd(v) },
            { title: t("form.status", "状态"), dataIndex: "status", render: (value) => localizeCapStatus(value, t) },
            {
              title: t("admin.op", "操作"),
              render: (_, row) => {
                const orderId = row.orderId || row.negotiations.find((item) => item.orderId)?.orderId;
                return (
                  <Space size={6} wrap>
                    <ActionButton href={`/driver/capacity/${row.id}`} tone="primary">
                      {t("action.detail", "详情")}
                    </ActionButton>
                    {row.status === "OPEN" ? (
                      <ActionButton href={`/driver/capacity/${row.id}/edit`} tone="cyan">
                        {t("cap.edit", "编辑")}
                      </ActionButton>
                    ) : null}
                    {row.status === "OPEN" ? (
                      <ActionButton
                        tone="danger"
                        onClick={() => {
                          Modal.confirm({
                            title: t("cap.cancel_title", "确认取消这条运力？"),
                            content: t("cap.cancel_body", "取消后客户不能再对它发起匹配。"),
                            okText: t("action.cancel_confirm", "确认取消"),
                            okButtonProps: { danger: true },
                            onOk: async () => {
                              const res = await apiFetch(`/api/driver/capacity/${row.id}`, {
                                method: "POST",
                                body: JSON.stringify({ action: "cancel" }),
                              });
                              if (!res.ok) message.error(res.message || t("msg.fail", "失败"));
                              else load();
                            },
                          });
                        }}
                      >
                        {t("cap.cancel", "取消")}
                      </ActionButton>
                    ) : null}
                    {orderId ? (
                      <ActionButton href={`/driver/orders/${orderId}`} tone="green">
                        {t("cap.view_order", "查看订单")}
                      </ActionButton>
                    ) : null}
                  </Space>
                );
              },
            },
            {
              title: t("cap.nego", "协商"),
              render: (_, r) =>
                r.negotiations
                  .filter((n) => n.status === "PENDING")
                  .map((n) => (
                    <div key={n.id} style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      <span>{formatVnd(n.priceVnd)}</span>
                      <ActionButton
                        tone="green"
                        onClick={async () => {
                          const res = await apiFetch(`/api/driver/negotiations/${n.id}`, {
                            method: "POST",
                            body: JSON.stringify({ accept: true }),
                          });
                          if (!res.ok) message.error(res.message || t("msg.fail", "失败"));
                          else load();
                        }}
                      >
                        {t("action.accept_yes", "接受")}
                      </ActionButton>
                      <ActionButton
                        tone="danger"
                        onClick={async () => {
                          const res = await apiFetch(`/api/driver/negotiations/${n.id}`, {
                            method: "POST",
                            body: JSON.stringify({ accept: false }),
                          });
                          if (!res.ok) message.error(res.message || t("msg.fail", "失败"));
                          else load();
                        }}
                      >
                        {t("banner.reject_neg", "拒绝")}
                      </ActionButton>
                    </div>
                  )),
            },
          ]}
        />
      </Card>
    </DriverShell>
  );
}
