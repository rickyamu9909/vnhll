"use client";

import { useEffect, useState } from "react";
import { Button, Card, Form, Input, InputNumber, Select, Table, Typography, message } from "antd";
import { DriverShell } from "@/components/DriverShell";
import { apiFetch } from "@/lib/client";

export default function TeamPage() {
  const [subs, setSubs] = useState<Array<{ id: string; username: string; displayName?: string; phone?: string }>>([]);
  const load = async () => {
    const res = await apiFetch<{ subs: Array<{ id: string; username: string; displayName?: string; phone?: string }> }>("/api/driver/team");
    if (!res.ok) return;
    setSubs(res.data?.subs || []);
  };
  useEffect(() => {
    load();
  }, []);
  return (
    <DriverShell>
      <Typography.Title level={3}>司机与车辆</Typography.Title>
      <Card title="添加子账号" style={{ marginBottom: 16 }}>
        <Form
          layout="inline"
          onFinish={async (values) => {
            const res = await apiFetch("/api/driver/team", { method: "POST", body: JSON.stringify(values) });
            if (!res.ok) message.error(res.message || "失败");
            else {
              message.success("已添加");
              load();
            }
          }}
        >
          <Form.Item name="name" rules={[{ required: true }]}>
            <Input placeholder="姓名" />
          </Form.Item>
          <Form.Item name="phone" rules={[{ required: true }]}>
            <Input placeholder="电话" />
          </Form.Item>
          <Form.Item name="username" rules={[{ required: true }]}>
            <Input placeholder="登录账号" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true }]}>
            <Input.Password placeholder="密码" />
          </Form.Item>
          <Form.Item name="plateNumber">
            <Input placeholder="车牌" />
          </Form.Item>
          <Form.Item name="vehicleType" initialValue="TON_3_5">
            <Select style={{ width: 120 }} options={["TON_1_5", "TON_3_5", "TON_7", "TON_10"].map((v) => ({ value: v, label: v }))} />
          </Form.Item>
          <Form.Item name="loadTons" initialValue={3.5}>
            <InputNumber placeholder="载重吨" />
          </Form.Item>
          <Button type="primary" htmlType="submit">
            添加
          </Button>
        </Form>
      </Card>
      <Card>
        <Table rowKey="id" dataSource={subs} columns={[{ title: "姓名", dataIndex: "displayName" }, { title: "账号", dataIndex: "username" }, { title: "电话", dataIndex: "phone" }]} />
      </Card>
    </DriverShell>
  );
}
