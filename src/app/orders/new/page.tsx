"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, Button, Card, Form, Space, Typography, message } from "antd";
import dayjs from "dayjs";
import { CustomerShell } from "@/components/CustomerShell";
import { BackButton } from "@/components/BackButton";
import { OrderFormFields } from "@/components/OrderFormFields";
import { useI18n } from "@/components/I18nProvider";
import { apiFetch } from "@/lib/client";
import { orderToFormValues, pickupIsPast, type OrderFormSource } from "@/lib/order-form";

type HistoryOrder = OrderFormSource & { id: string; orderNo: string };

function withDates(order: OrderFormSource) {
  const values = orderToFormValues(order);
  return {
    ...values,
    pickupAt: values.pickupAt ? dayjs(values.pickupAt) : undefined,
    etaAt: values.etaAt ? dayjs(values.etaAt) : undefined,
  };
}

function NewOrderPage() {
  const { t } = useI18n();
  const router = useRouter();
  const from = useSearchParams().get("from");
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [pastPickup, setPastPickup] = useState(false);

  const fill = (order: OrderFormSource) => {
    form.setFieldsValue(withDates(order));
    setPastPickup(pickupIsPast(order.pickupAt));
    message.success("已填入历史订单，请核对后提交");
  };

  const fillFromId = async (id: string) => {
    const detail = await apiFetch<HistoryOrder>(`/api/orders/${id}`);
    if (!detail.ok || !detail.data) {
      message.error(detail.message || "读取历史订单失败");
      return;
    }
    fill(detail.data);
  };

  useEffect(() => {
    if (from) fillFromId(from);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from]);

  const onFinish = async (values: Record<string, unknown>) => {
    setLoading(true);
    const res = await apiFetch<{ id: string }>("/api/orders", {
      method: "POST",
      body: JSON.stringify({
        ...values,
        pickupAt: values.pickupAt ? (values.pickupAt as dayjs.Dayjs).toISOString() : undefined,
        etaAt: values.etaAt ? (values.etaAt as dayjs.Dayjs).toISOString() : undefined,
      }),
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
          form={form}
          size="small"
          layout="vertical"
          onFinish={onFinish}
          initialValues={{ cargoType: "GENERAL", packaging: "CARTON", cargoItems: [{ quantity: 1 }] }}
        >
          {pastPickup ? <Alert type="warning" showIcon style={{ marginBottom: 12 }} message={t("form.past_pickup", "复制的接货时间已过，请改成新的时间后再提交")} /> : null}
          <OrderFormFields />
          <Space>
            <Button type="primary" htmlType="submit" loading={loading}>
              {t("action.submit", "提交订单")}
            </Button>
            <Button onClick={() => router.push("/orders")}>{t("action.cancel", "取消")}</Button>
          </Space>
        </Form>
      </Card>
    </CustomerShell>
  );
}

export default function NewOrderRoute() {
  return (
    <Suspense>
      <NewOrderPage />
    </Suspense>
  );
}
