"use client";

import { useState } from "react";
import Link from "next/link";
import { Alert, Button, Card, Col, Form, Input, Row, Select, Typography, message } from "antd";
import { PhotoPicker } from "@/components/PhotoPicker";
import { apiFetch } from "@/lib/client";

const docs = [
  { name: "idNumber", label: "身份证" },
  { name: "driverLicense", label: "驾驶证" },
  { name: "vehicleLicense", label: "行驶证" },
  { name: "insuranceNote", label: "保险证明" },
];

export default function DriverRegisterPage() {
  const [kind, setKind] = useState("COMPANY");
  const [done, setDone] = useState(false);
  return (
    <div className="auth-panel" style={{ maxWidth: 760, margin: "32px auto", padding: 16 }}>
      <Typography.Title level={3}>司机注册</Typography.Title>
      <Card>
        {done ? (
          <Alert type="success" message="已提交，请等待平台审核" action={<Link href="/driver/login">去登录</Link>} />
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
              if (!res.ok) return message.error(res.message || "注册失败");
              setDone(true);
            }}
          >
            <Row gutter={8}>
              <Col xs={24} md={12}>
                <Form.Item label="注册类型">
                  <Select
                    value={kind}
                    onChange={setKind}
                    options={[
                      { value: "COMPANY", label: "运输公司" },
                      { value: "PERSONAL", label: "个人司机" },
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="username" label="登录账号" rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="password" label="密码" rules={[{ required: true, min: 6 }]}>
                  <Input.Password />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="contactPhone" label="联系电话" rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="contactName" label="联系人" rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
              </Col>
            </Row>
            {kind === "COMPANY" ? (
              <Row gutter={8}>
                <Col xs={24} md={12}>
                  <Form.Item name="companyName" label="公司名称" rules={[{ required: true }]}>
                    <Input />
                  </Form.Item>
                </Col>
                <Col xs={24} md={12}>
                  <Form.Item name="address" label="地址" rules={[{ required: true }]}>
                    <Input />
                  </Form.Item>
                </Col>
                <Col span={24}>
                  <Form.Item name="licenseNo" label="营业执照照片" rules={[{ required: true, message: "请上传营业执照" }]}>
                    <PhotoPicker />
                  </Form.Item>
                </Col>
              </Row>
            ) : (
              <>
                <Row gutter={8}>
                  {docs.map((doc) => (
                    <Col key={doc.name} xs={12} md={6}>
                      <Form.Item name={doc.name} label={doc.label} rules={[{ required: true, message: "请上传" }]}>
                        <PhotoPicker />
                      </Form.Item>
                    </Col>
                  ))}
                </Row>
                <div className="order-section">车辆照片（6 张）</div>
                <Row gutter={8}>
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <Col key={i} xs={8} md={4}>
                      <Form.Item name={`photo${i}`} rules={[{ required: true, message: "请上传" }]}>
                        <PhotoPicker />
                      </Form.Item>
                    </Col>
                  ))}
                </Row>
              </>
            )}
            <Button type="primary" htmlType="submit">
              提交审核
            </Button>
          </Form>
        )}
      </Card>
    </div>
  );
}
