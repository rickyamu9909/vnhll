"use client";

import { useEffect, useState } from "react";
import { Button, Card, Image, Input, Modal, Space, Table, Tag, Typography, message } from "antd";
import { AdminShell } from "@/components/AdminShell";
import { apiFetch } from "@/lib/client";

type Row = { id: string; username: string; displayName?: string; role: string; carrierKind?: string; status: string; companyName?: string; phone?: string };
type Detail = Row & {
  address?: string | null;
  contactName?: string | null;
  rejectReason?: string | null;
  licenseNo?: string | null;
  idNumber?: string | null;
  driverLicense?: string | null;
  vehicleLicense?: string | null;
  insuranceNote?: string | null;
  photos?: string[];
};

function isImage(value?: string | null) {
  return !!value && (value.startsWith("data:image/") || value.startsWith("http"));
}

function DocThumb({ title, src }: { title: string; src?: string | null }) {
  if (!src) return null;
  return (
    <div>
      <div style={{ fontSize: 12, marginBottom: 4 }}>{title}</div>
      {isImage(src) ? <Image src={src} width={120} height={90} style={{ objectFit: "cover" }} /> : <Typography.Text>{src}</Typography.Text>}
    </div>
  );
}

export default function RegistrationsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
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
    else {
      setDetail(null);
      load();
    }
  };
  const openDetail = async (id: string) => {
    const res = await apiFetch<Detail>(`/api/admin/registrations/${id}`);
    if (!res.ok || !res.data) return message.error(res.message || "加载失败");
    setDetail(res.data);
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
              render: (_, r) => (
                <Space>
                  <Button size="small" onClick={() => openDetail(r.id)}>
                    查看资料
                  </Button>
                  {r.status === "PENDING" ? (
                    <>
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
                    </>
                  ) : null}
                </Space>
              ),
            },
          ]}
        />
      </Card>
      <Modal title="注册资料" open={!!detail} footer={null} onCancel={() => setDetail(null)} width={720}>
        {detail ? (
          <Space direction="vertical" size={12} style={{ width: "100%" }}>
            <Typography.Text>
              {detail.companyName || detail.displayName || detail.username} · {detail.phone || "-"} · {detail.address || "-"}
            </Typography.Text>
            <Image.PreviewGroup>
              <Space wrap size={12}>
                <DocThumb title="营业执照" src={detail.licenseNo} />
                <DocThumb title="身份证" src={detail.idNumber} />
                <DocThumb title="驾驶证" src={detail.driverLicense} />
                <DocThumb title="行驶证" src={detail.vehicleLicense} />
                <DocThumb title="保险证明" src={detail.insuranceNote} />
                {(detail.photos || []).map((src, i) => (
                  <DocThumb key={src.slice(0, 32) + i} title={`车辆照片 ${i + 1}`} src={src} />
                ))}
              </Space>
            </Image.PreviewGroup>
          </Space>
        ) : null}
      </Modal>
    </AdminShell>
  );
}
