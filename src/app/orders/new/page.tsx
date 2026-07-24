"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Form, Space, Typography, message } from "antd";
import { CustomerShell } from "@/components/CustomerShell";
import { BackButton } from "@/components/BackButton";
import { OrderFormFields } from "@/components/OrderFormFields";
import { useI18n } from "@/components/I18nProvider";
import { apiFetch } from "@/lib/client";
import dayjs from "dayjs";

export default function NewOrderPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: Record<string, unknown>) => {
    setLoading(true);
    const payload = {
      ...values,
      pickupAt: (values.pickupAt as dayjs.Dayjs).toISOString(),
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
    message.success("订单已提交");
    router.push(`/orders/${res.data?.id}`);
  };

  return (
    <CustomerShell selected="new">
      <Space style={{ marginBottom: 16 }}>
        <BackButton href="/orders" />
        <Typography.Title level={3} style={{ margin: 0 }}>
          {t("nav.new_order", "新建订单")}
        </Typography.Title>
      </Space>
      <Card>
        <Form
          layout="vertical"
          onFinish={onFinish}
          initialValues={{ vehicleType: "TON_3_5", cargoWeightKg: 500, cargoVolumeM3: 2 }}
        >
          <OrderFormFields />
          <Space>
            <Button type="primary" htmlType="submit" loading={loading} size="large">
              {t("action.submit", "提交订单")}
            </Button>
            <Button onClick={() => router.push("/orders")}>{t("action.cancel", "取消")}</Button>
          </Space>
        </Form>
      </Card>
    </CustomerShell>
  );
}
