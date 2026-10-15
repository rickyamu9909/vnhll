"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button, Card, Modal, Space, Table, Tabs, Tooltip, Typography, message } from "antd";
import { CustomerShell } from "@/components/CustomerShell";
import { MatchSuggestions } from "@/components/MatchSuggestions";
import { orderColumns } from "@/components/OrderListBits";
import { QueryFields } from "@/components/QueryFields";
import { useI18n } from "@/components/I18nProvider";
import { apiFetch } from "@/lib/client";
import { CUSTOMER_NODE_TABS, ORDER_QUERY_FIELDS, orderInTab, orderMatches, type OrderListRow } from "@/lib/order-view";

const PAGE_SIZES = [15, 25, 50, 100, 500];
const EDITABLE = new Set(["PENDING_REVIEW", "REJECTED", "OPEN", "FAILED"]);
const CANCELABLE = new Set(["PENDING_REVIEW", "BIDDING", "REJECTED", "OPEN", "PENDING_CONFIRM", "FAILED"]);

export default function OrdersPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<OrderListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(15);
  const [tab, setTab] = useState("all");
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

  const shown = useMemo(() => rows.filter((row) => orderInTab(row, tab) && orderMatches(row, query)), [rows, tab, query]);

  return (
    <CustomerShell selected="orders">
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {t("nav.orders", "我的订单")}
        </Typography.Title>
        <Link href="/orders/new" prefetch>
          <Button type="primary">{t("nav.new_order", "新建订单")}</Button>
        </Link>
      </div>
      <MatchSuggestions />
      <Card>
        <Tabs activeKey={tab} onChange={setTab} items={CUSTOMER_NODE_TABS.map((item) => ({ key: item.key, label: item.label }))} />
        <QueryFields fields={ORDER_QUERY_FIELDS} onSearch={setQuery} />
        <Table
          rowKey="id"
          loading={loading}
          dataSource={shown}
          scroll={{ x: 1800 }}
          pagination={{
            pageSize,
            showSizeChanger: true,
            pageSizeOptions: PAGE_SIZES.map(String),
            showTotal: (total) => `共 ${total} 条`,
            onShowSizeChange: (_p, size) => setPageSize(size),
          }}
          columns={orderColumns(t, {
              title: "操作",
              width: 330,
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
                        {t("track.view", "查看轨迹")}
                      </Button>
                    </Link>
                    <Link href={`/orders/new?from=${r.id}`}>
                      <Button type="link" size="small">
                        复制新建
                      </Button>
                    </Link>
                    {canEdit ? (
                      <Link href={`/orders/${r.id}/edit`} prefetch>
                        <Button type="link" size="small">
                          {t("action.edit", "修改")}
                        </Button>
                      </Link>
                    ) : (
                      <Tooltip title="仅「待审核 / 已拒绝」可修改">
                        <Button type="link" size="small" disabled>
                          {t("action.edit", "修改")}
                        </Button>
                      </Tooltip>
                    )}
                    {canCancel ? (
                      <Button type="link" danger size="small" onClick={() => cancelOrder(r.id)}>
                        {t("action.cancel", "取消")}
                      </Button>
                    ) : (
                      <Tooltip title="运输中及之后请联系管理员取消">
                        <Button type="link" danger size="small" disabled>
                          {t("action.cancel", "取消")}
                        </Button>
                      </Tooltip>
                    )}
                  </Space>
                );
              },
            })}
        />
      </Card>
    </CustomerShell>
  );
}
