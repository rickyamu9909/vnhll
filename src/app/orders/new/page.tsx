"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, DatePicker, Form, Input, InputNumber, Select, Typography, message } from "antd";
import dayjs from "dayjs";
import { CustomerShell } from "@/components/CustomerShell";
import { useI18n } from "@/components/I18nProvider";
import { apiFetch, vehicleLabel } from "@/lib/client";

export default function NewOrderPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: Record<string, unknown>) => {
    setLoading(true);
    const payload = {
      ...values,
      pickupAt: (values.pickupAt as dayjs.Dayjs).toISOString(),
      bidDeadline: values.bidDeadline ? (values.bidDeadline as dayjs.Dayjs).toISOString() : null,
    };
    const res = await apiFetch<{ id: string }>("/api/orders", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    setLoading(false);
    if (!res.ok) {
      message.error(res.message || "创建失败");
      return;
    }
    message.success("订单已提交，等待管理员审核");
    router.push(`/orders/${res.data?.id}`);
  };

  const vehicleOptions = ["TON_1_5", "TON_3_5", "TON_7", "TON_10", "OTHER"].map((v) => ({
    value: v,
    label: vehicleLabel(v, t),
  }));

  return (
    <CustomerShell selected="new">
      <Typography.Title level={3}>{t("nav.new_order", "新建订单")}</Typography.Title>
      <Card>
        <Form layout="vertical" onFinish={onFinish} initialValues={{ vehicleType: "TON_3_5", cargoWeightKg: 500, cargoVolumeM3: 2 }}>
          <Form.Item name="pickupAddress" label={t("order.pickup_address", "发货地址")} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="pickupContact" label="发货联系人" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="pickupPhone" label="发货电话" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="pickupAt" label={t("order.pickup_at", "预约接货时间")} rules={[{ required: true }]}>
            <DatePicker showTime style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="pickupNote" label={t("order.pickup_note", "接货备注")}>
            <Input.TextArea rows={2} />
          </Form.Item>

          <Form.Item name="deliveryAddress" label={t("order.delivery_address", "收货地址")} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="deliveryContact" label="收货联系人" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="deliveryPhone" label="收货电话" rules={[{ required: true }]}>
            <Input />
          </Form.Item>

          <Form.Item name="cargoName" label={t("order.cargo_name", "货物名称")} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="cargoWeightKg" label={t("order.weight", "重量(kg)")} rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="cargoVolumeM3" label={t("order.volume", "体积(m³)")} rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="vehicleType" label={t("order.vehicle_type", "车型")} rules={[{ required: true }]}>
            <Select options={vehicleOptions} />
          </Form.Item>
          <Form.Item name="customerBidVnd" label={t("order.customer_bid", "企业出价(VND)")} rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="bidDeadline" label="竞价截止时间（可选）">
            <DatePicker showTime style={{ width: "100%" }} />
          </Form.Item>

          <Button type="primary" htmlType="submit" loading={loading}>
            {t("action.submit", "提交订单")}
          </Button>
        </Form>
      </Card>
    </CustomerShell>
  );
}
