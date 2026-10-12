"use client";

import { useEffect } from "react";
import { Button, Card, Form, InputNumber, Select, Typography, message } from "antd";
import { AdminShell } from "@/components/AdminShell";
import { apiFetch } from "@/lib/client";

export default function ConfigPage() {
  const [form] = Form.useForm();
  useEffect(() => {
    (async () => {
      const res = await apiFetch<Record<string, unknown>>("/api/admin/config");
      if (res.ok && res.data) form.setFieldsValue(res.data);
    })();
  }, [form]);
  return (
    <AdminShell>
      <Typography.Title level={3}>系统配置</Typography.Title>
      <Card>
        <Form
          form={form}
          layout="vertical"
          onFinish={async (values) => {
            const res = await apiFetch("/api/admin/config", { method: "PUT", body: JSON.stringify(values) });
            if (!res.ok) message.error(res.message || "保存失败");
            else message.success("已保存，仅影响新发布订单");
          }}
        >
          <Form.Item name="commissionBps" label="佣金（万分比，2000=20%）" rules={[{ required: true }]}>
            <InputNumber min={0} max={10000} style={{ width: 240 }} />
          </Form.Item>
          <Form.Item name="confirmTimerStart" label="路径B确认计时起点">
            <Select
              options={[
                { value: "AFTER_BID_DEADLINE", label: "报价截止后" },
                { value: "AFTER_FIRST_BID", label: "司机首次报价后" },
              ]}
            />
          </Form.Item>
          <Form.Item name="confirmMinutes" label="路径B确认时长（分钟）">
            <InputNumber min={1} />
          </Form.Item>
          <Form.Item name="waitMatchHours" label="等待匹配时长（小时）">
            <InputNumber min={1} />
          </Form.Item>
          <Form.Item name="extendHours" label="客户延长时长（小时）">
            <InputNumber min={1} />
          </Form.Item>
          <Form.Item name="maxExtends" label="可延长次数">
            <InputNumber min={0} />
          </Form.Item>
          <Form.Item name="auditMinutes" label="平台审核时效（分钟）">
            <InputNumber min={1} />
          </Form.Item>
          <Form.Item name="bidLeadHours" label="报价截止提前量（小时）">
            <InputNumber min={0} />
          </Form.Item>
          <Form.Item name="negotiateMinutes" label="运力协商响应时效（分钟）">
            <InputNumber min={1} />
          </Form.Item>
          <Button type="primary" htmlType="submit">
            保存
          </Button>
        </Form>
      </Card>
    </AdminShell>
  );
}
