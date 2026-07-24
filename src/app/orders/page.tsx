"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, Modal, Space, Table, Tag, Typography, message } from "antd";
import dayjs from "dayjs";
import { CustomerShell } from "@/components/CustomerShell";
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
  pickupAt: string;
};

const PAGE_SIZES = [15, 25, 50, 100, 500];

export default function OrdersPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageSize, setPageSize] = useState(15);

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

  const cancelOrder = (id: string) => {
    Modal.confirm({
      title: "确认取消该订单？",
      okText: "确认取消",
      okButtonProps: { danger: true },
      onOk: async () => {
        const res = await apiFetch(`/api/orders/${id}`, {
          method: "POST",
          body: JSON.stringify({ action: "cancel" }),
        });
        if (!res.ok) {
          message.error(res.message || "取消失败");
          return;
        }
        message.success("订单已取消");
        load();
      },
    });
  };

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
          scroll={{ x: 960 }}
          pagination={{
            pageSize,
            showSizeChanger: true,
            pageSizeOptions: PAGE_SIZES.map(String),
            showTotal: (total) => `共 ${total} 条`,
            onShowSizeChange: (_p, size) => setPageSize(size),
          }}
          columns={[
            { title: t("order.order_no", "订单号"), dataIndex: "orderNo", width: 180 },
            {
              title: t("order.status", "状态"),
              dataIndex: "status",
              width: 110,
              render: (v) => <Tag>{statusLabel(v, t)}</Tag>,
            },
            { title: t("order.cargo_name", "货物"), dataIndex: "cargoName" },
            {
              title: t("order.vehicle_type", "车型"),
              dataIndex: "vehicleType",
              width: 90,
              render: (v) => vehicleLabel(v, t),
            },
            {
              title: t("order.customer_bid", "出价"),
              dataIndex: "customerBidVnd",
              width: 130,
              render: (v) => `${formatVnd(v)}`,
            },
            {
              title: t("order.pickup_at", "预约时间"),
              dataIndex: "pickupAt",
              width: 150,
              render: (v) => dayjs(v).format("MM-DD HH:mm"),
            },
            {
              title: "操作",
              width: 200,
              fixed: "right",
              render: (_, r) => (
                <Space size="small" wrap>
                  <Link href={`/orders/${r.id}`}>详情</Link>
                  {r.status === "PENDING_REVIEW" && (
                    <Link href={`/orders/${r.id}/edit`}>{t("action.edit", "修改")}</Link>
                  )}
                  {(r.status === "PENDING_REVIEW" || r.status === "BIDDING") && (
                    <Button type="link" danger size="small" onClick={() => cancelOrder(r.id)} style={{ padding: 0 }}>
                      {t("action.cancel", "取消")}
                    </Button>
                  )}
                </Space>
              ),
            },
          ]}
        />
      </Card>
    </CustomerShell>
  );
}
