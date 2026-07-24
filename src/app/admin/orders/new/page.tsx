"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Form, Select, Space, Typography, message } from "antd";
import dayjs from "dayjs";
import { AdminShell } from "@/components/AdminShell";
import { BackButton } from "@/components/BackButton";
import { OrderFormFields } from "@/components/OrderFormFields";
import { useI18n } from "@/components/I18nProvider";
import { apiFetch } from "@/lib/client";

type Customer = {
  id: string;
  username: string;
  displayName?: string;
  status: string;
  company?: { companyName: string };
};

export default function AdminNewOrderPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);

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

  const onFinish = async (values: Record<string, unknown>) => {
    setLoading(true);
    const res = await apiFetch<{ id: string }>("/api/admin/orders", {
      method: "POST",
      body: JSON.stringify({
        ...values,
        pickupAt: (values.pickupAt as dayjs.Dayjs).toISOString(),
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
        <Form layout="vertical" onFinish={onFinish} initialValues={{ vehicleType: "TON_3_5", cargoWeightKg: 500, cargoVolumeM3: 2 }}>
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
          <OrderFormFields />
          <Space>
            <Button type="primary" htmlType="submit" loading={loading} size="large">
              {t("action.submit", "提交订单")}
            </Button>
            <Button onClick={() => router.push("/admin/orders")}>{t("action.cancel", "取消")}</Button>
          </Space>
        </Form>
      </Card>
    </AdminShell>
  );
}
