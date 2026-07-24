"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card, Form, Input, Typography, message } from "antd";
import { LocaleSwitch } from "@/components/LocaleSwitch";
import { useI18n } from "@/components/I18nProvider";
import { apiFetch } from "@/lib/client";

export default function AdminLoginPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true);
    const res = await apiFetch<{ role: string; redirectTo: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(values),
    });
    setLoading(false);
    if (!res.ok) {
      message.error(res.message || "登录失败");
      return;
    }
    if (res.data && (res.data as { role?: string }).role && (res.data as { role: string }).role !== "ADMIN") {
      message.error("请使用管理员账号登录");
      return;
    }
    router.push("/admin");
  };

  return (
    <div style={{ maxWidth: 420, margin: "80px auto", padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          管理端登录
        </Typography.Title>
        <LocaleSwitch />
      </div>
      <Card>
        <Form layout="vertical" onFinish={onFinish} initialValues={{ username: "admin" }}>
          <Form.Item name="username" label={t("auth.username", "用户名")} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="password" label={t("auth.password", "密码")} rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>
            {t("action.login", "登录")}
          </Button>
        </Form>
      </Card>
    </div>
  );
}
