"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, Table, Tag, Typography, message } from "antd";
import { DriverShell } from "@/components/DriverShell";
import { apiFetch, statusLabel } from "@/lib/client";
import { useI18n } from "@/components/I18nProvider";
import { formatVnd } from "@/lib/money";

type Row = {
  id: string;
  orderNo: string;
  status: string;
  matchPath?: string;
  pickupAddress: string;
  deliveryAddress: string;
  targetPriceVnd?: string | null;
  weightTons?: number;
};

export default function DriverHallPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    (async () => {
      const res = await apiFetch<Row[]>("/api/driver/orders");
      if (!res.ok) message.error(res.message || "加载失败");
      else setRows(res.data || []);
    })();
  }, []);
  return (
    <DriverShell>
      <Typography.Title level={3}>订单中心</Typography.Title>
      <Card>
        <Table
          rowKey="id"
          dataSource={rows}
          pagination={{ pageSize: 15, showSizeChanger: true, pageSizeOptions: ["15", "25", "50", "100", "500"] }}
          columns={[
            { title: "订单号", dataIndex: "orderNo" },
            { title: "路径", dataIndex: "matchPath" },
            { title: "状态", dataIndex: "status", render: (v) => <Tag>{statusLabel(v, t)}</Tag> },
            { title: "起运", dataIndex: "pickupAddress" },
            { title: "目的", dataIndex: "deliveryAddress" },
            { title: "平台价", dataIndex: "targetPriceVnd", render: (v) => (v ? formatVnd(v) : "询价") },
            { title: "操作", render: (_, r) => <Link href={`/driver/orders/${r.id}`}>查看</Link> },
          ]}
        />
      </Card>
    </DriverShell>
  );
}
