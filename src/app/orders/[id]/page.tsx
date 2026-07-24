"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button, Card, Descriptions, Modal, Space, Tag, Typography, message } from "antd";
import dayjs from "dayjs";
import { CustomerShell } from "@/components/CustomerShell";
import { BackButton } from "@/components/BackButton";
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
  rejectReason?: string | null;
  matchedDriver?: { name: string; plateNumber?: string | null } | null;
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

  const cancelOrder = () => {
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

  if (!order) {
    return (
      <CustomerShell selected="orders">
        <Card loading />
      </CustomerShell>
    );
  }

  return (
    <CustomerShell selected="orders">
      <Space style={{ marginBottom: 16 }} wrap>
        <BackButton href="/orders" />
        <Typography.Title level={3} style={{ margin: 0 }}>
          {t("order.order_no", "订单号")}：{order.orderNo}
        </Typography.Title>
      </Space>
      <Card
        extra={
          <Space wrap>
            {order.status === "PENDING_REVIEW" && (
              <Link href={`/orders/${id}/edit`}>
                <Button>{t("action.edit", "修改")}</Button>
              </Link>
            )}
            {(order.status === "PENDING_REVIEW" || order.status === "BIDDING") && (
              <Button danger loading={loading} onClick={cancelOrder}>
                {t("action.cancel", "取消订单")}
              </Button>
            )}
            {order.status === "DELIVERED" && (
              <Button type="primary" loading={loading} onClick={confirmComplete}>
                {t("action.confirm_complete", "确认完成")}
              </Button>
            )}
          </Space>
        }
      >
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label={t("order.status", "状态")}>
            <Tag>{statusLabel(order.status, t)}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label={t("order.customer_bid", "您的出价")}>
            {formatVnd(order.customerBidVnd)} VND
          </Descriptions.Item>
          {order.matchedDriver ? (
            <>
              <Descriptions.Item label="司机姓名">{order.matchedDriver.name}</Descriptions.Item>
              <Descriptions.Item label="车牌号">{order.matchedDriver.plateNumber || "-"}</Descriptions.Item>
            </>
          ) : null}
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
          {order.status === "REJECTED" && order.rejectReason ? (
            <Descriptions.Item label="拒绝原因">
              <Typography.Text type="danger">{order.rejectReason}</Typography.Text>
            </Descriptions.Item>
          ) : null}
        </Descriptions>
      </Card>
    </CustomerShell>
  );
}
