"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Card, DatePicker, Form, Input, Select, Space, Table, Tabs, Tag, Typography, message } from "antd";
import dayjs from "dayjs";
import { ActionButton } from "@/components/ActionButton";
import { AdminShell } from "@/components/AdminShell";
import { useI18n } from "@/components/I18nProvider";
import { apiFetch, pathLabel, statusLabel } from "@/lib/client";
import { CUSTOMER_NODE_TABS, orderInTab } from "@/lib/order-view";
import { formatVnd } from "@/lib/money";

type OrderRow = {
  id: string;
  orderNo: string;
  status: string;
  matchPath?: string | null;
  cargoName: string;
  cargoType?: string | null;
  packaging?: string | null;
  weightTons?: number | null;
  vehicleType?: string | null;
  customerBidVnd?: string | null;
  targetPriceVnd?: string | null;
  dealPriceVnd?: string | null;
  pickupAt: string;
  etaAt?: string | null;
  originProvince?: string | null;
  originCity?: string | null;
  originAddress?: string | null;
  pickupAddress?: string | null;
  pickupContact?: string | null;
  pickupPhone?: string | null;
  destProvince?: string | null;
  destCity?: string | null;
  destAddress?: string | null;
  deliveryAddress?: string | null;
  deliveryContact?: string | null;
  deliveryPhone?: string | null;
  customer?: { displayName?: string; username: string; company?: { companyName?: string } | null };
};

const STATUSES = [
  "OPEN",
  "LOCKED",
  "PENDING_CONFIRM",
  "PENDING_AUDIT",
  "PENDING_EXECUTION",
  "IN_TRANSIT",
  "DELIVERED",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "REJECTED",
  "PENDING_REVIEW",
  "BIDDING",
  "MATCHED",
];

export default function AdminOrdersPage() {
  const { t } = useI18n();
  const [form] = Form.useForm();
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("all");

  const load = async (values?: Record<string, unknown>) => {
    const query = new URLSearchParams();
    const data = values || form.getFieldsValue();
    const put = (key: string, value: unknown) => {
      if (value === undefined || value === null || value === "") return;
      query.set(key, String(value));
    };
    put("q", data.q);
    put("customer", data.customer);
    put("status", data.status);
    put("origin", data.origin);
    put("dest", data.dest);
    put("phone", data.phone);
    put("cargo", data.cargo);
    put("path", data.path);
    put("vehicle", data.vehicle);
    if (data.dateFrom) put("dateFrom", (data.dateFrom as dayjs.Dayjs).startOf("day").toISOString());
    if (data.dateTo) put("dateTo", (data.dateTo as dayjs.Dayjs).endOf("day").toISOString());
    setLoading(true);
    const res = await apiFetch<OrderRow[]>(`/api/admin/orders?${query.toString()}`);
    setLoading(false);
    if (!res.ok) message.error(res.message || "加载失败");
    else setRows(res.data || []);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shown = useMemo(() => rows.filter((row) => orderInTab(row, tab)), [rows, tab]);

  return (
    <AdminShell>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, gap: 12, flexWrap: "wrap" }}>
        <Typography.Title level={4} style={{ margin: 0 }}>
          {t("nav.admin_orders", "订单管理")}
        </Typography.Title>
        <ActionButton href="/admin/orders/new" tone="primary">
          代客建单
        </ActionButton>
      </div>
      <Card size="small" style={{ marginBottom: 12 }}>
        <Form className="admin-filters" form={form} layout="inline" size="small" onFinish={load} style={{ rowGap: 8 }}>
          <Form.Item name="q">
            <Input allowClear placeholder={t("order.order_no", "订单号")} style={{ width: 140 }} />
          </Form.Item>
          <Form.Item name="customer">
            <Input allowClear placeholder={t("order.customer", "客户")} style={{ width: 120 }} />
          </Form.Item>
          <Form.Item name="status">
            <Select
              allowClear
              placeholder={t("order.status", "状态")}
              style={{ width: 130 }}
              options={STATUSES.map((status) => ({ value: status, label: statusLabel(status, t) }))}
            />
          </Form.Item>
          <Form.Item name="origin">
            <Input allowClear placeholder={t("order.origin", "起运地")} style={{ width: 120 }} />
          </Form.Item>
          <Form.Item name="dest">
            <Input allowClear placeholder={t("order.dest", "目的地")} style={{ width: 120 }} />
          </Form.Item>
          <Form.Item name="phone">
            <Input allowClear placeholder={t("order.phone_q", "电话")} style={{ width: 120 }} />
          </Form.Item>
          <Form.Item name="cargo">
            <Input allowClear placeholder={t("order.cargo_q", "货物")} style={{ width: 100 }} />
          </Form.Item>
          <Form.Item name="path">
            <Input allowClear placeholder="路径" style={{ width: 110 }} />
          </Form.Item>
          <Form.Item name="vehicle">
            <Input allowClear placeholder="车型" style={{ width: 100 }} />
          </Form.Item>
          <Form.Item name="dateFrom">
            <DatePicker placeholder={t("order.date", "接货从")} />
          </Form.Item>
          <Form.Item name="dateTo">
            <DatePicker placeholder={t("order.date", "到")} />
          </Form.Item>
          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit" loading={loading}>
                {t("order.search", "查询")}
              </Button>
              <Button
                onClick={() => {
                  form.resetFields();
                  load({});
                }}
              >
                {t("order.reset", "重置")}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
      <Card size="small">
        <Tabs activeKey={tab} onChange={setTab} items={CUSTOMER_NODE_TABS.map((item) => ({ key: item.key, label: item.label }))} />
        <Table
          size="small"
          rowKey="id"
          loading={loading}
          dataSource={shown}
          scroll={{ x: 2200 }}
          pagination={{ pageSize: 15, showSizeChanger: true, pageSizeOptions: ["15", "25", "50", "100", "500"], showTotal: (total) => `共 ${total} 条` }}
          columns={[
            { title: t("order.order_no", "订单号"), dataIndex: "orderNo", width: 170, fixed: "left" },
            { title: t("order.customer", "客户"), width: 120, render: (_, r) => r.customer?.company?.companyName || r.customer?.displayName || r.customer?.username || "-" },
            { title: t("order.status", "状态"), dataIndex: "status", width: 110, render: (v) => <Tag>{statusLabel(v, t)}</Tag> },
            { title: t("order.path", "路径"), dataIndex: "matchPath", width: 100, render: (v) => pathLabel(v) },
            { title: t("order.origin_province", "起运省/市"), dataIndex: "originProvince", width: 120, render: (v) => v || "-" },
            { title: t("order.origin_ward", "起运区/坊/社"), dataIndex: "originCity", width: 130, render: (v) => v || "-" },
            { title: t("order.origin_address", "起运地址"), width: 160, render: (_, r) => r.originAddress || r.pickupAddress || "-" },
            { title: t("order.origin_contact", "起运联系人"), dataIndex: "pickupContact", width: 100 },
            { title: t("order.origin_phone", "起运电话"), dataIndex: "pickupPhone", width: 120 },
            { title: t("order.dest_province", "目的省/市"), dataIndex: "destProvince", width: 120, render: (v) => v || "-" },
            { title: t("order.dest_ward", "目的区/坊/社"), dataIndex: "destCity", width: 130, render: (v) => v || "-" },
            { title: t("order.dest_address", "目的地址"), width: 160, render: (_, r) => r.destAddress || r.deliveryAddress || "-" },
            { title: t("order.dest_contact", "目的联系人"), dataIndex: "deliveryContact", width: 100 },
            { title: t("order.dest_phone", "目的电话"), dataIndex: "deliveryPhone", width: 120 },
            { title: t("order.cargo_q", "货物"), dataIndex: "cargoName", width: 140 },
            { title: t("form.weight", "重量(吨)"), dataIndex: "weightTons", width: 80, render: (v) => v ?? "-" },
            { title: t("order.target", "目标价"), width: 110, render: (_, r) => formatVnd(r.targetPriceVnd || r.customerBidVnd) },
            { title: t("order.deal", "成交价"), dataIndex: "dealPriceVnd", width: 110, render: (v) => (v ? formatVnd(v) : "-") },
            { title: t("form.pickup_at", "接货时间"), dataIndex: "pickupAt", width: 130, render: (v) => (v ? dayjs(v).format("MM-DD HH:mm") : "-") },
            { title: t("form.eta", "预计送达"), dataIndex: "etaAt", width: 130, render: (v) => (v ? dayjs(v).format("MM-DD HH:mm") : "-") },
            {
              title: t("order.op", "操作"),
              width: 300,
              fixed: "right",
              render: (_, r) => (
                <Space size={6} wrap>
                  <ActionButton href={`/admin/orders/${r.id}`} tone="primary">
                    {t("order.detail", "详情")}
                  </ActionButton>
                  <ActionButton href={`/admin/orders/${r.id}/track`} tone="cyan">
                    {t("track.view", "轨迹")}
                  </ActionButton>
                  <ActionButton href={`/admin/orders/new?from=${r.id}`} tone="orange">
                    {t("order.copy", "复制")}
                  </ActionButton>
                  <ActionButton href={`/admin/orders/${r.id}/logs`} tone="default">
                    {t("order.logs", "日志")}
                  </ActionButton>
                </Space>
              ),
            },
          ]}
        />
      </Card>
    </AdminShell>
  );
}
