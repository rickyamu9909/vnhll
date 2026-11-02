"use client";

import { useState } from "react";
import Link from "next/link";
import { Alert, Button, Card, Col, Form, Input, Row, Select, Typography, message } from "antd";
import { LocaleSwitch } from "@/components/LocaleSwitch";
import { PhotoPicker } from "@/components/PhotoPicker";
import { useI18n } from "@/components/I18nProvider";
import { apiFetch } from "@/lib/client";

export default function DriverRegisterPage() {
  const { t } = useI18n();
  const [kind, setKind] = useState("COMPANY");
  const [done, setDone] = useState(false);

  const docs = [
    { name: "idNumber", labelKey: "driver.id_card", fallback: "身份证" },
    { name: "driverLicense", labelKey: "driver.driver_license", fallback: "驾驶证" },
    { name: "vehicleLicense", labelKey: "driver.vehicle_license", fallback: "行驶证" },
    { name: "insuranceNote", labelKey: "driver.insurance", fallback: "保险证明" },
  ];

  return (
    <div className="auth-panel" style={{ maxWidth: 760, margin: "32px auto", padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, gap: 12 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {t("driver.register_title", "司机注册")}
        </Typography.Title>
        <LocaleSwitch />
      </div>
      <Card>
        {done ? (
          <Alert
            type="success"
            showIcon
            message={t("driver.pending_tip", "已提交，请等待平台审核")}
            action={<Link href="/driver/login">{t("action.go_login", "去登录")}</Link>}
          />
        ) : (
          <Form
            className="compact-form"
            layout="vertical"
            initialValues={{ kind: "COMPANY" }}
            onFinish={async (values) => {
              const photoUrls = [1, 2, 3, 4, 5, 6].map((i) => values[`photo${i}`]).filter(Boolean);
              const res = await apiFetch("/api/auth/register-carrier", {
                method: "POST",
                body: JSON.stringify({ ...values, kind, photoUrls }),
              });
              if (!res.ok) return message.error(res.message || t("auth.register_fail", "注册失败"));
              setDone(true);
            }}
          >
            <Row gutter={8}>
              <Col xs={24} md={12}>
                <Form.Item label={t("driver.kind", "注册类型")}>
                  <Select
                    value={kind}
                    onChange={setKind}
                    options={[
                      { value: "COMPANY", label: t("driver.company", "运输公司") },
                      { value: "PERSONAL", label: t("driver.personal", "个人司机") },
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="username" label={t("auth.username", "登录账号")} rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="password" label={t("auth.password", "密码")} rules={[{ required: true, min: 6 }]}>
                  <Input.Password />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="contactPhone" label={t("auth.contact_phone", "联系电话")} rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="contactName" label={t("auth.contact", "联系人")} rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
              </Col>
            </Row>
            {kind === "COMPANY" ? (
              <Row gutter={8}>
                <Col xs={24} md={12}>
                  <Form.Item name="companyName" label={t("auth.company_name", "企业名称")} rules={[{ required: true }]}>
                    <Input />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="address" label={t("auth.company_address", "企业地址")} rules={[{ required: true }]}>
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={24}>
                  <Form.Item
                    name="licenseNo"
                    label={t("driver.license", "营业执照")}
                    rules={[{ required: true, message: t("driver.need_license", "请上传营业执照") }]}
                  >
                    <PhotoPicker />
                  </Form.Item>
                </Col>
              </Row>
            ) : (
              <>
                <Row gutter={8}>
                  {docs.map((doc) => (
                    <Col key={doc.name} xs={12} md={6}>
                      <Form.Item name={doc.name} label={t(doc.labelKey, doc.fallback)} rules={[{ required: true, message: t("driver.need_upload", "请上传") }]}>
                        <PhotoPicker />
                      </Form.Item>
                    </Col>
                  ))}
                </Row>
                <div className="order-section">{t("driver.photos", "车辆照片（6 张）")}</div>
                <Row gutter={8}>
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <Col key={i} xs={8} md={4}>
                      <Form.Item name={`photo${i}`} rules={[{ required: true, message: t("driver.need_upload", "请上传") }]}>
                        <PhotoPicker />
                      </Form.Item>
                    </Col>
                  ))}
                </Row>
              </>
            )}
            <Button type="primary" htmlType="submit">
              {t("driver.submit_audit", "提交审核")}
            </Button>
          </Form>
        )}
      </Card>
    </div>
  );
}
