"use client";

import { Col, DatePicker, Form, Input, InputNumber, Row, Select } from "antd";
import { useI18n } from "@/components/I18nProvider";
import { vehicleLabel } from "@/lib/client";

export function OrderFormFields() {
  const { t } = useI18n();
  const vehicleOptions = ["TON_1_5", "TON_3_5", "TON_7", "TON_10", "OTHER"].map((v) => ({
    value: v,
    label: vehicleLabel(v, t),
  }));

  return (
    <>
      <div style={{ marginBottom: 8, fontWeight: 600, color: "#0b6e4f" }}>1. 接货信息</div>
      <Row gutter={16}>
        <Col xs={24} md={16}>
          <Form.Item name="pickupAddress" label={t("order.pickup_address", "发货地址")} rules={[{ required: true }]}>
            <Input placeholder="详细地址 / 地标" />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item name="pickupAt" label={t("order.pickup_at", "预约接货时间")} rules={[{ required: true }]}>
            <DatePicker showTime style={{ width: "100%" }} />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item name="pickupContact" label="发货联系人" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item name="pickupPhone" label="发货电话" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Col>
        <Col span={24}>
          <Form.Item name="pickupNote" label={t("order.pickup_note", "接货备注")}>
            <Input.TextArea rows={2} placeholder="门禁、楼层、特殊要求等（可选）" />
          </Form.Item>
        </Col>
      </Row>

      <div style={{ margin: "8px 0", fontWeight: 600, color: "#0b6e4f" }}>2. 送货信息</div>
      <Row gutter={16}>
        <Col span={24}>
          <Form.Item name="deliveryAddress" label={t("order.delivery_address", "收货地址")} rules={[{ required: true }]}>
            <Input placeholder="详细地址 / 地标" />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item name="deliveryContact" label="收货联系人" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item name="deliveryPhone" label="收货电话" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Col>
      </Row>

      <div style={{ margin: "8px 0", fontWeight: 600, color: "#0b6e4f" }}>3. 货物与报价</div>
      <Row gutter={16}>
        <Col xs={24} md={12}>
          <Form.Item name="cargoName" label={t("order.cargo_name", "货物名称")} rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item name="vehicleType" label={t("order.vehicle_type", "车型")} rules={[{ required: true }]}>
            <Select options={vehicleOptions} />
          </Form.Item>
        </Col>
        <Col xs={12} md={8}>
          <Form.Item name="cargoWeightKg" label={t("order.weight", "重量(kg)")} rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
        </Col>
        <Col xs={12} md={8}>
          <Form.Item name="cargoVolumeM3" label={t("order.volume", "体积(m³)")} rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item name="customerBidVnd" label={t("order.customer_bid", "您的出价(VND)")} rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: "100%" }} formatter={(v) => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ",")} />
          </Form.Item>
        </Col>
      </Row>
    </>
  );
}
