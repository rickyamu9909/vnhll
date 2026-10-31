"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Card, Col, Form, Image, Input, Modal, Row, Select, Space, Table, Tag, Typography, message } from "antd";
import { ActionButton } from "@/components/ActionButton";
import { AdminShell } from "@/components/AdminShell";
import { QueryFields } from "@/components/QueryFields";
import { PhotoPicker } from "@/components/PhotoPicker";
import { useI18n } from "@/components/I18nProvider";
import { apiFetch, vehicleLabel } from "@/lib/client";
import { includesText } from "@/lib/order-view";

type RegRow = { id: string; username: string; displayName?: string; role: string; carrierKind?: string; status: string; companyName?: string; phone?: string };
type RegDetail = RegRow & {
  address?: string | null;
  contactName?: string | null;
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
  const [kind, setKind] = useState("PERSONAL");
  const [regs, setRegs] = useState<RegRow[]>([]);
  const [detail, setDetail] = useState<RegDetail | null>(null);
  const [query, setQuery] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const [res, regRes] = await Promise.all([apiFetch<Driver[]>("/api/admin/drivers"), apiFetch<RegRow[]>("/api/admin/registrations")]);
    setLoading(false);
    if (!res.ok) message.error(res.message || "加载失败");
    else setRows(res.data || []);
    if (regRes.ok) setRegs((regRes.data || []).filter((row) => row.role === "CARRIER_MAIN"));
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
    const photoUrls = [1, 2, 3, 4, 5, 6].map((index) => values[`photo${index}`]).filter(Boolean);
    const res = await apiFetch("/api/admin/drivers", {
      method: "POST",
      body: JSON.stringify({ ...values, mode: "account", kind, photoUrls, status: "ACTIVE" }),
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

  const shownRegs = useMemo(
    () =>
      regs.filter(
        (row) =>
          includesText(row.companyName || row.displayName || row.username, query.name) &&
          includesText(row.username, query.account) &&
          includesText(row.phone, query.phone) &&
          includesText(row.carrierKind, query.kind)
      ),
    [regs, query]
  );
  const shownDrivers = useMemo(
    () =>
      rows.filter(
        (row) =>
          includesText(row.name, query.name) &&
          includesText(row.phone, query.phone) &&
          includesText(row.plateNumber, query.plate) &&
          includesText(`${row.vehicleType} ${vehicleLabel(row.vehicleType, t)}`, query.vehicle)
      ),
    [rows, query, t]
  );

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
      <Card size="small" style={{ marginBottom: 16 }}>
        <QueryFields
          fields={[
            { name: "name", placeholder: t("admin.q_name_co", "姓名/公司") },
            { name: "phone", placeholder: t("admin.phone", "电话") },
            { name: "account", placeholder: t("admin.account", "账号") },
            { name: "plate", placeholder: t("team.plate", "车牌") },
            { name: "vehicle", placeholder: t("form.vehicle", "车型") },
            { name: "kind", placeholder: t("admin.type", "类型") },
          ]}
          onSearch={setQuery}
        />
      </Card>
      <Card title={t("admin.online_drivers", "注册司机")} size="small" style={{ marginBottom: 16 }}>
        <Table
          size="small"
          rowKey="id"
          dataSource={shownRegs}
          pagination={{ pageSize: 10 }}
          columns={[
            { title: t("admin.name", "名称"), render: (_, r) => r.companyName || r.displayName || r.username },
            { title: t("admin.account", "账号"), dataIndex: "username" },
            { title: t("admin.type", "类型"), dataIndex: "carrierKind", render: (v) => v || "-" },
            { title: t("admin.phone", "电话"), dataIndex: "phone" },
            {
              title: t("admin.status", "状态"),
              dataIndex: "status",
              render: (v) => (
                <Tag>{v === "ACTIVE" ? t("user.active", "已激活") : v === "PENDING" ? t("user.pending", "待审核") : v}</Tag>
              ),
            },
            {
              title: t("admin.op", "操作"),
              render: (_, r) => (
                <Button
                  size="small"
                  onClick={async () => {
                    const res = await apiFetch<RegDetail>(`/api/admin/registrations/${r.id}`);
                    if (!res.ok || !res.data) message.error(res.message || t("msg.load_fail", "加载失败"));
                    else setDetail(res.data);
                  }}
                >
                  {t("admin.view_profile", "查看资料")}
                </Button>
              ),
            },
          ]}
        />
      </Card>
      <Card title={t("admin.offline_drivers", "线下司机")} size="small">
        <Table
          rowKey="id"
          loading={loading}
          dataSource={shownDrivers}
          columns={[
            { title: t("team.name", "姓名"), dataIndex: "name" },
            { title: t("admin.phone", "电话"), dataIndex: "phone" },
            {
              title: t("form.vehicle", "车型"),
              dataIndex: "vehicleType",
              render: (v) => vehicleLabel(v, t),
            },
            { title: t("team.plate", "车牌"), dataIndex: "plateNumber", render: (v) => v || "-" },
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
              title: t("admin.op", "操作"),
              render: (_, r) => (
                <Space wrap>
                  {r.status === "PENDING" && (
                    <>
                      <ActionButton tone="primary" onClick={() => act(r.id, "approve")}>
                        {t("admin.pass", "通过")}
                      </ActionButton>
                      <ActionButton tone="danger" onClick={() => act(r.id, "reject", "资质不符")}>
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

      <Modal title={t("action.create", "新建司机")} open={open} width={860} onCancel={() => setOpen(false)} onOk={() => form.submit()} destroyOnClose>
        <Form form={form} layout="vertical" className="compact-form" onFinish={createDriver}>
          <Row gutter={8}>
            <Col span={8}>
              <Form.Item label={t("driver.kind", "注册类型")}>
                <Select
                  value={kind}
                  onChange={setKind}
                  options={[
                    { value: "PERSONAL", label: t("driver.personal", "个人司机") },
                    { value: "COMPANY", label: t("driver.company", "运输公司") },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="username" label={t("auth.username", "登录账号")} rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="password" label={t("auth.password", "密码")} rules={[{ required: true, min: 6 }]}>
                <Input.Password />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="contactName" label={t("auth.contact", "联系人")} rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="contactPhone" label={t("auth.contact_phone", "联系电话")} rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
          </Row>
          {kind === "COMPANY" ? (
            <Row gutter={8}>
              <Col span={8}>
                <Form.Item name="companyName" label={t("auth.company_name", "公司名称")} rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="address" label={t("form.address", "地址")} rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item name="licenseNo" label={t("driver.license", "营业执照")} rules={[{ required: true, message: t("form.required", "请上传") }]}>
                  <PhotoPicker />
                </Form.Item>
              </Col>
            </Row>
          ) : (
            <>
              <Row gutter={8}>
                {[
                  ["idNumber", t("driver.id_card", "身份证")],
                  ["driverLicense", t("driver.driver_license", "驾驶证")],
                  ["vehicleLicense", t("driver.vehicle_license", "行驶证")],
                  ["insuranceNote", t("driver.insurance", "保险证明")],
                ].map(([name, label]) => (
                  <Col span={6} key={name}>
                    <Form.Item name={name} label={label} rules={[{ required: true, message: t("form.required", "请上传") }]}>
                      <PhotoPicker />
                    </Form.Item>
                  </Col>
                ))}
              </Row>
              <div className="order-section">{t("driver.photos", "车辆照片（6 张）")}</div>
              <Row gutter={8}>
                {[1, 2, 3, 4, 5, 6].map((index) => (
                  <Col span={4} key={index}>
                    <Form.Item name={`photo${index}`} rules={[{ required: true, message: t("form.required", "请上传") }]}>
                      <PhotoPicker />
                    </Form.Item>
                  </Col>
                ))}
              </Row>
            </>
          )}
        </Form>
      </Modal>
      <Modal title="注册资料" open={!!detail} footer={null} width={760} onCancel={() => setDetail(null)}>
        {detail ? (
          <Space direction="vertical" style={{ width: "100%" }}>
            <Typography.Text>
              {detail.companyName || detail.displayName || detail.username} · {detail.contactName || "-"} · {detail.phone || "-"} · {detail.address || "-"}
            </Typography.Text>
            <Image.PreviewGroup>
              <Space wrap>
                {[
                  ["营业执照", detail.licenseNo],
                  ["身份证", detail.idNumber],
                  ["驾驶证", detail.driverLicense],
                  ["行驶证", detail.vehicleLicense],
                  ["保险证明", detail.insuranceNote],
                ].map(([title, src]) =>
                  src ? (
                    <div key={title}>
                      <div style={{ fontSize: 12 }}>{title}</div>
                      {isImage(src) ? <Image src={src} width={120} height={90} style={{ objectFit: "cover" }} /> : <span>{src}</span>}
                    </div>
                  ) : null
                )}
                {(detail.photos || []).map((src, index) => (
                  <div key={index}>
                    <div style={{ fontSize: 12 }}>车辆照片 {index + 1}</div>
                    <Image src={src} width={120} height={90} style={{ objectFit: "cover" }} />
                  </div>
                ))}
              </Space>
            </Image.PreviewGroup>
          </Space>
        ) : null}
      </Modal>
    </AdminShell>
  );
}
