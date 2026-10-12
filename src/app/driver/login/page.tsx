"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, Form, Input, Typography, message } from "antd";
import { apiFetch } from "@/lib/client";

export default function DriverLoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  return (
    <div style={{ maxWidth: 420, margin: "64px auto", padding: 16 }}>
      <Typography.Title level={3}>司机端登录</Typography.Title>
      <Card>
        <Form
          layout="vertical"
          onFinish={async (values) => {
            setLoading(true);
            const res = await apiFetch<{ role: string }>("/api/auth/login", { method: "POST", body: JSON.stringify(values) });
            setLoading(false);
            if (!res.ok) return message.error(res.message || "登录失败");
            if (res.data?.role === "CUSTOMER" || res.data?.role === "ADMIN") return message.error("请使用司机账号登录");
            router.push("/driver");
          }}
        >
          <Form.Item name="username" label="账号" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="password" label="密码" rules={[{ required: true }]}>
            <Input.Password />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={loading}>
            登录
          </Button>
        </Form>
        <div style={{ marginTop: 12 }}>
          <Link href="/driver/register">注册公司或个人司机</Link>
        </div>
      </Card>
    </div>
  );
}
