"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Card, Collapse, Modal, Space, Table, Tabs, Tooltip, Typography, message } from "antd";
import dayjs from "dayjs";
import { ActionButton } from "@/components/ActionButton";
import { CustomerShell } from "@/components/CustomerShell";
import { MatchSuggestions } from "@/components/MatchSuggestions";
import { orderColumns } from "@/components/OrderListBits";
import { QueryFields } from "@/components/QueryFields";
import { useI18n } from "@/components/I18nProvider";
import { apiFetch, pathLabel, statusLabel } from "@/lib/client";
import { orderMatches, orderQueryFields, type OrderListRow } from "@/lib/order-view";
import { formatVnd } from "@/lib/money";

const PAGE_SIZES = [15, 25, 50, 100, 500];
const EDITABLE = new Set(["PENDING_REVIEW", "REJECTED", "OPEN", "FAILED"]);
const CANCELABLE = new Set(["PENDING_REVIEW", "BIDDING", "REJECTED", "OPEN", "PENDING_CONFIRM", "FAILED"]);

const BUCKETS = [
  { key: "active", labelKey: "tab.active" },
  { key: "todo", labelKey: "tab.todo" },
  { key: "history", labelKey: "tab.history" },
];

function inBucket(row: OrderListRow, bucket: string) {
  if (bucket === "todo") return ["PENDING_CONFIRM", "DELIVERED"].includes(row.status);
  if (bucket === "history") return ["COMPLETED", "CANCELLED", "FAILED", "REJECTED"].includes(row.status);
  return ["OPEN", "BIDDING", "PENDING_EXECUTION", "IN_TRANSIT", "MATCHED", "LOCKED", "PENDING_AUDIT", "PENDING_REVIEW"].includes(row.status);
}

function nextAction(row: OrderListRow, t: (k: string, f?: string) => string) {
  if (row.status === "PENDING_CONFIRM") return t("hint.confirm_bid", "请确认报价");
  if (row.status === "DELIVERED") return t("hint.confirm_done", "请确认完成");
  if (row.status === "OPEN" || row.status === "BIDDING") return t("hint.matching", "匹配中，可延长或改单");
  if (row.status === "FAILED" || row.status === "REJECTED") return t("hint.republish", "可改价重发");
  if (row.status === "PENDING_EXECUTION" || row.status === "IN_TRANSIT") return t("hint.track", "可查看轨迹");
  return "";
}

export default function OrdersPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<OrderListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(15);
  const [tab, setTab] = useState("active");
  const [query, setQuery] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const res = await apiFetch<OrderListRow[]>("/api/orders");
    setLoading(false);
    if (!res.ok) {
      message.error(res.message || t("common.loading_fail", "加载失败"));
      return;
    }
    setRows(res.data || []);
  };

  useEffect(() => {
    load();
  }, []);

  const cancelOrder = (id: string) => {
    Modal.confirm({
      title: t("order.cancel_title", "确认取消该订单？"),
      okText: t("order.cancel_ok", "确认取消"),
      okButtonProps: { danger: true },
      cancelText: t("action.cancel", "取消"),
      onOk: async () => {
        const res = await apiFetch(`/api/orders/${id}`, {
          method: "POST",
          body: JSON.stringify({ action: "cancel" }),
        });
        if (!res.ok) {
          message.error(res.message || t("common.op_fail", "操作失败"));
          return;
        }
        message.success(t("order.cancelled", "订单已取消"));
        load();
      },
    });
  };

  const shown = useMemo(() => rows.filter((row) => inBucket(row, tab) && orderMatches(row, query, t)), [rows, tab, query, t]);

  return (
    <CustomerShell selected="orders">
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, gap: 8, flexWrap: "wrap" }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {t("nav.orders", "我的订单")}
        </Typography.Title>
        <ActionButton href="/orders/new" tone="primary">
          {t("nav.new_order", "新建订单")}
        </ActionButton>
      </div>
      <MatchSuggestions />
      <Space direction="vertical" style={{ width: "100%" }} size={12} className="orders-mobile-cards">
        {shown.slice(0, 8).map((row) => (
          <Card key={row.id} size="small" styles={{ body: { padding: 14 } }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <Typography.Text strong>{row.orderNo}</Typography.Text>
              <span>{statusLabel(row.status, t)}</span>
            </div>
            <div style={{ color: "#475569", fontSize: 13, marginTop: 6 }}>
              {(row.originAddress || row.pickupAddress || "-") + " → " + (row.destAddress || row.deliveryAddress || "-")}
            </div>
            <div style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>
              {pathLabel(row.matchPath, t)}
              {row.pickupAt ? ` · ${dayjs(row.pickupAt).format("MM-DD HH:mm")}` : ""}
              {` · ${formatVnd(row.dealPriceVnd || row.targetPriceVnd || row.customerBidVnd || "")}`}
            </div>
            {nextAction(row, t) ? <div style={{ marginTop: 6, color: "#b45309", fontSize: 13 }}>{nextAction(row, t)}</div> : null}
            <Space wrap style={{ marginTop: 10 }}>
              <ActionButton href={`/orders/${row.id}`} tone="primary">
                {t("action.detail", "详情")}
              </ActionButton>
              {["FAILED", "REJECTED"].includes(row.status) ? (
                <ActionButton href={`/orders/new?from=${row.id}`} tone="orange">
                  {t("order.republish", "改价重发")}
                </ActionButton>
              ) : null}
              <ActionButton href={`/orders/${row.id}/track`} tone="cyan">
                {t("action.track", "轨迹")}
              </ActionButton>
            </Space>
          </Card>
        ))}
      </Space>
      <Card style={{ marginTop: 12 }}>
        <Tabs activeKey={tab} onChange={setTab} items={BUCKETS.map((item) => ({ key: item.key, label: t(item.labelKey) }))} />
        <Collapse
          ghost
          items={[
            {
              key: "advanced",
              label: t("common.advanced", "高级查询"),
              children: <QueryFields fields={orderQueryFields(t)} onSearch={setQuery} />,
            },
          ]}
        />
        <Table
          className="orders-desktop-table"
          rowKey="id"
          loading={loading}
          dataSource={shown}
          scroll={{ x: 1600 }}
          pagination={{
            pageSize,
            showSizeChanger: true,
            pageSizeOptions: PAGE_SIZES.map(String),
            showTotal: (total) => t("common.total", "共 {n} 条").replace("{n}", String(total)),
            onShowSizeChange: (_p, size) => setPageSize(size),
          }}
          columns={orderColumns(t, {
            title: t("order.op", "操作"),
            width: 280,
            fixed: "right",
            render: (_, r) => {
              const canEdit = EDITABLE.has(r.status);
              const canCancel = CANCELABLE.has(r.status);
              return (
                <Space size={6} wrap>
                  <ActionButton href={`/orders/${r.id}`} tone="primary">
                    {t("action.detail", "详情")}
                  </ActionButton>
                  <ActionButton href={`/orders/${r.id}/track`} tone="cyan">
                    {t("action.track", "轨迹")}
                  </ActionButton>
                  {["FAILED", "REJECTED"].includes(r.status) ? (
                    <ActionButton href={`/orders/new?from=${r.id}`} tone="orange">
                      {t("order.republish", "改价重发")}
                    </ActionButton>
                  ) : null}
                  {canEdit ? (
                    <ActionButton href={`/orders/${r.id}/edit`} tone="default">
                      {t("action.edit", "修改")}
                    </ActionButton>
                  ) : (
                    <Tooltip title={t("hint.no_edit", "当前状态不可修改")}>
                      <Button size="small" disabled>
                        {t("action.edit", "修改")}
                      </Button>
                    </Tooltip>
                  )}
                  {canCancel ? (
                    <ActionButton tone="danger" onClick={() => cancelOrder(r.id)}>
                      {t("action.cancel", "取消")}
                    </ActionButton>
                  ) : null}
                </Space>
              );
            },
          })}
        />
      </Card>
      <style jsx global>{`
        @media (max-width: 768px) {
          .orders-desktop-table {
            display: none;
          }
        }
        @media (min-width: 769px) {
          .orders-mobile-cards {
            display: none !important;
          }
        }
      `}</style>
    </CustomerShell>
  );
}
