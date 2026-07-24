"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, Table, Tag, Typography, message, Space } from "antd";
import dayjs from "dayjs";
import { AdminShell } from "@/components/AdminShell";
import { useI18n } from "@/components/I18nProvider";
import { apiFetch, statusLabel, vehicleLabel } from "@/lib/client";
import { formatVnd } from "@/lib/money";

type OrderRow = {
  id: string;
  orderNo: string;
  status: string;
  cargoName: string;
  vehicleType: string;
  customerBidVnd: string;
  dealPriceVnd?: string | null;
  pickupAt: string;
  customer?: { displayName?: string; username: string };
};

export default function AdminOrdersPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const res = await apiFetch<OrderRow[]>("/api/admin/orders");
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

  return (
    <AdminShell>
      <Typography.Title level={3}>{t("nav.admin_orders", "订单管理")}</Typography.Title>
      <Card>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={rows}
          columns={[
            { title: "订单号", dataIndex: "orderNo" },
            {
              title: "客户",
              render: (_, r) => r.customer?.displayName || r.customer?.username || "-",
            },
            {
              title: "状态",
              dataIndex: "status",
              render: (v) => <Tag>{statusLabel(v, t)}</Tag>,
            },
            { title: "货物", dataIndex: "cargoName" },
            {
              title: "车型",
              dataIndex: "vehicleType",
              render: (v) => vehicleLabel(v, t),
            },
            {
              title: "企业出价",
              dataIndex: "customerBidVnd",
              render: (v) => `${formatVnd(v)}`,
            },
            {
              title: "成交价",
              dataIndex: "dealPriceVnd",
              render: (v) => (v ? formatVnd(v) : "-"),
            },
            {
              title: "预约时间",
              dataIndex: "pickupAt",
              render: (v) => dayjs(v).format("MM-DD HH:mm"),
            },
            {
              title: "操作",
              render: (_, r) => (
                <Space>
                  <Link href={`/admin/orders/${r.id}`}>详情</Link>
                </Space>
              ),
            },
          ]}
        />
      </Card>
      <div style={{ marginTop: 12 }}>
        <Button onClick={load}>刷新</Button>
      </div>
    </AdminShell>
  );
}
