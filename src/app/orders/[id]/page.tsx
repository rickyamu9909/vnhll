"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Card, Descriptions, Modal, Space, Steps, Table, Tag, Typography, message } from "antd";
import dayjs from "dayjs";
import { ActionButton } from "@/components/ActionButton";
import { CustomerShell } from "@/components/CustomerShell";
import { BackButton } from "@/components/BackButton";
import { OrderProofPhotos } from "@/components/OrderProofPhotos";
import { PostPublishGuide } from "@/components/PostPublishGuide";
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
  waitDeadline?: string | null;
  routeDistanceKm?: number | null;
  routeDurationMin?: number | null;
  routeSource?: string | null;
  suggestCount?: number;
  pickupPhotos?: string | null;
  deliveryPhotos?: string | null;
  carrierBids?: Array<{ id: string; priceVnd: string; bidderName: string }>;
  matchedDriver?: { name: string; plateNumber?: string | null } | null;
};

const STEP_MAP: Record<string, number> = {
  OPEN: 1,
  BIDDING: 1,
  PENDING_CONFIRM: 1,
  PENDING_EXECUTION: 2,
  MATCHED: 2,
  IN_TRANSIT: 3,
  DELIVERED: 4,
  COMPLETED: 5,
  FAILED: 1,
  CANCELLED: 0,
  REJECTED: 0,
};

function OrderDetailInner() {
  const { id } = useParams<{ id: string }>();
  const search = useSearchParams();
  const fresh = search.get("fresh") === "1";
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
      {fresh && order.status === "OPEN" ? (
        <PostPublishGuide
          orderId={order.id}
          orderNo={order.orderNo}
          matchPath={order.matchPath}
          waitDeadline={order.waitDeadline}
          routeLabel={
            order.routeDistanceKm != null
              ? `约 ${order.routeDistanceKm} 公里${order.routeDurationMin != null ? ` · 约 ${order.routeDurationMin} 分钟` : ""}${order.routeSource === "straight" ? "（直线）" : ""}`
              : null
          }
        />
      ) : null}
      <Card size="small" style={{ marginBottom: 12 }}>
        <Steps
          size="small"
          current={STEP_MAP[order.status] ?? 0}
          items={[
            { title: "发布" },
            { title: "匹配中" },
            { title: "待执行" },
            { title: "运输中" },
            { title: "已送达" },
            { title: "已完成" },
          ]}
        />
        {order.suggestCount != null ? (
          <Typography.Paragraph type="secondary" style={{ marginTop: 12, marginBottom: 0 }}>
            已推送 {order.suggestCount} 位顺路司机
            {order.waitDeadline ? ` · 匹配截止 ${dayjs(order.waitDeadline).format("MM-DD HH:mm")}` : ""}
          </Typography.Paragraph>
        ) : null}
        {["FAILED", "REJECTED"].includes(order.status) ? (
          <div style={{ marginTop: 8 }}>
            <ActionButton href={`/orders/new?from=${id}`} tone="primary">
              改价重发
            </ActionButton>
          </div>
        ) : null}
      </Card>
      <Card
        extra={
          <Space wrap>
            <ActionButton href={`/orders/new?from=${id}`} tone="orange">
              复制新建
            </ActionButton>
            {["PENDING_REVIEW", "REJECTED", "OPEN", "FAILED"].includes(order.status) ? (
              <ActionButton href={`/orders/${id}/edit`} tone="default">
                {t("action.edit", "修改")}
              </ActionButton>
            ) : null}
            {["PENDING_REVIEW", "BIDDING", "REJECTED", "OPEN", "PENDING_CONFIRM", "FAILED"].includes(order.status) && (
              <ActionButton tone="danger" loading={loading} onClick={cancelOrder}>
                {t("action.cancel", "取消订单")}
              </ActionButton>
            )}
            {order.status === "OPEN" && (
              <ActionButton
                tone="cyan"
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
              </ActionButton>
            )}
            {order.status === "PENDING_CONFIRM" && (
              <ActionButton
                tone="danger"
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
              </ActionButton>
            )}
            {order.status === "DELIVERED" && (
              <ActionButton tone="primary" loading={loading} onClick={confirmComplete}>
                {t("action.confirm_complete", "确认完成")}
              </ActionButton>
            )}
          </Space>
        }
      >
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label={t("order.status", "状态")}>
            <Tag>{statusLabel(order.status, t)}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="匹配路径">
            {order.matchPath === "A" ? "出价接单" : order.matchPath === "B" ? "询价报价" : order.matchPath === "C" ? "运力匹配（选择司机已发布的空车运力）" : order.matchPath || "-"}
          </Descriptions.Item>
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
        <OrderProofPhotos pickupPhotos={order.pickupPhotos} deliveryPhotos={order.deliveryPhotos} />
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
                  ["PENDING_CONFIRM", "BIDDING", "OPEN"].includes(order.status) ? (
                    <ActionButton
                      tone="primary"
                      onClick={async () => {
                        const res = await apiFetch(`/api/orders/${id}`, {
                          method: "POST",
                          body: JSON.stringify({ action: "confirm_bid", bidId: row.id }),
                        });
                        if (!res.ok) message.error(res.message || "确认失败");
                        else {
                          message.success("已确认，订单进入待执行");
                          load();
                        }
                      }}
                    >
                      同意该报价
                    </ActionButton>
                  ) : null,
              },
            ]}
          />
        ) : null}
      </Card>
    </CustomerShell>
  );
}

export default function OrderDetailPage() {
  return (
    <Suspense fallback={<CustomerShell selected="orders"><Card loading /></CustomerShell>}>
      <OrderDetailInner />
    </Suspense>
  );
}
