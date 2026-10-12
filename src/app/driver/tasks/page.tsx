"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, Table, Tag, Typography, message } from "antd";
import { DriverShell } from "@/components/DriverShell";
import { apiFetch, statusLabel } from "@/lib/client";
import { useI18n } from "@/components/I18nProvider";

export default function TasksPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<Array<{ id: string; orderNo: string; status: string }>>([]);
  useEffect(() => {
    (async () => {
      const res = await apiFetch<Array<{ id: string; orderNo: string; status: string }>>("/api/driver/orders?scope=tasks");
      if (!res.ok) message.error(res.message || "加载失败");
      else setRows(res.data || []);
    })();
  }, []);
  return (
    <DriverShell>
      <Typography.Title level={3}>我的任务</Typography.Title>
      <Card>
        <Table
          rowKey="id"
          dataSource={rows}
          columns={[
            { title: "订单号", dataIndex: "orderNo" },
            { title: "状态", dataIndex: "status", render: (v) => <Tag>{statusLabel(v, t)}</Tag> },
            { title: "操作", render: (_, r) => <Link href={`/driver/orders/${r.id}`}>执行</Link> },
          ]}
        />
      </Card>
    </DriverShell>
  );
}
