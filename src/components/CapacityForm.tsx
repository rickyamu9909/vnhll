"use client";

import { Button, Card, Col, DatePicker, Form, Input, InputNumber, Row, Select, Switch } from "antd";
import dayjs from "dayjs";
import { useI18n } from "@/components/I18nProvider";
import { vehicleLabel } from "@/lib/client";
import { FREIGHT_PLACES } from "@/lib/places";
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
          <Select showSearch allowClear optionFilterProp="label" disabled={!province} placeholder={t("form.search_ward", "搜索区/坊/社")} options={wardOptions} />
        </Form.Item>
      </Col>
    </>
  );
}

function PlacePair({ name }: { name: "locationPlaceId" | "destPlaceId" }) {
  const { t } = useI18n();
  const form = Form.useFormInstance();
  const prefix = name === "locationPlaceId" ? "location" : "dest";
  return (
    <Col xs={24} md={8}>
      <Form.Item name={name} label={t("form.place", "堆场/码头")}>
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder={t("form.place_ph", "可不填详细地址")}
          options={FREIGHT_PLACES.map((place) => ({
            value: place.id,
            label: `${place.kind === "YARD" ? t("form.yard", "堆场") : t("form.port", "码头")} · ${place.name}`,
          }))}
          onChange={(id) => {
            const place = FREIGHT_PLACES.find((item) => item.id === id);
            if (!place) return;
            form.setFieldsValue({
              [`${prefix}Province`]: place.province,
              [`${prefix}Ward`]: place.ward,
              [`${prefix}Address`]: place.address,
            });
          }}
        />
      </Form.Item>
    </Col>
  );
}

export type CapacityValues = {
  locationPlaceId?: string;
  locationProvince?: string;
  locationWard?: string;
  locationAddress?: string;
  destPlaceId?: string;
  destProvince?: string;
  destWard?: string;
  destAddress?: string;
  availableFrom?: string;
  availableTo?: string;
  vehicleType?: string;
  loadTons?: number;
  cargoTypes?: string;
  expectedPriceVnd?: string | number;
  airportOk?: boolean;
  portOk?: boolean;
  note?: string;
};

export function CapacityForm({
  initial,
  submitText,
  onSubmit,
}: {
  initial?: CapacityValues;
  submitText: string;
  onSubmit: (body: Record<string, unknown>) => Promise<void>;
}) {
  const { t } = useI18n();
  const vehicles = ["TON_1_5", "TON_3_5", "TON_7", "TON_10", "OTHER"].map((value) => ({ value, label: vehicleLabel(value, t) }));
  const cargo = [
    { value: "GENERAL", label: t("form.cargo.GENERAL", "普通货") },
    { value: "DANGEROUS", label: t("form.cargo.DANGEROUS", "危险品") },
    { value: "OTHER", label: t("form.cargo.OTHER", "其他") },
  ];
  return (
    <Card>
      <Form
        className="compact-form"
        layout="vertical"
        initialValues={{
          vehicleType: "TON_3_5",
          airportOk: false,
          portOk: false,
          cargoTypes: "GENERAL",
          ...initial,
          availableFrom: initial?.availableFrom ? dayjs(initial.availableFrom) : undefined,
          availableTo: initial?.availableTo ? dayjs(initial.availableTo) : undefined,
          expectedPriceVnd: initial?.expectedPriceVnd ? Number(initial.expectedPriceVnd) : undefined,
        }}
        onFinish={async (values) => {
          const from = values.availableFrom as dayjs.Dayjs | undefined;
          const to = values.availableTo as dayjs.Dayjs | undefined;
          await onSubmit({
            ...values,
            availableFrom: from ? from.toISOString() : undefined,
            availableTo: to ? to.toISOString() : undefined,
          });
        }}
      >
        <div className="order-section">{t("cap.where", "当前空车位置")}</div>
        <Row gutter={8}>
          <PlacePair name="locationPlaceId" />
          <RegionPair prefix="location" />
          <Col xs={24} md={6}>
            <Form.Item
              name="locationAddress"
              label={t("form.address", "详细地址")}
              dependencies={["locationPlaceId"]}
              rules={[
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (value || getFieldValue("locationPlaceId")) return Promise.resolve();
                    return Promise.reject(new Error(t("form.place_or_street", "请填写详细地址，或选择堆场/码头")));
                  },
                }),
              ]}
            >
              <Input placeholder={t("form.place_or_street", "选了堆场或码头后可以不填")} />
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
          <PlacePair name="destPlaceId" />
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
          {submitText}
        </Button>
      </Form>
    </Card>
  );
}
