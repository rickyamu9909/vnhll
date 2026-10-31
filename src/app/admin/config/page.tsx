"use client";

import { useEffect } from "react";
import { Button, Card, Form, InputNumber, Select, Typography, message } from "antd";
import { AdminShell } from "@/components/AdminShell";
import { useI18n } from "@/components/I18nProvider";
import { apiFetch } from "@/lib/client";

export default function ConfigPage() {
  const { t } = useI18n();
  const [form] = Form.useForm();
  useEffect(() => {
    (async () => {
      const res = await apiFetch<Record<string, unknown>>("/api/admin/config");
      if (res.ok && res.data) form.setFieldsValue(res.data);
    })();
  }, [form]);
  return (
    <AdminShell>
      <Typography.Title level={3}>{t("admin.config_title", "系统配置")}</Typography.Title>
      <Card>
        <Form
          form={form}
          layout="vertical"
          onFinish={async (values) => {
            const res = await apiFetch("/api/admin/config", { method: "PUT", body: JSON.stringify(values) });
            if (!res.ok) message.error(res.message || t("msg.fail", "失败"));
            else message.success(t("msg.saved", "已保存"));
          }}
        >
          <Form.Item name="commissionBps" label={t("admin.bps", "佣金（万分比，2000=20%）")} rules={[{ required: true }]}>
            <InputNumber min={0} max={10000} style={{ width: 240 }} />
          </Form.Item>
          <Form.Item name="confirmTimerStart" label={t("admin.path_b_start", "路径B确认计时起点")}>
            <Select
              options={[
                { value: "AFTER_BID_DEADLINE", label: "AFTER_BID_DEADLINE" },
                { value: "AFTER_FIRST_BID", label: "AFTER_FIRST_BID" },
              ]}
            />
          </Form.Item>
          <Form.Item name="confirmMinutes" label={t("admin.path_b_min", "路径B确认时长（分钟）")}>
            <InputNumber min={1} />
          </Form.Item>
          <Form.Item name="waitMatchHours" label={t("admin.wait_h", "等待匹配时长（小时）")}>
            <InputNumber min={1} />
          </Form.Item>
          <Form.Item name="extendHours" label={t("admin.extend_h", "客户延长时长（小时）")}>
            <InputNumber min={1} />
          </Form.Item>
          <Form.Item name="maxExtends" label={t("admin.extend_n", "可延长次数")}>
            <InputNumber min={0} />
          </Form.Item>
          <Form.Item name="auditMinutes" label={t("admin.audit_min", "平台审核时效（分钟）")}>
            <InputNumber min={1} />
          </Form.Item>
          <Form.Item name="bidLeadHours" label={t("admin.bid_lead_h", "报价截止提前量（小时）")}>
            <InputNumber min={0} />
          </Form.Item>
          <Form.Item name="negotiateMinutes" label={t("admin.nego_min", "运力协商响应时效（分钟）")}>
            <InputNumber min={1} />
          </Form.Item>
          <Button type="primary" htmlType="submit">
            {t("action.save", "保存")}
          </Button>
        </Form>
      </Card>
    </AdminShell>
  );
}
