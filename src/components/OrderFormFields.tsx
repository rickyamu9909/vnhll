"use client";

import { Button, Col, DatePicker, Form, Input, InputNumber, Row, Select, Space } from "antd";
import { MinusCircleOutlined, PlusOutlined } from "@ant-design/icons";
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
      <div style={{ marginBottom: 8, fontWeight: 600, color: "#0b6e4f" }}>1. 起运与联系人</div>
      <Row gutter={16}>
        <Col xs={24} md={8}>
          <Form.Item name="originProvince" label="起运省/市" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item name="originCity" label="起运区/县" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item name="pickupAt" label="预约接货时间" rules={[{ required: true }]}>
            <DatePicker showTime={{ format: "HH" }} style={{ width: "100%" }} />
          </Form.Item>
        </Col>
        <Col span={24}>
          <Form.Item name="originAddress" label="起运详细地址" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item name="originContact" label="起运联系人" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item name="originPhone" label="起运联系电话" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Col>
      </Row>

      <div style={{ margin: "8px 0", fontWeight: 600, color: "#0b6e4f" }}>2. 目的地与联系人</div>
      <Row gutter={16}>
        <Col xs={24} md={8}>
          <Form.Item name="destProvince" label="目的省/市" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item name="destCity" label="目的区/县" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item name="etaAt" label="预计送达时间" rules={[{ required: true }]}>
            <DatePicker showTime={{ format: "HH" }} style={{ width: "100%" }} />
          </Form.Item>
        </Col>
        <Col span={24}>
          <Form.Item name="destAddress" label="目的详细地址" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item name="destContact" label="目的联系人" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Col>
        <Col xs={24} md={12}>
          <Form.Item name="destPhone" label="目的联系电话" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
        </Col>
      </Row>

      <div style={{ margin: "8px 0", fontWeight: 600, color: "#0b6e4f" }}>3. 货物</div>
      <Row gutter={16}>
        <Col xs={24} md={8}>
          <Form.Item name="cargoType" label="货物类型" rules={[{ required: true }]}>
            <Select
              options={[
                { value: "GENERAL", label: "普通货" },
                { value: "DANGEROUS", label: "危险品" },
                { value: "OTHER", label: "其他" },
              ]}
            />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item name="packaging" label="包装" rules={[{ required: true }]}>
            <Select
              options={[
                { value: "CARTON", label: "纸箱" },
                { value: "WOOD", label: "木箱" },
                { value: "PALLET", label: "托盘" },
                { value: "NAKED", label: "裸装" },
                { value: "BAG", label: "袋装" },
                { value: "OTHER", label: "其他" },
              ]}
            />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item name="weightTons" label="总重量（吨）" rules={[{ required: true }]}>
            <InputNumber min={0.01} style={{ width: "100%" }} />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item name="vehicleType" label="车型（选填）">
            <Select allowClear options={vehicleOptions} />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item name="targetPriceVnd" label="目标价格 VND（不填则询价）">
            <InputNumber min={0} style={{ width: "100%" }} />
          </Form.Item>
        </Col>
        <Col xs={24} md={8}>
          <Form.Item name="abnormalNote" label="异常尺寸备注">
            <Input />
          </Form.Item>
        </Col>
      </Row>
      <Form.List name="cargoItems" rules={[{ validator: async (_, v) => (!v || !v.length ? Promise.reject(new Error("至少一行尺寸")) : Promise.resolve()) }]}>
        {(fields, { add, remove }) => (
          <div style={{ marginBottom: 16 }}>
            {fields.map((field) => (
              <Space key={field.key} align="baseline" wrap>
                <Form.Item name={[field.name, "lengthCm"]} rules={[{ required: true }]} label="长cm">
                  <InputNumber min={1} />
                </Form.Item>
                <Form.Item name={[field.name, "widthCm"]} rules={[{ required: true }]} label="宽cm">
                  <InputNumber min={1} />
                </Form.Item>
                <Form.Item name={[field.name, "heightCm"]} rules={[{ required: true }]} label="高cm">
                  <InputNumber min={1} />
                </Form.Item>
                <Form.Item name={[field.name, "quantity"]} rules={[{ required: true }]} label="数量">
                  <InputNumber min={1} />
                </Form.Item>
                <MinusCircleOutlined onClick={() => remove(field.name)} />
              </Space>
            ))}
            <Button type="dashed" onClick={() => add({ quantity: 1 })} icon={<PlusOutlined />}>
              添加尺寸
            </Button>
          </div>
        )}
      </Form.List>
      <Form.Item name="note" label="备注">
        <Input.TextArea rows={2} />
      </Form.Item>
    </>
  );
}
