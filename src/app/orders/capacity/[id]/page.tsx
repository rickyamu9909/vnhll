"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button, Card, Form, InputNumber, Space, Switch, Typography, message } from "antd";
import dayjs from "dayjs";
import { CustomerShell } from "@/components/CustomerShell";
import { BackButton } from "@/components/BackButton";
import { OrderFormFields } from "@/components/OrderFormFields";
import { apiFetch } from "@/lib/client";

export default function MatchCapacityPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [acceptExpected, setAcceptExpected] = useState(true);
  const [loading, setLoading] = useState(false);
  return (
    <CustomerShell selected="capacity">
      <Space style={{ marginBottom: 16 }}>
        <BackButton href="/orders/capacity" />
        <Typography.Title level={3} style={{ margin: 0 }}>
          发起匹配
        </Typography.Title>
      </Space>
      <Card>
        <Form
          layout="vertical"
          initialValues={{ cargoType: "GENERAL", packaging: "CARTON", cargoItems: [{ quantity: 1 }] }}
          onFinish={async (values) => {
            setLoading(true);
            const res = await apiFetch(`/api/capacity/${id}/match`, {
              method: "POST",
              body: JSON.stringify({
                ...values,
                acceptExpected,
                pickupAt: (values.pickupAt as dayjs.Dayjs).toISOString(),
                etaAt: (values.etaAt as dayjs.Dayjs).toISOString(),
              }),
            });
            setLoading(false);
            if (!res.ok) return message.error(res.message || "提交失败");
            message.success(acceptExpected ? "已接受期望价，等待平台审核" : "已发出协商价");
            router.push("/orders/matches");
          }}
        >
          <Form.Item label="直接接受期望价">
            <Switch checked={acceptExpected} onChange={setAcceptExpected} />
          </Form.Item>
          {!acceptExpected ? (
            <Form.Item name="priceVnd" label="协商价 VND" rules={[{ required: true }]}>
              <InputNumber min={1} style={{ width: "100%" }} />
            </Form.Item>
          ) : null}
          <OrderFormFields />
          <Button type="primary" htmlType="submit" loading={loading}>
            提交
          </Button>
        </Form>
      </Card>
    </CustomerShell>
  );
}
