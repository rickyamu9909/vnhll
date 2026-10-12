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
  vehicleType?: string | null;
  customerBidVnd?: string | null;
  targetPriceVnd?: string | null;
  originProvince?: string | null;
  originCity?: string | null;
  originAddress?: string | null;
  destProvince?: string | null;
  destCity?: string | null;
  destAddress?: string | null;
  cargoType?: string | null;
  packaging?: string | null;
  weightTons?: number | null;
  abnormalNote?: string | null;
  etaAt?: string;
  cargoItems?: Array<{ lengthCm: number; widthCm: number; heightCm: number; quantity: number }>;
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
      if (!["PENDING_REVIEW", "REJECTED", "OPEN", "FAILED"].includes(res.data.status)) {
        message.warning("当前状态不可修改");
        router.replace(`/orders/${id}`);
        return;
      }
      const price = res.data.targetPriceVnd || res.data.customerBidVnd;
      form.setFieldsValue({
        originProvince: res.data.originProvince,
        originCity: res.data.originCity,
        originAddress: res.data.originAddress || res.data.pickupAddress,
        originContact: res.data.pickupContact,
        originPhone: res.data.pickupPhone,
        destProvince: res.data.destProvince,
        destCity: res.data.destCity,
        destAddress: res.data.destAddress || res.data.deliveryAddress,
        destContact: res.data.deliveryContact,
        destPhone: res.data.deliveryPhone,
        cargoType: res.data.cargoType || "GENERAL",
        packaging: res.data.packaging || "CARTON",
        weightTons: res.data.weightTons || (res.data.cargoWeightKg ? res.data.cargoWeightKg / 1000 : undefined),
        vehicleType: res.data.vehicleType || undefined,
        targetPriceVnd: price ? Number(price) : undefined,
        abnormalNote: res.data.abnormalNote,
        note: res.data.pickupNote,
        cargoItems: res.data.cargoItems?.length ? res.data.cargoItems : [{ quantity: 1 }],
        pickupAt: dayjs(res.data.pickupAt),
        etaAt: res.data.etaAt ? dayjs(res.data.etaAt) : undefined,
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
        etaAt: (values.etaAt as dayjs.Dayjs).toISOString(),
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
