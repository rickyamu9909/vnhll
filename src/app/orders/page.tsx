"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, Table, Tag, Typography, message } from "antd";
import dayjs from "dayjs";
import { CustomerShell } from "@/components/CustomerShell";
import { useI18n } from "@/components/I18nProvider";
import { apiFetch, statusLabel, vehicleLabel } from "@/lib/client";
import { formatVnd } from "@/lib/money";

type OrderRow = {
  id: string;
  orderNo: string;
  status: string;
  pickupAddress: string;
  deliveryAddress: string;
  cargoName: string;
  vehicleType: string;
  customerBidVnd: string;
  pickupAt: string;
  createdAt: string;
};

export default function OrdersPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const res = await apiFetch<OrderRow[]>("/api/orders");
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
    <CustomerShell selected="orders">
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {t("nav.orders", "我的订单")}
        </Typography.Title>
        <Link href="/orders/new">
          <Button type="primary">{t("nav.new_order", "新建订单")}</Button>
        </Link>
      </div>
      <Card>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={rows}
          pagination={{ pageSize: 10 }}
          columns={[
            { title: t("order.order_no", "订单号"), dataIndex: "orderNo" },
            {
              title: t("order.status", "状态"),
              dataIndex: "status",
              render: (v) => <Tag>{statusLabel(v, t)}</Tag>,
            },
            { title: t("order.cargo_name", "货物"), dataIndex: "cargoName" },
            {
              title: t("order.vehicle_type", "车型"),
              dataIndex: "vehicleType",
              render: (v) => vehicleLabel(v, t),
            },
            {
              title: t("order.customer_bid", "企业出价"),
              dataIndex: "customerBidVnd",
              render: (v) => `${formatVnd(v)} VND`,
            },
            {
              title: t("order.pickup_at", "预约时间"),
              dataIndex: "pickupAt",
              render: (v) => dayjs(v).format("YYYY-MM-DD HH:mm"),
            },
            {
              title: "操作",
              render: (_, r) => <Link href={`/orders/${r.id}`}>详情</Link>,
            },
          ]}
        />
      </Card>
    </CustomerShell>
  );
}
