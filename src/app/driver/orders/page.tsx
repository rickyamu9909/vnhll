"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Card, Space, Table, Tabs, Typography, message } from "antd";
import { DriverShell } from "@/components/DriverShell";
import { MatchSuggestions } from "@/components/MatchSuggestions";
import { orderColumns, orderLink } from "@/components/OrderListBits";
import { QueryFields } from "@/components/QueryFields";
import { apiFetch } from "@/lib/client";
import { useI18n } from "@/components/I18nProvider";
import { DRIVER_NODE_TABS, orderInTab, orderMatches, orderQueryFields, type OrderListRow } from "@/lib/order-view";

export default function MyDriverOrders() {
  const { t } = useI18n();
  const [rows, setRows] = useState<OrderListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("all");
  const [query, setQuery] = useState<Record<string, string>>({});
  const [copyingId, setCopyingId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const res = await apiFetch<OrderListRow[]>("/api/driver/orders?scope=mine");
      setLoading(false);
      if (!res.ok) message.error(res.message || t("common.loading_fail", "加载失败"));
      else setRows(res.data || []);
    })();
  }, [t]);

  const copyCrewLink = async (orderId: string) => {
    setCopyingId(orderId);
    const res = await apiFetch<{ url: string }>(`/api/driver/orders/${orderId}/crew-link`, { method: "POST" });
    setCopyingId(null);
    if (!res.ok || !res.data?.url) {
      message.error(res.message || t("crew.copy_fail", "复制跟踪链接失败"));
      return;
    }
    try {
      await navigator.clipboard.writeText(res.data.url);
      message.success(t("crew.copied", "已复制司机跟踪链接（无价格）"));
    } catch {
      message.info(res.data.url);
    }
  };

  const shown = useMemo(() => rows.filter((row) => orderInTab(row, tab) && orderMatches(row, query, t)), [rows, tab, query, t]);
  return (
    <DriverShell>
      <Typography.Title level={3}>{t("driver.mine", "我的订单")}</Typography.Title>
      <MatchSuggestions />
      <Card>
        <Tabs activeKey={tab} onChange={setTab} items={DRIVER_NODE_TABS.map((item) => ({ key: item.key, label: t(item.labelKey) }))} />
        <QueryFields fields={orderQueryFields(t)} onSearch={setQuery} />
        <Table
          rowKey="id"
          loading={loading}
          dataSource={shown}
          scroll={{ x: 1680 }}
          pagination={{
            pageSize: 15,
            showSizeChanger: true,
            pageSizeOptions: ["15", "25", "50", "100", "500"],
            showTotal: (total) => t("common.total", "共 {n} 条").replace("{n}", String(total)),
          }}
          columns={orderColumns(t, {
            title: t("order.op", "操作"),
            width: 220,
            fixed: "right",
            render: (_, row) => (
              <Space size={4} wrap>
                {orderLink(`/driver/orders/${row.id}`, t("action.detail", "详情"))}
                <Button size="small" loading={copyingId === row.id} onClick={() => void copyCrewLink(row.id)}>
                  {t("crew.copy_link_short", "跟踪链接")}
                </Button>
              </Space>
            ),
          })}
        />
      </Card>
    </DriverShell>
  );
}
