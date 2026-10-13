"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, Space, Table, Typography, message } from "antd";
import dayjs from "dayjs";
import { AdminShell } from "@/components/AdminShell";
import { BackButton } from "@/components/BackButton";
import { useI18n } from "@/components/I18nProvider";
import { apiFetch, statusLabel } from "@/lib/client";

type Payload = {
  orderNo: string;
  operations: Array<{ id: string; action: string; note?: string | null; createdAt: string }>;
  statusLogs: Array<{ id: string; fromStatus?: string | null; toStatus: string; note?: string | null; createdAt: string }>;
};

export default function OrderLogsPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const [data, setData] = useState<Payload | null>(null);

  useEffect(() => {
    (async () => {
      const res = await apiFetch<Payload>(`/api/admin/orders/${id}/logs`);
      if (!res.ok) message.error(res.message || "加载失败");
      else setData(res.data || null);
    })();
  }, [id]);

  return (
    <AdminShell>
      <Space style={{ marginBottom: 16 }}>
        <BackButton href="/admin/orders" />
        <Typography.Title level={3} style={{ margin: 0 }}>
          {t("order.logs_title", "订单日志")} {data?.orderNo || ""}
        </Typography.Title>
      </Space>
      <Card title={t("order.logs", "操作记录")} style={{ marginBottom: 16 }}>
        <Table
          size="small"
          rowKey="id"
          dataSource={data?.operations || []}
          pagination={false}
          columns={[
            { title: "时间", dataIndex: "createdAt", render: (v) => dayjs(v).format("YYYY-MM-DD HH:mm") },
            { title: "动作", dataIndex: "action" },
            { title: "备注", dataIndex: "note", render: (v) => v || "-" },
          ]}
        />
      </Card>
      <Card title={t("order.status", "状态变更")}>
        <Table
          size="small"
          rowKey="id"
          dataSource={data?.statusLogs || []}
          pagination={false}
          columns={[
            { title: "时间", dataIndex: "createdAt", render: (v) => dayjs(v).format("YYYY-MM-DD HH:mm") },
            { title: "从", dataIndex: "fromStatus", render: (v) => (v ? statusLabel(v, t) : "-") },
            { title: "到", dataIndex: "toStatus", render: (v) => statusLabel(v, t) },
            { title: "备注", dataIndex: "note", render: (v) => v || "-" },
          ]}
        />
      </Card>
    </AdminShell>
  );
}
