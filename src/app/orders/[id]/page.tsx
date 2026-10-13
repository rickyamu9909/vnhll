"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button, Card, Descriptions, Modal, Space, Table, Tag, Typography, message } from "antd";
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
  matchPath?: string | null;
  targetPriceVnd?: string | null;
  dealPriceVnd?: string | null;
  driverName?: string | null;
  plateNumber?: string | null;
  carrierBids?: Array<{ id: string; priceVnd: string; bidderName: string }>;
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
            <Link href={`/orders/new?from=${id}`}>
              <Button>复制新建</Button>
            </Link>
            {["PENDING_REVIEW", "REJECTED", "OPEN", "FAILED"].includes(order.status) ? (
              <Link href={`/orders/${id}/edit`}>
                <Button>{t("action.edit", "修改")}</Button>
              </Link>
            ) : null}
            {["PENDING_REVIEW", "BIDDING", "REJECTED", "OPEN", "PENDING_CONFIRM", "FAILED"].includes(order.status) && (
              <Button danger loading={loading} onClick={cancelOrder}>
                {t("action.cancel", "取消订单")}
              </Button>
            )}
            {order.status === "OPEN" && (
              <Button
                loading={loading}
                onClick={async () => {
                  setLoading(true);
                  const res = await apiFetch(`/api/orders/${id}`, { method: "POST", body: JSON.stringify({ action: "extend" }) });
                  setLoading(false);
                  if (!res.ok) message.error(res.message || "延长失败");
                  else {
                    message.success("已延长");
                    load();
                  }
                }}
              >
                延长有效期
              </Button>
            )}
            {order.status === "PENDING_CONFIRM" && (
              <Button
                danger
                onClick={async () => {
                  const res = await apiFetch(`/api/orders/${id}`, { method: "POST", body: JSON.stringify({ action: "reject_all" }) });
                  if (!res.ok) message.error(res.message || "操作失败");
                  else {
                    message.success("已拒绝并重新发布");
                    load();
                  }
                }}
              >
                拒绝全部报价
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
          <Descriptions.Item label="匹配路径">{order.matchPath || "-"}</Descriptions.Item>
          <Descriptions.Item label={t("order.customer_bid", "您的出价")}>
            {order.targetPriceVnd || order.customerBidVnd ? `${formatVnd(order.targetPriceVnd || order.customerBidVnd)} VND` : "未出价（询价）"}
          </Descriptions.Item>
          {order.dealPriceVnd ? (
            <Descriptions.Item label="成交价">{formatVnd(order.dealPriceVnd)} VND</Descriptions.Item>
          ) : null}
          {order.driverName ? (
            <>
              <Descriptions.Item label="司机姓名">{order.driverName}</Descriptions.Item>
              <Descriptions.Item label="车牌号">{order.plateNumber || "-"}</Descriptions.Item>
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
          {order.rejectReason ? (
            <Descriptions.Item label="拒绝原因">
              <Typography.Text type="danger">{order.rejectReason}</Typography.Text>
            </Descriptions.Item>
          ) : null}
        </Descriptions>
        {order.carrierBids && order.carrierBids.length > 0 ? (
          <Table
            style={{ marginTop: 16 }}
            rowKey="id"
            pagination={false}
            dataSource={order.carrierBids}
            columns={[
              { title: "报价方", dataIndex: "bidderName" },
              { title: "报价 VND", dataIndex: "priceVnd", render: (v) => formatVnd(v) },
              {
                title: "操作",
                render: (_, row) =>
                  order.status === "PENDING_CONFIRM" ? (
                    <Button
                      type="link"
                      onClick={async () => {
                        const res = await apiFetch(`/api/orders/${id}`, {
                          method: "POST",
                          body: JSON.stringify({ action: "confirm_bid", bidId: row.id }),
                        });
                        if (!res.ok) message.error(res.message || "确认失败");
                        else {
                          message.success("已确认，等待平台审核");
                          load();
                        }
                      }}
                    >
                      同意该报价
                    </Button>
                  ) : null,
              },
            ]}
          />
        ) : null}
      </Card>
    </CustomerShell>
  );
}
