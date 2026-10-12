"use client";

import { useEffect, useState } from "react";
import { Card, Table, Typography } from "antd";
import dayjs from "dayjs";
import { AdminShell } from "@/components/AdminShell";
import { apiFetch } from "@/lib/client";

export default function LogsPage() {
  const [rows, setRows] = useState<Array<{ id: string; action: string; targetType: string; note?: string; createdAt: string }>>([]);
  useEffect(() => {
    (async () => {
      const res = await apiFetch<Array<{ id: string; action: string; targetType: string; note?: string; createdAt: string }>>("/api/admin/logs");
      if (res.ok) setRows(res.data || []);
    })();
  }, []);
  return (
    <AdminShell>
      <Typography.Title level={3}>操作日志</Typography.Title>
      <Card>
        <Table
          rowKey="id"
          dataSource={rows}
          pagination={{ pageSize: 15, showSizeChanger: true, pageSizeOptions: ["15", "25", "50", "100", "500"] }}
          columns={[
            { title: "时间", dataIndex: "createdAt", render: (v) => dayjs(v).format("YYYY-MM-DD HH:mm") },
            { title: "动作", dataIndex: "action" },
            { title: "对象", dataIndex: "targetType" },
            { title: "备注", dataIndex: "note" },
          ]}
        />
      </Card>
    </AdminShell>
  );
}
