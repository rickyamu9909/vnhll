"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button, Card, Descriptions, Tag, Typography, message } from "antd";
import dayjs from "dayjs";
import { CustomerShell } from "@/components/CustomerShell";
import { useI18n } from "@/components/I18nProvider";
import { apiFetch, statusLabel, vehicleLabel } from "@/lib/client";
import { formatVnd } from "@/lib/money";

type OrderDetail = {
  id: string;
  orderNo: string;
  status: string;
  pickupAddress: string;
  pickupContact: string;
  pickupPhone: string;
  pickupNote?: string;
  pickupAt: string;
  deliveryAddress: string;
  deliveryContact: string;
  deliveryPhone: string;
  cargoName: string;
  cargoWeightKg: number;
  cargoVolumeM3: number;
  vehicleType: string;
  customerBidVnd: string;
  rejectReason?: string;
};

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const res = await apiFetch<OrderDetail>(`/api/orders/${id}`);
    if (!res.ok) {
      message.error(res.message || "加载失败");
      return;
    }
    setOrder(res.data || null);
  };

  useEffect(() => {
    load();
  }, [id]);

  const confirmComplete = async () => {
    setLoading(true);
    const res = await apiFetch(`/api/orders/${id}`, {
      method: "POST",
      body: JSON.stringify({ action: "confirm_complete" }),
    });
    setLoading(false);
    if (!res.ok) {
      message.error(res.message || "操作失败");
      return;
    }
    message.success("已确认完成");
    load();
  };

  if (!order) {
    return (
      <CustomerShell selected="orders">
        <Card loading />
      </CustomerShell>
    );
  }

  return (
    <CustomerShell selected="orders">
      <Typography.Title level={3}>
        {t("order.order_no", "订单号")}：{order.orderNo}
      </Typography.Title>
      <Card
        extra={
          order.status === "DELIVERED" ? (
            <Button type="primary" loading={loading} onClick={confirmComplete}>
              {t("action.confirm_complete", "确认完成")}
            </Button>
          ) : null
        }
      >
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label={t("order.status", "状态")}>
            <Tag>{statusLabel(order.status, t)}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label={t("order.customer_bid", "企业出价")}>
            {formatVnd(order.customerBidVnd)} VND
          </Descriptions.Item>
          <Descriptions.Item label={t("order.pickup_at", "预约接货时间")}>
            {dayjs(order.pickupAt).format("YYYY-MM-DD HH:mm")}
          </Descriptions.Item>
          <Descriptions.Item label={t("order.pickup_address", "发货地址")}>
            {order.pickupAddress} / {order.pickupContact} / {order.pickupPhone}
          </Descriptions.Item>
          <Descriptions.Item label={t("order.pickup_note", "接货备注")}>{order.pickupNote || "-"}</Descriptions.Item>
          <Descriptions.Item label={t("order.delivery_address", "收货地址")}>
            {order.deliveryAddress} / {order.deliveryContact} / {order.deliveryPhone}
          </Descriptions.Item>
          <Descriptions.Item label={t("order.cargo_name", "货物")}>
            {order.cargoName} · {order.cargoWeightKg}kg · {order.cargoVolumeM3}m³ · {vehicleLabel(order.vehicleType, t)}
          </Descriptions.Item>
          {order.rejectReason ? <Descriptions.Item label="拒绝原因">{order.rejectReason}</Descriptions.Item> : null}
        </Descriptions>
        <Typography.Paragraph type="secondary" style={{ marginTop: 16 }}>
          提示：客户仅可查看自己的企业出价，实际成交价（司机价格）不可见。
        </Typography.Paragraph>
      </Card>
    </CustomerShell>
  );
}
