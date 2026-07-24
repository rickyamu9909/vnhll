"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button, Card, Form, Space, Typography, message, Spin } from "antd";
import dayjs from "dayjs";
import { CustomerShell } from "@/components/CustomerShell";
import { BackButton } from "@/components/BackButton";
import { OrderFormFields } from "@/components/OrderFormFields";
import { useI18n } from "@/components/I18nProvider";
import { apiFetch } from "@/lib/client";

type OrderDetail = {
  id: string;
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
};

export default function EditOrderPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const router = useRouter();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await apiFetch<OrderDetail>(`/api/orders/${id}`);
      if (!res.ok || !res.data) {
        message.error(res.message || "加载失败");
        return;
      }
      if (res.data.status !== "PENDING_REVIEW" && res.data.status !== "REJECTED") {
        message.warning("仅待审核或已拒绝订单可修改");
        router.replace(`/orders/${id}`);
        return;
      }
      form.setFieldsValue({
        ...res.data,
        customerBidVnd: Number(res.data.customerBidVnd),
        pickupAt: dayjs(res.data.pickupAt),
      });
      setReady(true);
    })();
  }, [id, form, router]);

  const onFinish = async (values: Record<string, unknown>) => {
    setLoading(true);
    const res = await apiFetch(`/api/orders/${id}`, {
      method: "PATCH",
      body: JSON.stringify({
        ...values,
        pickupAt: (values.pickupAt as dayjs.Dayjs).toISOString(),
      }),
    });
    setLoading(false);
    if (!res.ok) {
      message.error(res.message || "保存失败");
      return;
    }
    message.success("已保存");
    router.push(`/orders/${id}`);
  };

  return (
    <CustomerShell selected="orders">
      <Space style={{ marginBottom: 16 }}>
        <BackButton href={`/orders/${id}`} />
        <Typography.Title level={3} style={{ margin: 0 }}>
          {t("action.edit", "修改订单")}
        </Typography.Title>
      </Space>
      <Card>
        {!ready ? (
          <Spin />
        ) : (
          <Form form={form} layout="vertical" onFinish={onFinish}>
            <OrderFormFields />
            <Space>
              <Button type="primary" htmlType="submit" loading={loading} size="large">
                {t("action.save", "保存")}
              </Button>
              <Button onClick={() => router.push(`/orders/${id}`)}>{t("action.cancel", "取消")}</Button>
            </Space>
          </Form>
        )}
      </Card>
    </CustomerShell>
  );
}
