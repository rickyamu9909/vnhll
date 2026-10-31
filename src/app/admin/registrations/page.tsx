"use client";

import { useEffect, useState } from "react";
import { Card, Descriptions, Form, Image, Input, Modal, Space, Table, Tag, Typography, message } from "antd";
import { ActionButton } from "@/components/ActionButton";
import { AdminShell } from "@/components/AdminShell";
import { PhotoPicker } from "@/components/PhotoPicker";
import { apiFetch, vehicleLabel } from "@/lib/client";
import { useI18n } from "@/components/I18nProvider";

type Row = {
  id: string;
  username: string;
  displayName?: string;
  role: string;
  carrierKind?: string;
  status: string;
  companyName?: string;
  phone?: string;
};

type Detail = Row & {
  taxCode?: string | null;
  address?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  rejectReason?: string | null;
  licenseNo?: string | null;
  licenseImage?: string | null;
  idNumber?: string | null;
  driverLicense?: string | null;
  vehicleLicense?: string | null;
  insuranceNote?: string | null;
  photos?: string[];
  vehicles?: Array<{ id: string; plateNumber: string; vehicleType: string; loadTons: number }>;
};

function isImage(value?: string | null) {
  return !!value && (value.startsWith("data:image/") || value.startsWith("http"));
}

function DocThumb({ title, src }: { title: string; src?: string | null }) {
  if (!src) return <Typography.Text type="secondary">{title}：未上传</Typography.Text>;
  return (
    <div>
      <div style={{ fontSize: 12, marginBottom: 4 }}>{title}</div>
      {isImage(src) ? <Image src={src} width={140} height={100} style={{ objectFit: "cover" }} /> : <Typography.Text>{src}</Typography.Text>}
    </div>
  );
}

export default function RegistrationsPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<Row[]>([]);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

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
      message.success(action === "approve" ? "已通过" : "已拒绝");
      setDetail(null);
      setEditing(false);
      load();
    }
  };

  const openDetail = async (id: string) => {
    const res = await apiFetch<Detail>(`/api/admin/registrations/${id}`);
    if (!res.ok || !res.data) return message.error(res.message || "加载失败");
    setDetail(res.data);
    setEditing(false);
    form.setFieldsValue({
      companyName: res.data.companyName || "",
      contactName: res.data.contactName || "",
      contactPhone: res.data.contactPhone || res.data.phone || "",
      taxCode: res.data.taxCode || "",
      address: res.data.address || "",
      licenseImage: res.data.licenseImage || res.data.licenseNo || "",
      licenseNo: res.data.licenseNo || "",
      idNumber: res.data.idNumber || "",
      driverLicense: res.data.driverLicense || "",
      vehicleLicense: res.data.vehicleLicense || "",
      insuranceNote: res.data.insuranceNote || "",
      photos: res.data.photos || [],
    });
  };

  const saveEdit = async () => {
    if (!detail) return;
    const values = await form.validateFields();
    setSaving(true);
    const payload =
      detail.role === "CUSTOMER"
        ? {
            companyName: values.companyName,
            contactName: values.contactName,
            contactPhone: values.contactPhone,
            taxCode: values.taxCode,
            address: values.address,
            licenseImage: values.licenseImage || "",
          }
        : {
            companyName: values.companyName,
            contactName: values.contactName,
            contactPhone: values.contactPhone,
            address: values.address,
            licenseNo: values.licenseNo || "",
            idNumber: values.idNumber || "",
            driverLicense: values.driverLicense || "",
            vehicleLicense: values.vehicleLicense || "",
            insuranceNote: values.insuranceNote || "",
            photos: values.photos || [],
          };
    const res = await apiFetch<Detail>(`/api/admin/registrations/${detail.id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!res.ok || !res.data) return message.error(res.message || "保存失败");
    message.success("资料已保存");
    setDetail(res.data);
    setEditing(false);
    load();
  };

  const isCustomer = detail?.role === "CUSTOMER";
  const isPersonal = detail?.carrierKind === "PERSONAL";

  return (
    <AdminShell>
      <Typography.Title level={3}>{t("admin.reg_title", "注册审核")}</Typography.Title>
      <Card>
        <Table
          rowKey="id"
          dataSource={rows}
          pagination={{ pageSize: 15, showSizeChanger: true, pageSizeOptions: ["15", "25", "50", "100", "500"] }}
          columns={[
            { title: t("admin.name", "名称"), render: (_, r) => r.companyName || r.displayName || r.username },
            { title: t("admin.account", "账号"), dataIndex: "username" },
            { title: t("admin.role", "角色"), render: (_, r) => `${r.role}${r.carrierKind ? "/" + r.carrierKind : ""}` },
            { title: t("admin.phone", "电话"), dataIndex: "phone" },
            {
              title: t("admin.status", "状态"),
              dataIndex: "status",
              render: (v) => <Tag>{v === "ACTIVE" ? t("user.active", "已激活") : v === "PENDING" ? t("user.pending", "待审核") : v === "REJECTED" ? t("user.rejected", "已拒绝") : v}</Tag>,
            },
            {
              title: t("admin.op", "操作"),
              render: (_, r) => (
                <Space wrap>
                  <ActionButton tone="cyan" onClick={() => openDetail(r.id)}>
                    {t("admin.view_profile", "查看资料")}
                  </ActionButton>
                  {r.status === "PENDING" ? (
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
                            content: <Input.TextArea onChange={(e) => (reason = e.target.value)} />,
                            onOk: () => act(r.id, "reject", reason),
                          });
                        }}
                      >
                        {t("admin.reject", "拒绝")}
                      </ActionButton>
                    </>
                  ) : null}
                </Space>
              ),
            },
          ]}
        />
      </Card>
      <Modal
        title="注册资料"
        open={!!detail}
        onCancel={() => {
          setDetail(null);
          setEditing(false);
        }}
        width={860}
        footer={
          detail ? (
            <Space wrap>
              {!editing ? (
                <ActionButton tone="cyan" onClick={() => setEditing(true)}>
                  编辑资料
                </ActionButton>
              ) : (
                <>
                  <ActionButton tone="default" onClick={() => setEditing(false)}>
                    取消编辑
                  </ActionButton>
                  <ActionButton tone="primary" loading={saving} onClick={saveEdit}>
                    保存
                  </ActionButton>
                </>
              )}
              {detail.status === "PENDING" ? (
                <>
                  <ActionButton tone="primary" onClick={() => act(detail.id, "approve")}>
                    通过
                  </ActionButton>
                  <ActionButton
                    tone="danger"
                    onClick={() => {
                      let reason = "";
                      Modal.confirm({
                        title: "拒绝原因",
                        content: <Input.TextArea onChange={(e) => (reason = e.target.value)} />,
                        onOk: () => act(detail.id, "reject", reason),
                      });
                    }}
                  >
                    拒绝
                  </ActionButton>
                </>
              ) : null}
            </Space>
          ) : null
        }
      >
        {detail ? (
          editing ? (
            <Form form={form} layout="vertical" className="compact-form">
              <Form.Item name="companyName" label={isCustomer || !isPersonal ? "企业名称" : "名称"}>
                <Input />
              </Form.Item>
              <Form.Item name="contactName" label="联系人" rules={[{ required: true, message: "请填写联系人" }]}>
                <Input />
              </Form.Item>
              <Form.Item name="contactPhone" label="联系电话" rules={[{ required: true, message: "请填写电话" }]}>
                <Input />
              </Form.Item>
              {isCustomer ? (
                <>
                  <Form.Item name="taxCode" label="税号">
                    <Input />
                  </Form.Item>
                  <Form.Item name="address" label="企业地址">
                    <Input.TextArea rows={2} />
                  </Form.Item>
                  <Form.Item name="licenseImage" label="营业执照">
                    <PhotoPicker />
                  </Form.Item>
                </>
              ) : isPersonal ? (
                <>
                  <Form.Item name="idNumber" label="身份证">
                    <PhotoPicker />
                  </Form.Item>
                  <Form.Item name="driverLicense" label="驾驶证">
                    <PhotoPicker />
                  </Form.Item>
                  <Form.Item name="vehicleLicense" label="行驶证">
                    <PhotoPicker />
                  </Form.Item>
                  <Form.Item name="insuranceNote" label="保险证明">
                    <PhotoPicker />
                  </Form.Item>
                </>
              ) : (
                <>
                  <Form.Item name="address" label="公司地址">
                    <Input.TextArea rows={2} />
                  </Form.Item>
                  <Form.Item name="licenseNo" label="营业执照">
                    <PhotoPicker />
                  </Form.Item>
                </>
              )}
            </Form>
          ) : (
            <Space direction="vertical" size={16} style={{ width: "100%" }}>
              <Descriptions bordered size="small" column={1}>
                <Descriptions.Item label="账号">{detail.username}</Descriptions.Item>
                <Descriptions.Item label="角色">{`${detail.role}${detail.carrierKind ? "/" + detail.carrierKind : ""}`}</Descriptions.Item>
                <Descriptions.Item label="状态">
                  <Tag>{detail.status}</Tag>
                </Descriptions.Item>
                <Descriptions.Item label={isCustomer || !isPersonal ? "企业名称" : "名称"}>
                  {detail.companyName || detail.displayName || "-"}
                </Descriptions.Item>
                <Descriptions.Item label="联系人">{detail.contactName || "-"}</Descriptions.Item>
                <Descriptions.Item label="联系电话">{detail.contactPhone || detail.phone || "-"}</Descriptions.Item>
                {isCustomer ? <Descriptions.Item label="税号">{detail.taxCode || "-"}</Descriptions.Item> : null}
                <Descriptions.Item label="地址">{detail.address || "-"}</Descriptions.Item>
                {detail.rejectReason ? (
                  <Descriptions.Item label="拒绝原因">
                    <Typography.Text type="danger">{detail.rejectReason}</Typography.Text>
                  </Descriptions.Item>
                ) : null}
              </Descriptions>
              <Image.PreviewGroup>
                <Space wrap size={16}>
                  {isCustomer || !isPersonal ? <DocThumb title="营业执照" src={detail.licenseImage || detail.licenseNo} /> : null}
                  {isPersonal ? (
                    <>
                      <DocThumb title="身份证" src={detail.idNumber} />
                      <DocThumb title="驾驶证" src={detail.driverLicense} />
                      <DocThumb title="行驶证" src={detail.vehicleLicense} />
                      <DocThumb title="保险证明" src={detail.insuranceNote} />
                      {(detail.photos || []).map((src, i) => (
                        <DocThumb key={`${i}-${src.slice(0, 24)}`} title={`车辆照片 ${i + 1}`} src={src} />
                      ))}
                    </>
                  ) : null}
                </Space>
              </Image.PreviewGroup>
              {detail.vehicles && detail.vehicles.length ? (
                <div>
                  <Typography.Text strong>车辆</Typography.Text>
                  <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
                    {detail.vehicles.map((v) => (
                      <li key={v.id}>
                        {v.plateNumber} · {vehicleLabel(v.vehicleType, t)} · {v.loadTons} 吨
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </Space>
          )
        ) : null}
      </Modal>
    </AdminShell>
  );
}
