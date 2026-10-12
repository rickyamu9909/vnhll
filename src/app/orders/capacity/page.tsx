"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, Table, Typography, message } from "antd";
import { CustomerShell } from "@/components/CustomerShell";
import { apiFetch } from "@/lib/client";
import { formatVnd } from "@/lib/money";

type Row = {
  id: string;
  location: string;
  destPreference?: string;
  vehicleType: string;
  loadTons: number;
  airportOk: boolean;
  portOk: boolean;
  expectedPriceVnd: string;
  publisherName: string;
};

export default function CapacityHallPage() {
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    (async () => {
      const res = await apiFetch<Row[]>("/api/capacity");
      if (!res.ok) message.error(res.message || "加载失败");
      else setRows(res.data || []);
    })();
  }, []);
  return (
    <CustomerShell selected="capacity">
      <Typography.Title level={3}>运力大厅</Typography.Title>
      <Card>
        <Table
          rowKey="id"
          dataSource={rows}
          pagination={{ pageSize: 15, showSizeChanger: true, pageSizeOptions: ["15", "25", "50", "100", "500"] }}
          columns={[
            { title: "空车位置", dataIndex: "location" },
            { title: "目的偏好", dataIndex: "destPreference", render: (v) => v || "-" },
            { title: "车型", dataIndex: "vehicleType" },
            { title: "载重吨", dataIndex: "loadTons" },
            { title: "机场/港口", render: (_, r) => `${r.airportOk ? "可进机场" : "不可进机场"} / ${r.portOk ? "可进港口" : "不可进港口"}` },
            { title: "期望价", dataIndex: "expectedPriceVnd", render: (v) => formatVnd(v) },
            { title: "操作", render: (_, r) => <Link href={`/orders/capacity/${r.id}`}>发起匹配</Link> },
          ]}
        />
      </Card>
    </CustomerShell>
  );
}
