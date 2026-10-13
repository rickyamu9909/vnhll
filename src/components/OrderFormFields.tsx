"use client";

import { useEffect, useState } from "react";
import { Button, Col, DatePicker, Form, Input, InputNumber, Row, Select, Space, message } from "antd";
import { MinusCircleOutlined, PlusOutlined } from "@ant-design/icons";
import { useI18n } from "@/components/I18nProvider";
import { apiFetch, vehicleLabel } from "@/lib/client";
import { savedToForm, type SavedAddressInput } from "@/lib/order-form";
import { knownProvince, provinceOptions, wardsOf } from "@/lib/regions";

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

type SavedRow = SavedAddressInput & { id: string; label: string };

function RegionSelects({ side }: { side: "origin" | "dest" }) {
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
      <Col xs={24} md={6}>
        <Form.Item
          name={side === "origin" ? "originProvince" : "destProvince"}
          label="省/市"
          rules={[{ required: true, message: "请选择" }]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            placeholder="搜索省/市"
            options={provinces}
            onChange={() => form.setFieldValue(side === "origin" ? "originCity" : "destCity", undefined)}
          />
        </Form.Item>
      </Col>
      <Col xs={24} md={6}>
        <Form.Item
          name={side === "origin" ? "originCity" : "destCity"}
          label="区/坊/社"
          rules={[{ required: true, message: "请选择" }]}
        >
          <Select
            showSearch
            optionFilterProp="label"
            placeholder={province ? "搜索区/坊/社" : "先选省/市"}
            disabled={!province}
            options={wardOptions}
          />
        </Form.Item>
      </Col>
    </>
  );
}

function AddressBook({ side, userId }: { side: "origin" | "dest"; userId?: string }) {
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
        placeholder="常用地址"
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
        保存当前地址
      </Button>
      {picked ? (
        <Button size="small" danger onClick={remove}>
          删除
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

  return (
    <div className="compact-form">
      <div className="order-section">起运</div>
      {addressMode === "customer" && !addressUserId ? (
        <div style={{ fontSize: 12, color: "#64748b", marginBottom: 8 }}>选择客户后可使用常用地址</div>
      ) : (
        <AddressBook side="origin" userId={addressMode === "customer" ? addressUserId : undefined} />
      )}
      <Row gutter={8}>
        <RegionSelects side="origin" />
        <Col xs={24} md={7}>
          <Form.Item name="originAddress" label="详细地址" rules={[{ required: true, message: "必填" }]}>
            <Input placeholder="街道、门牌" />
          </Form.Item>
        </Col>
        <Col xs={24} md={5}>
          <Form.Item name="pickupAt" label="接货时间" rules={[{ required: true, message: "必填" }]}>
            <DatePicker showTime={{ format: "HH" }} format="YYYY-MM-DD HH" style={{ width: "100%" }} />
          </Form.Item>
        </Col>
        <Col xs={12} md={6}>
          <Form.Item name="originContact" label="联系人" rules={[{ required: true, message: "必填" }]}>
            <Input />
          </Form.Item>
        </Col>
        <Col xs={12} md={6}>
          <Form.Item name="originPhone" label="电话" rules={[{ required: true, message: "必填" }]}>
            <Input />
          </Form.Item>
        </Col>
      </Row>

      <div className="order-section">目的地</div>
      {addressMode === "customer" && !addressUserId ? null : (
        <AddressBook side="dest" userId={addressMode === "customer" ? addressUserId : undefined} />
      )}
      <Row gutter={8}>
        <RegionSelects side="dest" />
        <Col xs={24} md={7}>
          <Form.Item name="destAddress" label="详细地址" rules={[{ required: true, message: "必填" }]}>
            <Input placeholder="街道、门牌" />
          </Form.Item>
        </Col>
        <Col xs={24} md={5}>
          <Form.Item name="etaAt" label="预计送达" rules={[{ required: true, message: "必填" }]}>
            <DatePicker showTime={{ format: "HH" }} format="YYYY-MM-DD HH" style={{ width: "100%" }} />
          </Form.Item>
        </Col>
        <Col xs={12} md={6}>
          <Form.Item name="destContact" label="联系人" rules={[{ required: true, message: "必填" }]}>
            <Input />
          </Form.Item>
        </Col>
        <Col xs={12} md={6}>
          <Form.Item name="destPhone" label="电话" rules={[{ required: true, message: "必填" }]}>
            <Input />
          </Form.Item>
        </Col>
      </Row>

      <div className="order-section">货物</div>
      <Row gutter={8}>
        <Col xs={12} md={4}>
          <Form.Item name="cargoType" label="类型" rules={[{ required: true, message: "必填" }]}>
            <Select options={cargoTypes} />
          </Form.Item>
        </Col>
        <Col xs={12} md={4}>
          <Form.Item name="packaging" label="包装" rules={[{ required: true, message: "必填" }]}>
            <Select options={packages} />
          </Form.Item>
        </Col>
        <Col xs={12} md={4}>
          <Form.Item name="weightTons" label="重量(吨)" rules={[{ required: true, message: "必填" }]}>
            <InputNumber min={0.01} style={{ width: "100%" }} />
          </Form.Item>
        </Col>
        <Col xs={12} md={4}>
          <Form.Item name="vehicleType" label="车型">
            <Select allowClear options={vehicleOptions} placeholder="选填" />
          </Form.Item>
        </Col>
        <Col xs={12} md={4}>
          <Form.Item name="targetPriceVnd" label="目标价">
            <InputNumber min={0} style={{ width: "100%" }} placeholder="不填则询价" />
          </Form.Item>
        </Col>
        <Col xs={12} md={4}>
          <Form.Item name="abnormalNote" label="尺寸备注">
            <Input placeholder="选填" />
          </Form.Item>
        </Col>
      </Row>

      <Form.List
        name="cargoItems"
        rules={[{ validator: async (_, v) => (!v || !v.length ? Promise.reject(new Error("至少一行尺寸")) : Promise.resolve()) }]}
      >
        {(fields, { add, remove }, { errors }) => (
          <div style={{ marginBottom: 8 }}>
            {fields.map((field, index) => (
              <Row key={field.key} gutter={8} align="middle">
                <Col xs={5} md={3}>
                  <Form.Item name={[field.name, "lengthCm"]} rules={[{ required: true, message: "必填" }]} label={index === 0 ? "长cm" : " "}>
                    <InputNumber min={1} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col xs={5} md={3}>
                  <Form.Item name={[field.name, "widthCm"]} rules={[{ required: true, message: "必填" }]} label={index === 0 ? "宽cm" : " "}>
                    <InputNumber min={1} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col xs={5} md={3}>
                  <Form.Item name={[field.name, "heightCm"]} rules={[{ required: true, message: "必填" }]} label={index === 0 ? "高cm" : " "}>
                    <InputNumber min={1} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col xs={5} md={3}>
                  <Form.Item name={[field.name, "quantity"]} rules={[{ required: true, message: "必填" }]} label={index === 0 ? "数量" : " "}>
                    <InputNumber min={1} style={{ width: "100%" }} />
                  </Form.Item>
                </Col>
                <Col xs={4} md={2}>
                  <MinusCircleOutlined onClick={() => remove(field.name)} />
                </Col>
              </Row>
            ))}
            <Form.ErrorList errors={errors} />
            <Button type="dashed" size="small" onClick={() => add({ quantity: 1 })} icon={<PlusOutlined />}>
              添加一行尺寸
            </Button>
          </div>
        )}
      </Form.List>
      <Row gutter={8}>
        <Col span={24}>
          <Form.Item name="note" label="备注">
            <Input placeholder="选填" />
          </Form.Item>
        </Col>
      </Row>
    </div>
  );
}
