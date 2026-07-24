"use client";

import { useEffect, useState } from "react";
import { Button, Card, Form, Input, Modal, Select, Space, Table, Tag, Typography, message } from "antd";
import { AdminShell } from "@/components/AdminShell";
import { useI18n } from "@/components/I18nProvider";
import { apiFetch, vehicleLabel } from "@/lib/client";

type Driver = {
  id: string;
  name: string;
  phone: string;
  vehicleType: string;
  plateNumber?: string;
  status: string;
  notes?: string;
};

export default function AdminDriversPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    const res = await apiFetch<Driver[]>("/api/admin/drivers");
    setLoading(false);
    if (!res.ok) {
      message.error(res.message || "加载失败");
      return;
    }
    setRows(res.data || []);
  };

  useEffect(() => {
    load();
  }, []);

  const act = async (id: string, action: string, reason?: string) => {
    const res = await apiFetch("/api/admin/drivers", {
      method: "PATCH",
      body: JSON.stringify({ id, action, reason }),
    });
    if (!res.ok) {
      message.error(res.message || "操作失败");
      return;
    }
    message.success("已更新");
    load();
  };

  const createDriver = async (values: Record<string, string>) => {
    const res = await apiFetch("/api/admin/drivers", {
      method: "POST",
      body: JSON.stringify({ ...values, status: "ACTIVE" }),
    });
    if (!res.ok) {
      message.error(res.message || "创建失败");
      return;
    }
    message.success("司机已创建");
    setOpen(false);
    form.resetFields();
    load();
  };

  return (
    <AdminShell>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {t("nav.admin_drivers", "司机管理")}
        </Typography.Title>
        <Button type="primary" onClick={() => setOpen(true)}>
          {t("action.create", "新建司机")}
        </Button>
      </div>
      <Card>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={rows}
          columns={[
            { title: "姓名", dataIndex: "name" },
            { title: "电话", dataIndex: "phone" },
            {
              title: "车型",
              dataIndex: "vehicleType",
              render: (v) => vehicleLabel(v, t),
            },
            { title: "车牌", dataIndex: "plateNumber", render: (v) => v || "-" },
            {
              title: "状态",
              dataIndex: "status",
              render: (v) => <Tag color={v === "ACTIVE" ? "green" : v === "PENDING" ? "gold" : "red"}>{v}</Tag>,
            },
            {
              title: "操作",
              render: (_, r) => (
                <Space>
                  {r.status === "PENDING" && (
                    <>
                      <Button size="small" type="primary" onClick={() => act(r.id, "approve")}>
                        通过
                      </Button>
                      <Button size="small" danger onClick={() => act(r.id, "reject", "资质不符")}>
                        拒绝
                      </Button>
                    </>
                  )}
                  {r.status === "ACTIVE" && (
                    <Button size="small" onClick={() => act(r.id, "disable")}>
                      停用
                    </Button>
                  )}
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <Modal title="新建司机" open={open} onCancel={() => setOpen(false)} onOk={() => form.submit()} destroyOnClose>
        <Form form={form} layout="vertical" onFinish={createDriver} initialValues={{ vehicleType: "TON_3_5" }}>
          <Form.Item name="name" label="姓名" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="电话" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="vehicleType" label="车型" rules={[{ required: true }]}>
            <Select
              options={["TON_1_5", "TON_3_5", "TON_7", "TON_10", "OTHER"].map((v) => ({
                value: v,
                label: vehicleLabel(v, t),
              }))}
            />
          </Form.Item>
          <Form.Item name="plateNumber" label="车牌">
            <Input />
          </Form.Item>
          <Form.Item name="idNumber" label="证件号">
            <Input />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </AdminShell>
  );
}
