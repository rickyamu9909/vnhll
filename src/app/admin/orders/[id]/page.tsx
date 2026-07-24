"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  Button,
  Card,
  Descriptions,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
  Modal,
} from "antd";
import dayjs from "dayjs";
import { CopyOutlined } from "@ant-design/icons";
import { AdminShell } from "@/components/AdminShell";
import { useI18n } from "@/components/I18nProvider";
import { apiFetch, statusLabel, vehicleLabel } from "@/lib/client";
import { formatVnd } from "@/lib/money";

type Driver = { id: string; name: string; phone: string; status: string; vehicleType: string };
type Bid = { id: string; driverId: string; priceVnd: string; note?: string; driver: Driver };
type OrderDetail = {
  id: string;
  orderNo: string;
  status: string;
  pickupAddress: string;
  pickupContact: string;
  pickupPhone: string;
  pickupNote?: string;
  pickupAt: string;
  deliveryAddress: string;
  deliveryContact: string;
  deliveryPhone: string;
  cargoName: string;
  cargoWeightKg: number;
  cargoVolumeM3: number;
  vehicleType: string;
  customerBidVnd: string;
  dealPriceVnd?: string | null;
  platformFeeVnd?: string | null;
  driverIncomeVnd?: string | null;
  rejectReason?: string;
  notifyText?: string;
  matchedDriver?: Driver | null;
  bids: Bid[];
  customer?: { username: string; displayName?: string; company?: { companyName: string } };
};

export default function AdminOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [bidForm] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const [oRes, dRes] = await Promise.all([
      apiFetch<OrderDetail>(`/api/admin/orders/${id}`),
      apiFetch<Driver[]>("/api/admin/drivers?status=ACTIVE"),
    ]);
    if (!oRes.ok) {
      message.error(oRes.message || "加载失败");
      return;
    }
    setOrder(oRes.data || null);
    setDrivers((dRes.data || []).filter((d) => d.status === "ACTIVE"));
  };

  useEffect(() => {
    load();
  }, [id]);

  const patch = async (action: string, extra: Record<string, unknown> = {}) => {
    setLoading(true);
    const res = await apiFetch(`/api/admin/orders/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ action, ...extra }),
    });
    setLoading(false);
    if (!res.ok) {
      message.error(res.message || "操作失败");
      return;
    }
    message.success(t("msg.save_success", "保存成功"));
    load();
  };

  const copyNotify = async () => {
    if (!order?.notifyText) {
      message.warning("暂无可复制内容");
      return;
    }
    try {
      await navigator.clipboard.writeText(order.notifyText);
      message.success(t("msg.copy_success", "通知消息已复制"));
    } catch {
      Modal.info({
        title: "请手动复制",
        content: <pre style={{ whiteSpace: "pre-wrap" }}>{order.notifyText}</pre>,
        width: 560,
      });
    }
  };

  if (!order) {
    return (
      <AdminShell>
        <Card loading />
      </AdminShell>
    );
  }

  return (
    <AdminShell>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          {order.orderNo}
        </Typography.Title>
        <Space wrap>
          <Button type="primary" icon={<CopyOutlined />} onClick={copyNotify}>
            {t("action.copy_notify", "复制通知消息")}
          </Button>
          {order.status === "PENDING_REVIEW" && (
            <>
              <Button type="primary" loading={loading} onClick={() => patch("approve")}>
                {t("action.approve", "审核通过")}
              </Button>
              <Button
                danger
                loading={loading}
                onClick={() => {
                  Modal.confirm({
                    title: "拒绝订单",
                    content: (
                      <Input.TextArea
                        id="reject-reason"
                        rows={3}
                        placeholder="拒绝原因"
                        defaultValue="信息不完整"
                      />
                    ),
                    onOk: () => {
                      const el = document.getElementById("reject-reason") as HTMLTextAreaElement | null;
                      return patch("reject", { reason: el?.value || "审核拒绝" });
                    },
                  });
                }}
              >
                {t("action.reject", "拒绝")}
              </Button>
            </>
          )}
          {order.status === "MATCHED" && (
            <Button loading={loading} onClick={() => patch("set_status", { status: "IN_TRANSIT" })}>
              标记运输中
            </Button>
          )}
          {order.status === "IN_TRANSIT" && (
            <Button loading={loading} onClick={() => patch("set_status", { status: "DELIVERED" })}>
              标记已送达
            </Button>
          )}
        </Space>
      </div>

      <Card title="订单信息" style={{ marginBottom: 16 }}>
        <Descriptions column={2} bordered size="small">
          <Descriptions.Item label="状态">
            <Tag>{statusLabel(order.status, t)}</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="客户">
            {order.customer?.company?.companyName || order.customer?.displayName || order.customer?.username}
          </Descriptions.Item>
          <Descriptions.Item label="企业出价">{formatVnd(order.customerBidVnd)} VND</Descriptions.Item>
          <Descriptions.Item label="成交价">{order.dealPriceVnd ? `${formatVnd(order.dealPriceVnd)} VND` : "-"}</Descriptions.Item>
          <Descriptions.Item label="平台佣金(15%)">
            {order.platformFeeVnd ? `${formatVnd(order.platformFeeVnd)} VND` : "-"}
          </Descriptions.Item>
          <Descriptions.Item label="司机实得">
            {order.driverIncomeVnd ? `${formatVnd(order.driverIncomeVnd)} VND` : "-"}
          </Descriptions.Item>
          <Descriptions.Item label="预约时间">{dayjs(order.pickupAt).format("YYYY-MM-DD HH:mm")}</Descriptions.Item>
          <Descriptions.Item label="车型">{vehicleLabel(order.vehicleType, t)}</Descriptions.Item>
          <Descriptions.Item label="发货" span={2}>
            {order.pickupAddress} / {order.pickupContact} / {order.pickupPhone}
          </Descriptions.Item>
          <Descriptions.Item label="接货备注" span={2}>{order.pickupNote || "-"}</Descriptions.Item>
          <Descriptions.Item label="收货" span={2}>
            {order.deliveryAddress} / {order.deliveryContact} / {order.deliveryPhone}
          </Descriptions.Item>
          <Descriptions.Item label="货物" span={2}>
            {order.cargoName} · {order.cargoWeightKg}kg · {order.cargoVolumeM3}m³
          </Descriptions.Item>
          <Descriptions.Item label="成交司机" span={2}>
            {order.matchedDriver ? `${order.matchedDriver.name} / ${order.matchedDriver.phone}` : "-"}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {(order.status === "BIDDING" || order.status === "MATCHED") && (
        <Card title="录入司机报价（线下代录）" style={{ marginBottom: 16 }}>
          <Form
            form={bidForm}
            layout="inline"
            onFinish={async (values) => {
              await patch("add_bid", values);
              bidForm.resetFields();
            }}
          >
            <Form.Item name="driverId" rules={[{ required: true, message: "选择司机" }]}>
              <Select
                style={{ width: 260 }}
                placeholder="选择司机"
                options={drivers.map((d) => ({
                  value: d.id,
                  label: `${d.name} (${d.phone}) · ${vehicleLabel(d.vehicleType, t)}`,
                }))}
              />
            </Form.Item>
            <Form.Item name="priceVnd" rules={[{ required: true, message: "输入报价" }]}>
              <InputNumber min={0} placeholder="报价 VND" style={{ width: 180 }} />
            </Form.Item>
            <Form.Item name="note">
              <Input placeholder="备注" style={{ width: 160 }} />
            </Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>
              保存报价
            </Button>
          </Form>

          <Table
            style={{ marginTop: 16 }}
            rowKey="id"
            dataSource={order.bids}
            pagination={false}
            columns={[
              { title: "司机", render: (_, r) => `${r.driver.name} / ${r.driver.phone}` },
              { title: "报价(VND)", dataIndex: "priceVnd", render: (v) => formatVnd(v) },
              {
                title: "佣金15%",
                render: (_, r) => formatVnd(Math.round(Number(r.priceVnd) * 0.15)),
              },
              {
                title: "司机实得",
                render: (_, r) => formatVnd(Number(r.priceVnd) - Math.round(Number(r.priceVnd) * 0.15)),
              },
              { title: "备注", dataIndex: "note", render: (v) => v || "-" },
              {
                title: "操作",
                render: (_, r) =>
                  order.status === "BIDDING" ? (
                    <Button size="small" type="link" onClick={() => patch("match", { driverId: r.driverId })}>
                      设为成交
                    </Button>
                  ) : null,
              },
            ]}
          />
        </Card>
      )}

      <Card title="司机通知预览（复制后发 Zalo/WhatsApp）">
        <pre
          style={{
            whiteSpace: "pre-wrap",
            background: "#f8fafc",
            padding: 16,
            borderRadius: 8,
            border: "1px solid #e2e8f0",
            margin: 0,
          }}
        >
          {order.notifyText}
        </pre>
      </Card>
    </AdminShell>
  );
}
