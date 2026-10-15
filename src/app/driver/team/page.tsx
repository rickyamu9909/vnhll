"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Card, Form, Input, InputNumber, Select, Table, Typography, message } from "antd";
import { DriverShell } from "@/components/DriverShell";
import { QueryFields } from "@/components/QueryFields";
import { apiFetch } from "@/lib/client";
import { includesText } from "@/lib/order-view";

export default function TeamPage() {
  const [subs, setSubs] = useState<Array<{ id: string; username: string; displayName?: string; phone?: string; plate?: string }>>([]);
  const [query, setQuery] = useState<Record<string, string>>({});
  const load = async () => {
    const res = await apiFetch<{
      subs: Array<{ id: string; username: string; displayName?: string; phone?: string }>;
      vehicles: Array<{ assignedUserId?: string | null; plateNumber: string }>;
    }>("/api/driver/team");
    if (!res.ok) return;
    const vehicles = res.data?.vehicles || [];
    setSubs(
      (res.data?.subs || []).map((sub) => ({
        ...sub,
        plate: vehicles
          .filter((vehicle) => vehicle.assignedUserId === sub.id)
          .map((vehicle) => vehicle.plateNumber)
          .join(" "),
      }))
    );
  };
  useEffect(() => {
    load();
  }, []);
  const shown = useMemo(
    () => subs.filter((row) => includesText(row.displayName, query.name) && includesText(row.phone, query.phone) && includesText(row.username, query.account) && includesText(row.plate, query.plate)),
    [subs, query]
  );
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
        <QueryFields
          fields={[
            { name: "name", placeholder: "姓名" },
            { name: "phone", placeholder: "电话" },
            { name: "account", placeholder: "账号" },
            { name: "plate", placeholder: "车牌" },
          ]}
          onSearch={setQuery}
        />
        <Table rowKey="id" dataSource={shown} columns={[{ title: "姓名", dataIndex: "displayName" }, { title: "账号", dataIndex: "username" }, { title: "电话", dataIndex: "phone" }, { title: "车牌", dataIndex: "plate", render: (value) => value || "-" }]} />
      </Card>
    </DriverShell>
  );
}
