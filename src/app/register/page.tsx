"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card, Form, Input, Typography, message, Alert } from "antd";
import { LocaleSwitch } from "@/components/LocaleSwitch";
import { useI18n } from "@/components/I18nProvider";
import { apiFetch } from "@/lib/client";

export default function RegisterPage() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const onFinish = async (values: Record<string, string>) => {
    setLoading(true);
    const res = await apiFetch("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(values),
    });
    setLoading(false);
    if (!res.ok) {
      message.error(res.message || "注册失败");
      return;
    }
    setDone(true);
  };

  return (
    <div style={{ maxWidth: 520, margin: "48px auto", padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {t("action.register", "企业注册")}
        </Typography.Title>
        <LocaleSwitch />
      </div>
      <Card>
        {done ? (
          <Alert
            type="success"
            showIcon
            message={t("auth.pending_tip", "账号待管理员审核，通过后方可登录下单。")}
            action={<Link href="/login">{t("action.login", "去登录")}</Link>}
          />
        ) : (
          <Form layout="vertical" onFinish={onFinish}>
            <Form.Item name="companyName" label={t("auth.company_name", "企业名称")} rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="username" label={t("auth.username", "用户名")} rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="password" label={t("auth.password", "密码")} rules={[{ required: true, min: 6 }]}>
              <Input.Password />
            </Form.Item>
            <Form.Item name="contactName" label="联系人">
              <Input />
            </Form.Item>
            <Form.Item name="contactPhone" label="联系电话">
              <Input />
            </Form.Item>
            <Form.Item name="taxCode" label="税号">
              <Input />
            </Form.Item>
            <Form.Item name="address" label="企业地址">
              <Input.TextArea rows={2} />
            </Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>
              {t("action.submit", "提交注册")}
            </Button>
          </Form>
        )}
      </Card>
    </div>
  );
}
