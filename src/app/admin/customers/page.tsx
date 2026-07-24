"use client";

import { useEffect, useState } from "react";
import { Button, Card, Space, Table, Tag, Typography, message, Modal, Input } from "antd";
import dayjs from "dayjs";
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
  company?: { companyName: string; contactName?: string; contactPhone?: string };
};

export default function AdminCustomersPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <AdminShell>
      <Typography.Title level={3}>{t("nav.admin_customers", "客户管理")}</Typography.Title>
      <Card>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={rows}
          columns={[
            { title: "企业", render: (_, r) => r.company?.companyName || r.displayName || "-" },
            { title: "用户名", dataIndex: "username" },
            { title: "联系电话", render: (_, r) => r.company?.contactPhone || r.phone || "-" },
            {
              title: "状态",
              dataIndex: "status",
              render: (v) => <Tag color={v === "ACTIVE" ? "green" : v === "PENDING" ? "gold" : "red"}>{v}</Tag>,
            },
            {
              title: "注册时间",
              dataIndex: "createdAt",
              render: (v) => dayjs(v).format("YYYY-MM-DD HH:mm"),
            },
            {
              title: "操作",
              render: (_, r) => (
                <Space>
                  {r.status === "PENDING" && (
                    <>
                      <Button size="small" type="primary" onClick={() => act(r.id, "approve")}>
                        {t("action.approve", "通过")}
                      </Button>
                      <Button
                        size="small"
                        danger
                        onClick={() => {
                          let reason = "资料不全";
                          Modal.confirm({
                            title: "拒绝客户",
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
                        {t("action.reject", "拒绝")}
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
    </AdminShell>
  );
}
