"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, Table, Tabs, Typography, message } from "antd";
import { DriverShell } from "@/components/DriverShell";
import { orderColumns, orderLink } from "@/components/OrderListBits";
import { QueryFields } from "@/components/QueryFields";
import { apiFetch } from "@/lib/client";
import { useI18n } from "@/components/I18nProvider";
import { ORDER_QUERY_FIELDS, TASK_NODE_TABS, orderInTab, orderMatches, type OrderListRow } from "@/lib/order-view";

export default function TasksPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<OrderListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("all");
  const [query, setQuery] = useState<Record<string, string>>({});
  useEffect(() => {
    (async () => {
      const res = await apiFetch<OrderListRow[]>("/api/driver/orders?scope=tasks");
      setLoading(false);
      if (!res.ok) message.error(res.message || "加载失败");
      else setRows(res.data || []);
    })();
  }, []);
  const shown = useMemo(() => rows.filter((row) => orderInTab(row, tab) && orderMatches(row, query)), [rows, tab, query]);
  return (
    <DriverShell>
      <Typography.Title level={3}>我的任务</Typography.Title>
      <Card>
        <Tabs activeKey={tab} onChange={setTab} items={TASK_NODE_TABS.map((item) => ({ key: item.key, label: item.label }))} />
        <QueryFields fields={ORDER_QUERY_FIELDS} onSearch={setQuery} />
        <Table
          rowKey="id"
          loading={loading}
          locale={{ emptyText: "暂无待执行任务。轨迹条上的订单会出现在这里。" }}
          dataSource={shown}
          scroll={{ x: 1600 }}
          pagination={{ pageSize: 15, showSizeChanger: true, pageSizeOptions: ["15", "25", "50", "100", "500"], showTotal: (total) => `共 ${total} 条` }}
          columns={orderColumns(t, { title: "操作", width: 90, fixed: "right", render: (_, row) => orderLink(`/driver/orders/${row.id}`, "执行") })}
        />
      </Card>
    </DriverShell>
  );
}
