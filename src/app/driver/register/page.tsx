"use client";

import { useState } from "react";
import Link from "next/link";
import { Alert, Button, Card, Form, Input, Select, Typography, message } from "antd";
import { apiFetch } from "@/lib/client";

export default function DriverRegisterPage() {
  const [kind, setKind] = useState("COMPANY");
  const [done, setDone] = useState(false);
  return (
    <div style={{ maxWidth: 640, margin: "32px auto", padding: 16 }}>
      <Typography.Title level={3}>司机注册</Typography.Title>
      <Card>
        {done ? (
          <Alert type="success" message="已提交，请等待平台审核" action={<Link href="/driver/login">去登录</Link>} />
        ) : (
          <Form
            layout="vertical"
            initialValues={{ kind: "COMPANY", vehicleType: "TON_3_5" }}
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
            <Form.Item name="username" label="登录账号" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="password" label="密码" rules={[{ required: true, min: 6 }]}>
              <Input.Password />
            </Form.Item>
            <Form.Item name="contactPhone" label="联系电话" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item name="contactName" label="联系人" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            {kind === "COMPANY" ? (
              <>
                <Form.Item name="companyName" label="公司名称" rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
                <Form.Item name="address" label="地址" rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
                <Form.Item name="licenseNo" label="营业执照号" rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
              </>
            ) : (
              <>
                <Form.Item name="idNumber" label="身份证" rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
                <Form.Item name="driverLicense" label="驾驶证" rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
                <Form.Item name="vehicleLicense" label="行驶证" rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
                <Form.Item name="insuranceNote" label="保险证明" rules={[{ required: true }]}>
                  <Input />
                </Form.Item>
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <Form.Item key={i} name={`photo${i}`} label={`车辆照片 ${i}（图片地址）`} rules={[{ required: true }]}>
                    <Input />
                  </Form.Item>
                ))}
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
