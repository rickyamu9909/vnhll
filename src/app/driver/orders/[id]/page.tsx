"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Button, Card, Descriptions, Form, InputNumber, Select, Space, Typography, message } from "antd";
import { DriverShell } from "@/components/DriverShell";
import { BackButton } from "@/components/BackButton";
import { apiFetch, statusLabel } from "@/lib/client";
import { useI18n } from "@/components/I18nProvider";
import { formatVnd } from "@/lib/money";

type Detail = {
  id: string;
  orderNo: string;
  status: string;
  matchPath?: string;
  pickupAddress: string;
  pickupContact: string;
  pickupPhone: string;
  deliveryAddress: string;
  deliveryContact: string;
  deliveryPhone: string;
  targetPriceVnd?: string | null;
  dealPriceVnd?: string | null;
  platformFeeVnd?: string | null;
  driverIncomeVnd?: string | null;
  cargoName: string;
  weightTons?: number;
};

export default function DriverOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const [order, setOrder] = useState<Detail | null>(null);
  const [subs, setSubs] = useState<Array<{ id: string; displayName?: string; username: string }>>([]);

  const load = async () => {
    const res = await apiFetch<Detail>(`/api/driver/orders/${id}`);
    if (!res.ok) message.error(res.message || "加载失败");
    else setOrder(res.data || null);
  };

  useEffect(() => {
    load();
    (async () => {
      const res = await apiFetch<{ subs: Array<{ id: string; displayName?: string; username: string }> }>("/api/driver/team");
      if (res.ok) setSubs(res.data?.subs || []);
    })();
  }, [id]);

  const act = async (action: string, extra: Record<string, unknown> = {}) => {
    const res = await apiFetch(`/api/driver/orders/${id}`, { method: "POST", body: JSON.stringify({ action, ...extra }) });
    if (!res.ok) message.error(res.message || "操作失败");
    else {
      message.success("已提交");
      load();
    }
  };

  if (!order) {
    return (
      <DriverShell>
        <Card loading />
      </DriverShell>
    );
  }

  return (
    <DriverShell>
      <Space style={{ marginBottom: 16 }}>
        <BackButton href="/driver" />
        <Typography.Title level={3} style={{ margin: 0 }}>
          {order.orderNo}
        </Typography.Title>
      </Space>
      <Card>
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="状态">{statusLabel(order.status, t)}</Descriptions.Item>
          <Descriptions.Item label="路径">{order.matchPath}</Descriptions.Item>
          <Descriptions.Item label="平台价">{order.targetPriceVnd ? `${formatVnd(order.targetPriceVnd)} VND` : "不显示 / 询价"}</Descriptions.Item>
          <Descriptions.Item label="成交价">{order.dealPriceVnd ? formatVnd(order.dealPriceVnd) : "-"}</Descriptions.Item>
          <Descriptions.Item label="佣金">{order.platformFeeVnd ? formatVnd(order.platformFeeVnd) : "-"}</Descriptions.Item>
          <Descriptions.Item label="到手价">{order.driverIncomeVnd ? formatVnd(order.driverIncomeVnd) : "-"}</Descriptions.Item>
          <Descriptions.Item label="起运">
            {order.pickupAddress} / {order.pickupContact} / {order.pickupPhone}
          </Descriptions.Item>
          <Descriptions.Item label="目的">
            {order.deliveryAddress} / {order.deliveryContact} / {order.deliveryPhone}
          </Descriptions.Item>
          <Descriptions.Item label="货物">{order.cargoName}</Descriptions.Item>
        </Descriptions>
        <Space style={{ marginTop: 16 }} wrap>
          {order.status === "OPEN" && order.matchPath === "A" && order.targetPriceVnd ? (
            <Button type="primary" onClick={() => act("accept")}>
              接单
            </Button>
          ) : null}
          {order.status === "OPEN" && order.matchPath === "B" ? (
            <Form
              layout="inline"
              onFinish={(v) => act("bid", { priceVnd: v.priceVnd })}
            >
              <Form.Item name="priceVnd" rules={[{ required: true }]}>
                <InputNumber min={1} placeholder="报价 VND" />
              </Form.Item>
              <Button htmlType="submit" type="primary">
                提交报价
              </Button>
            </Form>
          ) : null}
          {order.status === "PENDING_EXECUTION" || order.status === "IN_TRANSIT" ? (
            <Button onClick={() => act("advance")}>推进状态</Button>
          ) : null}
        </Space>
        {subs.length > 0 && (order.status === "PENDING_EXECUTION" || order.status === "IN_TRANSIT") ? (
          <Form style={{ marginTop: 16 }} layout="inline" onFinish={(v) => act("assign", { subUserId: v.subUserId })}>
            <Form.Item name="subUserId" rules={[{ required: true }]}>
              <Select
                style={{ width: 220 }}
                placeholder="分配给子账号"
                options={subs.map((s) => ({ value: s.id, label: s.displayName || s.username }))}
              />
            </Form.Item>
            <Button htmlType="submit">分配</Button>
          </Form>
        ) : null}
      </Card>
    </DriverShell>
  );
}
