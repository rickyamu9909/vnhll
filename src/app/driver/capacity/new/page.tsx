"use client";

import { useRouter } from "next/navigation";
import { Button, Card, Col, DatePicker, Form, Input, InputNumber, Row, Select, Switch, Typography, message } from "antd";
import dayjs from "dayjs";
import { DriverShell } from "@/components/DriverShell";
import { BackButton } from "@/components/BackButton";
import { useI18n } from "@/components/I18nProvider";
import { apiFetch, vehicleLabel } from "@/lib/client";
import { knownProvince, provinceOptions, wardsOf } from "@/lib/regions";

function RegionPair({ prefix }: { prefix: "location" | "dest" }) {
  const { t } = useI18n();
  const form = Form.useFormInstance();
  const provinceName = prefix === "location" ? "locationProvince" : "destProvince";
  const wardName = prefix === "location" ? "locationWard" : "destWard";
  const province = Form.useWatch(provinceName, form) as string | undefined;
  const ward = Form.useWatch(wardName, form) as string | undefined;
  const wards = wardsOf(province);
  const wardOptions = wards.map((name) => ({ value: name, label: name }));
  if (ward && !wards.includes(ward)) wardOptions.unshift({ value: ward, label: ward });
  const provinces = provinceOptions();
  if (province && !knownProvince(province)) provinces.unshift({ value: province, label: province });
  return (
    <>
      <Col xs={12} md={5}>
        <Form.Item name={provinceName} label={t("form.province", "省/市")}>
          <Select
            showSearch
            allowClear
            optionFilterProp="label"
            placeholder={t("form.search_province", "搜索省/市")}
            options={provinces}
            onChange={() => form.setFieldValue(wardName, undefined)}
          />
        </Form.Item>
      </Col>
      <Col xs={12} md={5}>
        <Form.Item name={wardName} label={t("form.ward", "区/坊/社")}>
          <Select
            showSearch
            allowClear
            optionFilterProp="label"
            disabled={!province}
            placeholder={t("form.search_ward", "搜索区/坊/社")}
            options={wardOptions}
          />
        </Form.Item>
      </Col>
    </>
  );
}

export default function NewCapacityPage() {
  const router = useRouter();
  const { t } = useI18n();
  const vehicles = ["TON_1_5", "TON_3_5", "TON_7", "TON_10", "OTHER"].map((value) => ({ value, label: vehicleLabel(value, t) }));
  const cargo = [
    { value: "GENERAL", label: t("form.cargo.GENERAL", "普通货") },
    { value: "DANGEROUS", label: t("form.cargo.DANGEROUS", "危险品") },
    { value: "OTHER", label: t("form.cargo.OTHER", "其他") },
  ];
  return (
    <DriverShell>
      <BackButton href="/driver/capacity" />
      <Typography.Title level={3}>{t("cap.title", "发布运力")}</Typography.Title>
      <Card>
        <Form
          className="compact-form"
          layout="vertical"
          initialValues={{ vehicleType: "TON_3_5", airportOk: false, portOk: false, cargoTypes: "GENERAL" }}
          onFinish={async (values) => {
            const from = values.availableFrom as dayjs.Dayjs | undefined;
            const to = values.availableTo as dayjs.Dayjs | undefined;
            const res = await apiFetch("/api/driver/capacity", {
              method: "POST",
              body: JSON.stringify({
                ...values,
                availableFrom: from ? from.toISOString() : undefined,
                availableTo: to ? to.toISOString() : undefined,
              }),
            });
            if (!res.ok) return message.error(res.message || t("cap.fail", "发布失败"));
            message.success(t("cap.ok", "已发布"));
            router.push("/driver/capacity");
          }}
        >
          <div className="order-section">{t("cap.where", "当前空车位置")}</div>
          <Row gutter={8}>
            <RegionPair prefix="location" />
            <Col xs={24} md={6}>
              <Form.Item name="locationAddress" label={t("form.address", "详细地址")} rules={[{ required: true, message: t("form.required", "必填") }]}>
                <Input placeholder={t("form.street", "街道、门牌")} />
              </Form.Item>
            </Col>
            <Col xs={12} md={4}>
              <Form.Item name="availableFrom" label={t("cap.from", "可接开始")} rules={[{ required: true, message: t("form.required", "必填") }]}>
                <DatePicker showTime style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={12} md={4}>
              <Form.Item name="availableTo" label={t("cap.to", "可接结束")} rules={[{ required: true, message: t("form.required", "必填") }]}>
                <DatePicker showTime style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>
          <div className="order-section">{t("cap.dest_title", "目的地偏好（选填）")}</div>
          <Row gutter={8}>
            <RegionPair prefix="dest" />
            <Col xs={24} md={6}>
              <Form.Item name="destAddress" label={t("form.address", "详细地址")}>
                <Input placeholder={t("form.optional", "选填")} />
              </Form.Item>
            </Col>
            <Col xs={12} md={4}>
              <Form.Item name="vehicleType" label={t("form.vehicle", "车型")} rules={[{ required: true }]}>
                <Select options={vehicles} />
              </Form.Item>
            </Col>
            <Col xs={12} md={4}>
              <Form.Item name="loadTons" label={t("cap.load", "载重(吨)")} rules={[{ required: true }]}>
                <InputNumber min={0.1} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={8}>
            <Col xs={12} md={5}>
              <Form.Item name="cargoTypes" label={t("cap.cargo", "可承运货物")} rules={[{ required: true }]}>
                <Select options={cargo} />
              </Form.Item>
            </Col>
            <Col xs={12} md={5}>
              <Form.Item name="expectedPriceVnd" label={t("cap.price", "期望价 VND")} rules={[{ required: true }]}>
                <InputNumber min={1} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col xs={12} md={4}>
              <Form.Item name="airportOk" label={t("cap.airport", "可进机场")} valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col xs={12} md={4}>
              <Form.Item name="portOk" label={t("cap.port", "可进港口")} valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col xs={24} md={6}>
              <Form.Item name="note" label={t("form.note", "备注")}>
                <Input />
              </Form.Item>
            </Col>
          </Row>
          <Button type="primary" htmlType="submit">
            {t("cap.publish", "发布")}
          </Button>
        </Form>
      </Card>
    </DriverShell>
  );
}
