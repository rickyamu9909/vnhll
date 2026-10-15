"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, Table, Typography, message } from "antd";
import { DriverShell } from "@/components/DriverShell";
import { orderColumns, orderLink } from "@/components/OrderListBits";
import { QueryFields } from "@/components/QueryFields";
import { apiFetch } from "@/lib/client";
import { useI18n } from "@/components/I18nProvider";
import { ORDER_QUERY_FIELDS, orderMatches, type OrderListRow } from "@/lib/order-view";

export default function DriverHallPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<OrderListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState<Record<string, string>>({});
  useEffect(() => {
    (async () => {
      const res = await apiFetch<OrderListRow[]>("/api/driver/orders");
      setLoading(false);
      if (!res.ok) message.error(res.message || "加载失败");
      else setRows(res.data || []);
    })();
  }, []);
  const shown = useMemo(() => rows.filter((row) => orderMatches(row, query)), [rows, query]);
  return (
    <DriverShell>
      <Typography.Title level={3}>订单中心</Typography.Title>
      <Card>
        <QueryFields fields={ORDER_QUERY_FIELDS} onSearch={setQuery} />
        <Table
          rowKey="id"
          loading={loading}
          dataSource={shown}
          scroll={{ x: 1600 }}
          pagination={{ pageSize: 15, showSizeChanger: true, pageSizeOptions: ["15", "25", "50", "100", "500"], showTotal: (total) => `共 ${total} 条` }}
          columns={orderColumns(t, { title: "操作", width: 90, fixed: "right", render: (_, row) => orderLink(`/driver/orders/${row.id}`, "查看") })}
        />
      </Card>
    </DriverShell>
  );
}
