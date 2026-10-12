"use client";

import { useEffect, useState } from "react";
import { Button, Card, Input, Modal, Space, Table, Tag, Typography, message } from "antd";
import { AdminShell } from "@/components/AdminShell";
import { apiFetch } from "@/lib/client";

type Row = { id: string; username: string; displayName?: string; role: string; carrierKind?: string; status: string; companyName?: string; phone?: string };

export default function RegistrationsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const load = async () => {
    const res = await apiFetch<Row[]>("/api/admin/registrations");
    if (res.ok) setRows(res.data || []);
  };
  useEffect(() => {
    load();
  }, []);
  const act = async (id: string, action: string, reason?: string) => {
    const res = await apiFetch("/api/admin/registrations", { method: "PATCH", body: JSON.stringify({ id, action, reason }) });
    if (!res.ok) message.error(res.message || "失败");
    else load();
  };
  return (
    <AdminShell>
      <Typography.Title level={3}>注册审核</Typography.Title>
      <Card>
        <Table
          rowKey="id"
          dataSource={rows}
          pagination={{ pageSize: 15, showSizeChanger: true, pageSizeOptions: ["15", "25", "50", "100", "500"] }}
          columns={[
            { title: "名称", render: (_, r) => r.companyName || r.displayName || r.username },
            { title: "账号", dataIndex: "username" },
            { title: "角色", render: (_, r) => `${r.role}${r.carrierKind ? "/" + r.carrierKind : ""}` },
            { title: "电话", dataIndex: "phone" },
            { title: "状态", dataIndex: "status", render: (v) => <Tag>{v}</Tag> },
            {
              title: "操作",
              render: (_, r) =>
                r.status === "PENDING" ? (
                  <Space>
                    <Button size="small" type="primary" onClick={() => act(r.id, "approve")}>
                      通过
                    </Button>
                    <Button
                      size="small"
                      danger
                      onClick={() => {
                        let reason = "";
                        Modal.confirm({
                          title: "拒绝原因",
                          content: <Input.TextArea onChange={(e) => (reason = e.target.value)} />,
                          onOk: () => act(r.id, "reject", reason),
                        });
                      }}
                    >
                      拒绝
                    </Button>
                  </Space>
                ) : null,
            },
          ]}
        />
      </Card>
    </AdminShell>
  );
}
