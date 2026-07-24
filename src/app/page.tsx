"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, Form, Input, Typography, message, Space } from "antd";
import { LocaleSwitch } from "@/components/LocaleSwitch";
import { useI18n } from "@/components/I18nProvider";
import { apiFetch } from "@/lib/client";

export default function HomePage() {
  const router = useRouter();
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true);
    const res = await apiFetch<{ redirectTo: string }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify(values),
    });
    setLoading(false);
    if (!res.ok) {
      message.error(res.message || "登录失败");
      return;
    }
    message.success("登录成功");
    router.push(res.data?.redirectTo || "/orders");
  };

  return (
    <div className="page-shell">
      <div className="hero-panel" style={{ padding: "48px 24px 80px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <Typography.Title level={2} style={{ color: "#fff", margin: 0 }}>
            {t("app.name", "ANTS 越南散货车")}
          </Typography.Title>
          <LocaleSwitch />
        </div>
        <div style={{ maxWidth: 960, margin: "32px auto 0" }}>
          <Typography.Title level={1} style={{ color: "#fff", marginBottom: 8 }}>
            ANTS
          </Typography.Title>
          <Typography.Paragraph style={{ color: "rgba(255,255,255,0.85)", fontSize: 16, maxWidth: 520 }}>
            企业散货下单 · 管理端撮合派单 · MVP
          </Typography.Paragraph>
        </div>
      </div>

      <div style={{ maxWidth: 420, margin: "-48px auto 48px", padding: "0 16px" }}>
        <Card title={t("action.login", "登录")}>
          <Form layout="vertical" onFinish={onFinish}>
            <Form.Item name="username" label={t("auth.username", "用户名")} rules={[{ required: true }]}>
              <Input placeholder="河内快运物流 / admin" />
            </Form.Item>
            <Form.Item name="password" label={t("auth.password", "密码")} rules={[{ required: true }]}>
              <Input.Password />
            </Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>
              {t("action.login", "登录")}
            </Button>
          </Form>
          <Space style={{ marginTop: 16 }} split="|">
            <Link href="/register">{t("action.register", "注册")}</Link>
            <Link href="/admin/login">管理端</Link>
          </Space>
        </Card>
      </div>
    </div>
  );
}
