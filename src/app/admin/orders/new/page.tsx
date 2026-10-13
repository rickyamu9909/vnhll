"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, Form, Select, Space, Typography, message } from "antd";
import dayjs from "dayjs";
import { AdminShell } from "@/components/AdminShell";
import { BackButton } from "@/components/BackButton";
import { OrderFormFields } from "@/components/OrderFormFields";
import { useI18n } from "@/components/I18nProvider";
import { apiFetch } from "@/lib/client";
import { orderToFormValues, pickupIsPast, type OrderFormSource } from "@/lib/order-form";

type Customer = {
  id: string;
  username: string;
  displayName?: string;
  status: string;
  company?: { companyName: string };
};

type HistoryOrder = OrderFormSource & { id: string; orderNo: string; customerId?: string };

export default function AdminNewOrderPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [form] = Form.useForm();
  const customerId = Form.useWatch("customerId", form) as string | undefined;
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [history, setHistory] = useState<HistoryOrder[]>([]);
  const [pastPickup, setPastPickup] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await apiFetch<Customer[]>("/api/admin/customers?status=ACTIVE");
      if (!res.ok) {
        message.error(res.message || "加载客户失败");
        return;
      }
      setCustomers((res.data || []).filter((c) => c.status === "ACTIVE"));
    })();
  }, []);

  useEffect(() => {
    if (!customerId) {
      setHistory([]);
      return;
    }
    (async () => {
      const res = await apiFetch<HistoryOrder[]>(`/api/admin/orders?customerId=${customerId}`);
      if (res.ok) setHistory(res.data || []);
    })();
  }, [customerId]);

  const fillFromId = async (id: string) => {
    const detail = await apiFetch<HistoryOrder>(`/api/admin/orders/${id}`);
    if (!detail.ok || !detail.data) return message.error(detail.message || "读取历史订单失败");
    const values = orderToFormValues(detail.data);
    form.setFieldsValue({
      ...values,
      customerId,
      pickupAt: values.pickupAt ? dayjs(values.pickupAt) : undefined,
      etaAt: values.etaAt ? dayjs(values.etaAt) : undefined,
    });
    setPastPickup(pickupIsPast(detail.data.pickupAt));
    message.success("已填入历史订单，请核对后提交");
  };

  const onFinish = async (values: Record<string, unknown>) => {
    setLoading(true);
    const res = await apiFetch<{ id: string }>("/api/admin/orders", {
      method: "POST",
      body: JSON.stringify({
        ...values,
        pickupAt: (values.pickupAt as dayjs.Dayjs).toISOString(),
        etaAt: (values.etaAt as dayjs.Dayjs).toISOString(),
      }),
    });
    setLoading(false);
    if (!res.ok) {
      message.error(res.message || "创建失败");
      return;
    }
    message.success("已为客户创建订单");
    router.push(`/admin/orders/${res.data?.id}`);
  };

  return (
    <AdminShell>
      <Space style={{ marginBottom: 16 }} wrap>
        <BackButton href="/admin/orders" />
        <Typography.Title level={3} style={{ margin: 0 }}>
          代客建单
        </Typography.Title>
      </Space>
      <Card>
        <Typography.Paragraph type="secondary">
          选择客户账号后提交，订单将出现在该客户的「我的订单」中，效果与客户自行建单一致。
        </Typography.Paragraph>
        <Form form={form} size="small" layout="vertical" onFinish={onFinish} initialValues={{ cargoType: "GENERAL", packaging: "CARTON", cargoItems: [{ quantity: 1 }] }}>
          <Form.Item name="customerId" label="客户账号" rules={[{ required: true, message: "请选择客户" }]}>
            <Select
              showSearch
              optionFilterProp="label"
              placeholder="搜索并选择客户"
              options={customers.map((c) => ({
                value: c.id,
                label: `${c.company?.companyName || c.displayName || c.username}（${c.username}）`,
              }))}
            />
          </Form.Item>
          <Form.Item label="从该客户的历史订单复制">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              disabled={!customerId}
              placeholder={customerId ? "选择一条历史订单，内容会直接填入" : "请先选择客户"}
              options={history.map((row) => ({
                value: row.id,
                label: `${row.orderNo} ${row.originProvince || ""} → ${row.destProvince || ""}`,
              }))}
              onChange={(id) => {
                if (id) fillFromId(id);
              }}
            />
          </Form.Item>
          {pastPickup ? <Alert type="warning" showIcon style={{ marginBottom: 12 }} message="复制的接货时间已过，请改成新的时间后再提交" /> : null}
          <OrderFormFields addressMode="customer" addressUserId={customerId} />
          <Space>
            <Button type="primary" htmlType="submit" loading={loading}>
              {t("action.submit", "提交订单")}
            </Button>
            <Button onClick={() => router.push("/admin/orders")}>{t("action.cancel", "取消")}</Button>
          </Space>
        </Form>
      </Card>
    </AdminShell>
  );
}
