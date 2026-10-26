"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button, Card, Collapse, Modal, Space, Table, Tabs, Tooltip, Typography, message } from "antd";
import dayjs from "dayjs";
import { CustomerShell } from "@/components/CustomerShell";
import { MatchSuggestions } from "@/components/MatchSuggestions";
import { orderColumns } from "@/components/OrderListBits";
import { QueryFields } from "@/components/QueryFields";
import { useI18n } from "@/components/I18nProvider";
import { apiFetch, pathLabel, statusLabel } from "@/lib/client";
import { ORDER_QUERY_FIELDS, orderMatches, type OrderListRow } from "@/lib/order-view";
import { formatVnd } from "@/lib/money";

const PAGE_SIZES = [15, 25, 50, 100, 500];
const EDITABLE = new Set(["PENDING_REVIEW", "REJECTED", "OPEN", "FAILED"]);
const CANCELABLE = new Set(["PENDING_REVIEW", "BIDDING", "REJECTED", "OPEN", "PENDING_CONFIRM", "FAILED"]);

const BUCKETS = [
  { key: "active", label: "进行中" },
  { key: "todo", label: "待处理" },
  { key: "history", label: "历史" },
];

function inBucket(row: OrderListRow, bucket: string) {
  if (bucket === "todo") return ["PENDING_CONFIRM", "DELIVERED"].includes(row.status);
  if (bucket === "history") return ["COMPLETED", "CANCELLED", "FAILED", "REJECTED"].includes(row.status);
  return ["OPEN", "BIDDING", "PENDING_EXECUTION", "IN_TRANSIT", "MATCHED", "LOCKED", "PENDING_AUDIT", "PENDING_REVIEW"].includes(row.status);
}

function nextAction(row: OrderListRow) {
  if (row.status === "PENDING_CONFIRM") return "请确认报价";
  if (row.status === "DELIVERED") return "请确认完成";
  if (row.status === "OPEN" || row.status === "BIDDING") return "匹配中，可延长或改单";
  if (row.status === "FAILED" || row.status === "REJECTED") return "可改价重发";
  if (row.status === "PENDING_EXECUTION" || row.status === "IN_TRANSIT") return "可查看轨迹";
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
      message.error(res.message || "加载失败");
      return;
    }
    setRows(res.data || []);
  };

  useEffect(() => {
    load();
  }, []);

  const cancelOrder = (id: string) => {
    Modal.confirm({
      title: "确认取消该订单？",
      okText: "确认取消",
      okButtonProps: { danger: true },
      onOk: async () => {
        const res = await apiFetch(`/api/orders/${id}`, {
          method: "POST",
          body: JSON.stringify({ action: "cancel" }),
        });
        if (!res.ok) {
          message.error(res.message || "取消失败");
          return;
        }
        message.success("订单已取消");
        load();
      },
    });
  };

  const shown = useMemo(() => rows.filter((row) => inBucket(row, tab) && orderMatches(row, query)), [rows, tab, query]);

  return (
    <CustomerShell selected="orders">
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, gap: 8, flexWrap: "wrap" }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {t("nav.orders", "我的订单")}
        </Typography.Title>
        <Link href="/orders/new" prefetch>
          <Button type="primary">{t("nav.new_order", "新建订单")}</Button>
        </Link>
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
              {pathLabel(row.matchPath)}
              {row.pickupAt ? ` · ${dayjs(row.pickupAt).format("MM-DD HH:mm")}` : ""}
              {` · ${formatVnd(row.dealPriceVnd || row.targetPriceVnd || row.customerBidVnd || "")}`}
            </div>
            {nextAction(row) ? <div style={{ marginTop: 6, color: "#b45309", fontSize: 13 }}>{nextAction(row)}</div> : null}
            <Space wrap style={{ marginTop: 10 }}>
              <Link href={`/orders/${row.id}`}>
                <Button size="small" type="primary">
                  详情
                </Button>
              </Link>
              {["FAILED", "REJECTED"].includes(row.status) ? (
                <Link href={`/orders/new?from=${row.id}`}>
                  <Button size="small">改价重发</Button>
                </Link>
              ) : null}
              <Link href={`/orders/${row.id}/track`}>
                <Button size="small">轨迹</Button>
              </Link>
            </Space>
          </Card>
        ))}
      </Space>
      <Card style={{ marginTop: 12 }}>
        <Tabs activeKey={tab} onChange={setTab} items={BUCKETS.map((item) => ({ key: item.key, label: item.label }))} />
        <Collapse
          ghost
          items={[
            {
              key: "advanced",
              label: "高级查询",
              children: <QueryFields fields={ORDER_QUERY_FIELDS} onSearch={setQuery} />,
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
            showTotal: (total) => `共 ${total} 条`,
            onShowSizeChange: (_p, size) => setPageSize(size),
          }}
          columns={orderColumns(t, {
            title: "操作",
            width: 280,
            fixed: "right",
            render: (_, r) => {
              const canEdit = EDITABLE.has(r.status);
              const canCancel = CANCELABLE.has(r.status);
              return (
                <Space size={4} wrap>
                  <Link href={`/orders/${r.id}`} prefetch>
                    <Button type="link" size="small">
                      详情
                    </Button>
                  </Link>
                  <Link href={`/orders/${r.id}/track`}>
                    <Button type="link" size="small">
                      轨迹
                    </Button>
                  </Link>
                  {["FAILED", "REJECTED"].includes(r.status) ? (
                    <Link href={`/orders/new?from=${r.id}`}>
                      <Button type="link" size="small">
                        改价重发
                      </Button>
                    </Link>
                  ) : null}
                  {canEdit ? (
                    <Link href={`/orders/${r.id}/edit`} prefetch>
                      <Button type="link" size="small">
                        修改
                      </Button>
                    </Link>
                  ) : (
                    <Tooltip title="当前状态不可修改">
                      <Button type="link" size="small" disabled>
                        修改
                      </Button>
                    </Tooltip>
                  )}
                  {canCancel ? (
                    <Button type="link" danger size="small" onClick={() => cancelOrder(r.id)}>
                      取消
                    </Button>
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
