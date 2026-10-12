"use client";

import { useRouter } from "next/navigation";
import { Button, Card, DatePicker, Form, Input, InputNumber, Select, Switch, Typography, message } from "antd";
import dayjs from "dayjs";
import { DriverShell } from "@/components/DriverShell";
import { BackButton } from "@/components/BackButton";
import { apiFetch } from "@/lib/client";

export default function NewCapacityPage() {
  const router = useRouter();
  return (
    <DriverShell>
      <BackButton href="/driver/capacity" />
      <Typography.Title level={3}>发布运力</Typography.Title>
      <Card>
        <Form
          layout="vertical"
          initialValues={{ vehicleType: "TON_3_5", airportOk: false, portOk: false, cargoTypes: "GENERAL" }}
          onFinish={async (values) => {
            const res = await apiFetch("/api/driver/capacity", {
              method: "POST",
              body: JSON.stringify({
                ...values,
                availableFrom: (values.availableFrom as dayjs.Dayjs).toISOString(),
                availableTo: (values.availableTo as dayjs.Dayjs).toISOString(),
              }),
            });
            if (!res.ok) return message.error(res.message || "发布失败");
            message.success("已发布");
            router.push("/driver/capacity");
          }}
        >
          <Form.Item name="location" label="当前空车位置" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="availableFrom" label="可接货开始" rules={[{ required: true }]}>
            <DatePicker showTime style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="availableTo" label="可接货结束" rules={[{ required: true }]}>
            <DatePicker showTime style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="destPreference" label="目的地偏好">
            <Input />
          </Form.Item>
          <Form.Item name="vehicleType" label="车型" rules={[{ required: true }]}>
            <Select options={["TON_1_5", "TON_3_5", "TON_7", "TON_10", "OTHER"].map((v) => ({ value: v, label: v }))} />
          </Form.Item>
          <Form.Item name="loadTons" label="载重（吨）" rules={[{ required: true }]}>
            <InputNumber min={0.1} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="cargoTypes" label="可承运货物类型" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="airportOk" label="可进机场" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="portOk" label="可进港口" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="expectedPriceVnd" label="期望价 VND" rules={[{ required: true }]}>
            <InputNumber min={1} style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input.TextArea />
          </Form.Item>
          <Button type="primary" htmlType="submit">
            发布
          </Button>
        </Form>
      </Card>
    </DriverShell>
  );
}
