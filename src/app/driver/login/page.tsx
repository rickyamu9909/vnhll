"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, Form, Input, Typography, message } from "antd";
import { LocaleSwitch } from "@/components/LocaleSwitch";
import { useI18n } from "@/components/I18nProvider";
import { apiFetch } from "@/lib/client";

export default function DriverLoginPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  return (
    <div className="auth-panel" style={{ maxWidth: 420, margin: "64px auto", padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, alignItems: "center" }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {t("auth.driver_entry", "司机端")} · {t("action.login", "登录")}
        </Typography.Title>
        <LocaleSwitch />
      </div>
      <Card>
        <Form
          layout="vertical"
          onFinish={async (values) => {
            setLoading(true);
            const res = await apiFetch<{ role: string }>("/api/auth/login", { method: "POST", body: JSON.stringify(values) });
            setLoading(false);
            if (!res.ok) return message.error(res.message || t("common.op_fail", "操作失败"));
            if (res.data?.role === "CUSTOMER" || res.data?.role === "ADMIN") return message.error(t("msg.fail", "失败"));
            router.push("/driver");
          }}
        >
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
        <div style={{ marginTop: 12 }}>
          <Link href="/driver/register">{t("action.register", "注册")}</Link>
        </div>
      </Card>
    </div>
  );
}
