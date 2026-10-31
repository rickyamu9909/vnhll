"use client";

import { useEffect, useState } from "react";
import { Button, Col, DatePicker, Form, Input, InputNumber, Row, Select, Space, message } from "antd";
import { MinusCircleOutlined, PlusOutlined } from "@ant-design/icons";
import { useI18n } from "@/components/I18nProvider";
import { apiFetch, vehicleLabel } from "@/lib/client";
import { savedToForm, volumeFromItems, type SavedAddressInput } from "@/lib/order-form";
import { knownProvince, provinceOptions, wardsOf } from "@/lib/regions";
import { AddressSuggest } from "@/components/AddressSuggest";
import { RouteDistanceBanner } from "@/components/RouteDistanceBanner";
import { FREIGHT_PLACES } from "@/lib/places";

const cargoTypes = [
  { value: "GENERAL", label: "普通货" },
  { value: "DANGEROUS", label: "危险品" },
  { value: "OTHER", label: "其他" },
];

const packages = [
  { value: "CARTON", label: "纸箱" },
  { value: "WOOD", label: "木箱" },
  { value: "PALLET", label: "托盘" },
  { value: "NAKED", label: "裸装" },
  { value: "BAG", label: "袋装" },
  { value: "OTHER", label: "其他" },
];

function VolumeField() {
  const { t } = useI18n();
  const form = Form.useFormInstance();
  const items = Form.useWatch("cargoItems", form) as Array<{ lengthCm?: number; widthCm?: number; heightCm?: number; quantity?: number }> | undefined;
  const computed = volumeFromItems(items || []);
  useEffect(() => {
    if (computed > 0) form.setFieldValue("cargoVolumeM3", Number(computed.toFixed(3)));
  }, [computed, form]);
  return (
    <Row gutter={8}>
      <Col xs={12} md={4}>
        <Form.Item name="cargoVolumeM3" label={t("form.volume", "总体积(m³)")}>
          <InputNumber min={0} step={0.001} style={{ width: "100%" }} disabled={computed > 0} />
        </Form.Item>
      </Col>
    </Row>
  );
}

type SavedRow = SavedAddressInput & { id: string; label: string };

function PlaceSelect({ side }: { side: "origin" | "dest" }) {
  const { t } = useI18n();
  const form = Form.useFormInstance();
  const options = FREIGHT_PLACES.map((place) => ({
    value: place.id,
    label: `${place.kind === "YARD" ? t("form.yard", "堆场") : t("form.port", "码头")} · ${place.name}`,
  }));
  return (
    <Col xs={24} md={8}>
      <Form.Item name={side === "origin" ? "originPlaceId" : "destPlaceId"} label={t("form.place", "堆场/码头")}>
        <Select
          allowClear
          showSearch
          optionFilterProp="label"
          placeholder={t("form.place_ph", "可不填详细地址")}
          options={options}
          onChange={(id) => {
            const place = FREIGHT_PLACES.find((item) => item.id === id);
            if (!place) return;
            form.setFieldsValue(
              side === "origin"
                ? {
                    originProvince: place.province || undefined,
                    originCity: place.ward || undefined,
                    originAddress: place.address,
                    originLat: place.lat,
                    originLng: place.lng,
                  }
                : {
                    destProvince: place.province || undefined,
                    destCity: place.ward || undefined,
                    destAddress: place.address,
                    destLat: place.lat,
                    destLng: place.lng,
                  }
            );
          }}
        />
      </Form.Item>
    </Col>
  );
}

function RegionSelects({ side }: { side: "origin" | "dest" }) {
  const { t } = useI18n();
  const form = Form.useFormInstance();
  const province = Form.useWatch(side === "origin" ? "originProvince" : "destProvince", form) as string | undefined;
  const ward = Form.useWatch(side === "origin" ? "originCity" : "destCity", form) as string | undefined;
  const wards = wardsOf(province);
  const wardOptions = wards.map((name) => ({ value: name, label: name }));
  if (ward && !wards.includes(ward)) wardOptions.unshift({ value: ward, label: ward });
  const provinces = provinceOptions();
  if (province && !knownProvince(province)) provinces.unshift({ value: province, label: province });

  return (
    <>
      <Col xs={12} md={4}>
        <Form.Item
          name={side === "origin" ? "originProvince" : "destProvince"}
          label={t("form.province", "省/市")}
        >
          <Select
            showSearch
            allowClear
            optionFilterProp="label"
            placeholder={t("form.search_province", "搜索省/市")}
            options={provinces}
            onChange={() => form.setFieldValue(side === "origin" ? "originCity" : "destCity", undefined)}
          />
        </Form.Item>
      </Col>
      <Col xs={12} md={4}>
        <Form.Item
          name={side === "origin" ? "originCity" : "destCity"}
          label={t("form.ward", "区/坊/社")}
        >
          <Select
            showSearch
            allowClear
            optionFilterProp="label"
            placeholder={province ? t("form.search_ward", "搜索区/坊/社") : t("form.search_province", "先选省/市")}
            disabled={!province}
            options={wardOptions}
          />
        </Form.Item>
      </Col>
    </>
  );
}

function AddressBook({ side, userId }: { side: "origin" | "dest"; userId?: string }) {
  const { t } = useI18n();
  const form = Form.useFormInstance();
  const [rows, setRows] = useState<SavedRow[]>([]);
  const [picked, setPicked] = useState<string>();
  const listUrl = userId ? `/api/admin/addresses?userId=${userId}` : "/api/addresses";

  const load = async () => {
    const res = await apiFetch<SavedRow[]>(listUrl);
    if (res.ok) setRows(res.data || []);
  };

  useEffect(() => {
    setPicked(undefined);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listUrl]);

  const apply = (id: string) => {
    setPicked(id);
    const row = rows.find((item) => item.id === id);
    if (!row) return;
    form.setFieldsValue(savedToForm(side, row));
  };

  const save = async () => {
    const values = form.getFieldsValue();
    const prefix = side;
    const body = {
      userId,
      province: values[`${prefix}Province`],
      ward: values[`${prefix}City`],
      address: values[`${prefix}Address`],
      contact: values[`${prefix}Contact`],
      phone: values[`${prefix}Phone`],
    };
    const res = await apiFetch(userId ? "/api/admin/addresses" : "/api/addresses", {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (!res.ok) return message.error(res.message || "保存失败");
    message.success("已保存为常用地址");
    load();
  };

  const remove = async () => {
    if (!picked) return;
    const res = await apiFetch(userId ? `/api/admin/addresses/${picked}` : `/api/addresses/${picked}`, { method: "DELETE" });
    if (!res.ok) return message.error(res.message || "删除失败");
    setPicked(undefined);
    load();
  };

  return (
    <Space wrap size={8} style={{ marginBottom: 8 }}>
      <Select
        allowClear
        showSearch
        optionFilterProp="label"
        placeholder={t("form.saved", "常用地址")}
        style={{ minWidth: 220 }}
        value={picked}
        options={rows.map((row) => ({ value: row.id, label: row.label }))}
        onChange={(value) => {
          if (!value) {
            setPicked(undefined);
            return;
          }
          apply(value);
        }}
      />
      <Button size="small" onClick={save}>
        {t("form.save_current", "保存当前地址")}
      </Button>
      {picked ? (
        <Button size="small" danger onClick={remove}>
          {t("form.delete", "删除")}
        </Button>
      ) : null}
    </Space>
  );
}

export function OrderFormFields({ addressUserId, addressMode = "self" }: { addressUserId?: string; addressMode?: "self" | "customer" }) {
  const { t } = useI18n();
  const vehicleOptions = ["TON_1_5", "TON_3_5", "TON_7", "TON_10", "OTHER"].map((v) => ({
    value: v,
    label: vehicleLabel(v, t),
  }));
  const cargoOptions = cargoTypes.map((item) => ({ value: item.value, label: t(`form.cargo.${item.value}`, item.label) }));
  const packageOptions = packages.map((item) => ({ value: item.value, label: t(`form.pack.${item.value}`, item.label) }));

  return (
    <div className="compact-form">
      <RouteDistanceBanner />
      <div className="order-section">{t("form.section_origin", "起运")}</div>
      {addressMode === "customer" && !addressUserId ? (
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>{t("form.need_customer", "选择客户后可使用常用地址")}</div>
      ) : (
        <AddressBook side="origin" userId={addressMode === "customer" ? addressUserId : undefined} />
      )}
      <Row gutter={8}>
        <PlaceSelect side="origin" />
        <RegionSelects side="origin" />
        <Col xs={24} md={5}>
          <AddressSuggest side="origin" placeholder={t("form.place_or_street", "选了堆场或码头后可以不填；也可输入街道联想")} />
        </Col>
        <Form.Item name="originLat" hidden><Input /></Form.Item>
        <Form.Item name="originLng" hidden><Input /></Form.Item>
        <Col xs={12} md={3}>
          <Form.Item name="pickupAt" label={t("form.pickup_at", "接货时间")}>
            <DatePicker showTime={{ format: "HH" }} format="YYYY-MM-DD HH" style={{ width: "100%" }} />
          </Form.Item>
        </Col>
        <Col xs={12} md={4}>
          <Form.Item name="originContact" label={t("form.contact", "联系人")} rules={[{ required: true, message: t("form.required", "必填") }]}>
            <Input />
          </Form.Item>
        </Col>
        <Col xs={12} md={4}>
          <Form.Item name="originPhone" label={t("form.phone", "电话")} rules={[{ required: true, message: t("form.required", "必填") }]}>
            <Input />
          </Form.Item>
        </Col>
      </Row>

      <div className="order-section">{t("form.section_dest", "目的地")}</div>
      {addressMode === "customer" && !addressUserId ? null : (
        <AddressBook side="dest" userId={addressMode === "customer" ? addressUserId : undefined} />
      )}
      <Row gutter={8}>
        <PlaceSelect side="dest" />
        <RegionSelects side="dest" />
        <Col xs={24} md={5}>
          <AddressSuggest side="dest" placeholder={t("form.place_or_street", "选了堆场或码头后可以不填；也可输入街道联想")} />
        </Col>
        <Form.Item name="destLat" hidden><Input /></Form.Item>
        <Form.Item name="destLng" hidden><Input /></Form.Item>
        <Col xs={12} md={3}>
          <Form.Item name="etaAt" label={t("form.eta", "预计送达")}>
            <DatePicker showTime={{ format: "HH" }} format="YYYY-MM-DD HH" style={{ width: "100%" }} />
          </Form.Item>
        </Col>
        <Col xs={12} md={4}>
          <Form.Item name="destContact" label={t("form.contact", "联系人")} rules={[{ required: true, message: t("form.required", "必填") }]}>
            <Input />
          </Form.Item>
        </Col>
        <Col xs={12} md={4}>
          <Form.Item name="destPhone" label={t("form.phone", "电话")} rules={[{ required: true, message: t("form.required", "必填") }]}>
            <Input />
          </Form.Item>
        </Col>
      </Row>

      <div className="order-section">{t("form.section_cargo", "货物")}</div>
      <Row gutter={8}>
        <Col xs={12} md={4}>
          <Form.Item name="cargoType" label={t("form.type", "类型")}>
            <Select options={cargoOptions} />
          </Form.Item>
        </Col>
        <Col xs={12} md={4}>
          <Form.Item name="packaging" label={t("form.pack", "包装")}>
            <Select options={packageOptions} />
          </Form.Item>
        </Col>
        <Col xs={12} md={4}>
          <Form.Item name="weightTons" label={t("form.weight", "重量(吨)")}>
            <InputNumber min={0.01} style={{ width: "100%" }} />
          </Form.Item>
        </Col>
        <Col xs={12} md={4}>
          <Form.Item name="vehicleType" label={t("form.vehicle", "车型")}>
            <Select allowClear options={vehicleOptions} placeholder={t("form.optional", "选填")} />
          </Form.Item>
        </Col>
        <Col xs={12} md={4}>
          <Form.Item
            name="targetPriceVnd"
            label={t("form.price", "目标价")}
            extra={t("form.price_hint", "填价=出价接单；不填=询价报价。")}
          >
            <InputNumber min={0} style={{ width: "100%" }} placeholder={t("form.inquiry", "不填则询价")} />
          </Form.Item>
        </Col>
        <Col xs={12} md={4}>
          <Form.Item name="abnormalNote" label={t("form.size_note", "尺寸备注")}>
            <Input placeholder={t("form.optional", "选填")} />
          </Form.Item>
        </Col>
      </Row>

      <Form.List name="cargoItems">
        {(fields, { add, remove }) => (
          <div style={{ marginBottom: 8 }}>
            {fields.map((field, index) => (
              <Row key={field.key} gutter={8} align="middle">
                <Col xs={5} md={3}>
                  <Form.Item name={[field.name, "lengthCm"]} label={index === 0 ? t("form.length", "长cm") : " "}>
                    <InputNumber min={1} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col xs={5} md={3}>
                  <Form.Item name={[field.name, "widthCm"]} label={index === 0 ? t("form.width", "宽cm") : " "}>
                    <InputNumber min={1} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col xs={5} md={3}>
                  <Form.Item name={[field.name, "heightCm"]} label={index === 0 ? t("form.height", "高cm") : " "}>
                    <InputNumber min={1} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col xs={5} md={3}>
                  <Form.Item name={[field.name, "quantity"]} label={index === 0 ? t("form.qty", "数量") : " "}>
                    <InputNumber min={1} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col xs={4} md={2}>
                  <MinusCircleOutlined onClick={() => remove(field.name)} />
                </Col>
              </Row>
            ))}
            <Button type="dashed" size="small" onClick={() => add({ quantity: 1 })} icon={<PlusOutlined />}>
              {t("form.add_size", "添加一行尺寸")}
            </Button>
          </div>
        )}
      </Form.List>
      <VolumeField />
      <Row gutter={8}>
        <Col span={24}>
          <Form.Item name="note" label={t("form.note", "备注")}>
            <Input placeholder={t("form.optional", "选填")} />
          </Form.Item>
        </Col>
      </Row>
    </div>
  );
}
