"use client";

import { useEffect, useState } from "react";
import { Button, Card, Form, Input, Modal, Space, Table, Tag, Typography, message } from "antd";
import dayjs from "dayjs";
import { ActionButton } from "@/components/ActionButton";
import { AdminShell } from "@/components/AdminShell";
import { useI18n } from "@/components/I18nProvider";
import { apiFetch } from "@/lib/client";

type Customer = {
  id: string;
  username: string;
  displayName?: string;
  phone?: string;
  status: string;
  rejectReason?: string;
  createdAt: string;
  company?: { companyName: string; contactName?: string; contactPhone?: string; address?: string };
};

export default function AdminCustomersPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form] = Form.useForm();

  const load = async () => {
    setLoading(true);
    const res = await apiFetch<Customer[]>("/api/admin/customers");
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
    const res = await apiFetch("/api/admin/customers", {
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

  const openEdit = (row?: Customer) => {
    setEditing(row || null);
    form.setFieldsValue(
      row
        ? {
            username: row.username,
            companyName: row.company?.companyName,
            contactName: row.company?.contactName,
            contactPhone: row.company?.contactPhone || row.phone,
            address: row.company?.address,
          }
        : { username: "", companyName: "", contactName: "", contactPhone: "", address: "", password: "" }
    );
    setOpen(true);
  };

  const save = async (values: Record<string, string>) => {
    const res = editing
      ? await apiFetch("/api/admin/customers", { method: "PATCH", body: JSON.stringify({ id: editing.id, action: "update", ...values }) })
      : await apiFetch("/api/admin/customers", { method: "POST", body: JSON.stringify(values) });
    if (!res.ok) return message.error(res.message || "保存失败");
    message.success("已保存");
    setOpen(false);
    load();
  };

  return (
    <AdminShell>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {t("nav.admin_customers", "客户管理")}
        </Typography.Title>
        <Button type="primary" onClick={() => openEdit()}>
          {t("admin.add_customer", "新增客户")}
        </Button>
      </div>
      <Card>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={rows}
          columns={[
            { title: t("admin.company", "企业"), render: (_, r) => r.company?.companyName || r.displayName || "-" },
            { title: t("admin.username", "用户名"), dataIndex: "username" },
            { title: t("admin.contact_phone", "联系电话"), render: (_, r) => r.company?.contactPhone || r.phone || "-" },
            {
              title: t("admin.status", "状态"),
              dataIndex: "status",
              render: (v) => (
                <Tag color={v === "ACTIVE" ? "green" : v === "PENDING" ? "gold" : "red"}>
                  {v === "ACTIVE" ? t("user.active", "已激活") : v === "PENDING" ? t("user.pending", "待审核") : v === "DISABLED" ? t("user.disabled", "已停用") : v}
                </Tag>
              ),
            },
            {
              title: t("admin.reg_at", "注册时间"),
              dataIndex: "createdAt",
              render: (v) => dayjs(v).format("YYYY-MM-DD HH:mm"),
            },
            {
              title: t("admin.op", "操作"),
              render: (_, r) => (
                <Space wrap>
                  <ActionButton tone="cyan" onClick={() => openEdit(r)}>
                    {t("admin.edit_customer", "编辑")}
                  </ActionButton>
                  {r.status === "PENDING" && (
                    <>
                      <ActionButton tone="primary" onClick={() => act(r.id, "approve")}>
                        {t("admin.pass", "通过")}
                      </ActionButton>
                      <ActionButton
                        tone="danger"
                        onClick={() => {
                          let reason = "";
                          Modal.confirm({
                            title: t("admin.reject", "拒绝"),
                            content: (
                              <Input
                                defaultValue={reason}
                                onChange={(e) => {
                                  reason = e.target.value;
                                }}
                              />
                            ),
                            onOk: () => act(r.id, "reject", reason),
                          });
                        }}
                      >
                        {t("admin.reject", "拒绝")}
                      </ActionButton>
                    </>
                  )}
                  {r.status === "ACTIVE" && (
                    <ActionButton tone="orange" onClick={() => act(r.id, "disable")}>
                      {t("admin.disable", "停用")}
                    </ActionButton>
                  )}
                </Space>
              ),
            },
          ]}
        />
      </Card>
      <Modal
        title={editing ? t("admin.edit_customer", "编辑客户") : t("admin.add_customer", "新增客户")}
        open={open}
        onCancel={() => setOpen(false)}
        onOk={() => form.submit()}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={save}>
          {!editing ? (
            <Form.Item name="username" label="登录账号" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
          ) : null}
          <Form.Item name="password" label={editing ? "新密码（不改可留空）" : "密码"} rules={editing ? [] : [{ required: true, min: 6 }]}>
            <Input.Password />
          </Form.Item>
          <Form.Item name="companyName" label="企业名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="contactName" label="联系人" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="contactPhone" label="电话" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="address" label="地址">
            <Input />
          </Form.Item>
        </Form>
      </Modal>
    </AdminShell>
  );
}
