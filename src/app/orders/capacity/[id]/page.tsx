"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button, Card, Form, InputNumber, Space, Switch, Typography, message } from "antd";
import dayjs from "dayjs";
import { CustomerShell } from "@/components/CustomerShell";
import { BackButton } from "@/components/BackButton";
import { OrderFormFields } from "@/components/OrderFormFields";
import { useI18n } from "@/components/I18nProvider";
import { apiFetch } from "@/lib/client";

export default function MatchCapacityPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const [acceptExpected, setAcceptExpected] = useState(true);
  const [loading, setLoading] = useState(false);
  return (
    <CustomerShell selected="capacity">
      <Space style={{ marginBottom: 16 }}>
        <BackButton href="/orders/capacity" />
        <Typography.Title level={3} style={{ margin: 0 }}>
          {t("match.title", "发起匹配")}
        </Typography.Title>
      </Space>
      <Card>
        <Form
          layout="vertical"
          initialValues={{ cargoType: "GENERAL", packaging: "CARTON", cargoItems: [{ quantity: 1 }] }}
          onFinish={async (values) => {
            setLoading(true);
            try {
              const pickupAt = values.pickupAt as dayjs.Dayjs | undefined;
              const etaAt = values.etaAt as dayjs.Dayjs | undefined;
              const res = await apiFetch(`/api/capacity/${id}/match`, {
                method: "POST",
                body: JSON.stringify({
                  ...values,
                  acceptExpected,
                  pickupAt: pickupAt ? pickupAt.toISOString() : undefined,
                  etaAt: etaAt ? etaAt.toISOString() : undefined,
                }),
              });
              if (!res.ok) {
                message.error(res.message || t("match.fail", "提交失败"));
                return;
              }
              message.success(acceptExpected ? t("match.ok_audit", "已接受期望价，等待平台审核") : t("match.ok_talk", "已发出协商价"));
              router.push("/orders/matches");
            } finally {
              setLoading(false);
            }
          }}
        >
          <Form.Item label={t("match.accept_expected", "直接接受期望价")}>
            <Switch checked={acceptExpected} onChange={setAcceptExpected} />
          </Form.Item>
          {!acceptExpected ? (
            <Form.Item name="priceVnd" label={t("match.price", "协商价 VND")} rules={[{ required: true }]}>
              <InputNumber min={1} style={{ width: 240 }} />
            </Form.Item>
          ) : null}
          <OrderFormFields />
          <Button type="primary" htmlType="submit" loading={loading}>
            {t("action.submit", "提交")}
          </Button>
        </Form>
      </Card>
    </CustomerShell>
  );
}
