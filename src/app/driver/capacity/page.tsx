"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button, Card, Modal, Space, Table, Typography, message } from "antd";
import { DriverShell } from "@/components/DriverShell";
import { MatchSuggestions } from "@/components/MatchSuggestions";
import { useI18n } from "@/components/I18nProvider";
import { QueryFields } from "@/components/QueryFields";
import { apiFetch, vehicleLabel } from "@/lib/client";
import { includesText } from "@/lib/order-view";
import { formatVnd } from "@/lib/money";

type Row = {
  id: string;
  location: string;
  destPreference?: string | null;
  vehicleType?: string | null;
  expectedPriceVnd: string;
  status: string;
  orderId?: string | null;
  negotiations: Array<{ id: string; status: string; priceVnd: string; orderId?: string | null }>;
};

const CAP_STATUS: Record<string, string> = { OPEN: "可匹配", MATCHED: "已匹配", CLOSED: "已取消" };

export default function CapacityListPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<Row[]>([]);
  const [query, setQuery] = useState<Record<string, string>>({});
  const load = async () => {
    const res = await apiFetch<Row[]>("/api/driver/capacity");
    if (!res.ok) message.error(res.message || "加载失败");
    else setRows(res.data || []);
  };
  useEffect(() => {
    load();
  }, []);
  const shown = useMemo(
    () =>
      rows.filter(
        (row) =>
          includesText(row.location, query.location) &&
          includesText(row.destPreference, query.dest) &&
          includesText(`${row.vehicleType || ""} ${row.vehicleType ? vehicleLabel(row.vehicleType, t) : ""}`, query.vehicle) &&
          includesText(row.expectedPriceVnd, query.price) &&
          includesText(`${row.status} ${CAP_STATUS[row.status] || ""}`, query.status)
      ),
    [rows, query, t]
  );
  return (
    <DriverShell>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <Typography.Title level={3}>{t("cap.mine", "我的运力")}</Typography.Title>
        <Link href="/driver/capacity/new">
          <Button type="primary">{t("cap.title", "发布运力")}</Button>
        </Link>
      </div>
      <MatchSuggestions />
      <Card>
        <QueryFields
          fields={[
            { name: "location", placeholder: "空车位置" },
            { name: "dest", placeholder: "目的偏好" },
            { name: "vehicle", placeholder: "车型" },
            { name: "price", placeholder: "期望价" },
            { name: "status", placeholder: "状态" },
          ]}
          onSearch={setQuery}
        />
        <Table
          rowKey="id"
          dataSource={shown}
          columns={[
            { title: "空车位置", dataIndex: "location" },
            { title: "目的偏好", dataIndex: "destPreference", render: (value) => value || "-" },
            { title: "车型", dataIndex: "vehicleType", render: (value) => (value ? vehicleLabel(value, t) : "-") },
            { title: "期望价", dataIndex: "expectedPriceVnd", render: (v) => formatVnd(v) },
            { title: "状态", dataIndex: "status", render: (value) => CAP_STATUS[value] || value },
            {
              title: "操作",
              render: (_, row) => {
                const orderId = row.orderId || row.negotiations.find((item) => item.orderId)?.orderId;
                return (
                  <Space size={4} wrap>
                    <Link href={`/driver/capacity/${row.id}`}>详情</Link>
                    {row.status === "OPEN" ? <Link href={`/driver/capacity/${row.id}/edit`}>编辑</Link> : null}
                    {row.status === "OPEN" ? (
                      <Button
                        size="small"
                        type="link"
                        danger
                        onClick={() => {
                          Modal.confirm({
                            title: "确认取消这条运力？",
                            content: "取消后客户不能再对它发起匹配。",
                            okText: "确认取消",
                            okButtonProps: { danger: true },
                            onOk: async () => {
                              const res = await apiFetch(`/api/driver/capacity/${row.id}`, {
                                method: "POST",
                                body: JSON.stringify({ action: "cancel" }),
                              });
                              if (!res.ok) message.error(res.message || "取消失败");
                              else load();
                            },
                          });
                        }}
                      >
                        取消
                      </Button>
                    ) : null}
                    {orderId ? <Link href={`/driver/orders/${orderId}`}>查看订单</Link> : null}
                  </Space>
                );
              },
            },
            {
              title: "协商",
              render: (_, r) =>
                r.negotiations
                  .filter((n) => n.status === "PENDING")
                  .map((n) => (
                    <div key={n.id}>
                      {formatVnd(n.priceVnd)}{" "}
                      <Button
                        size="small"
                        type="link"
                        onClick={async () => {
                          const res = await apiFetch(`/api/driver/negotiations/${n.id}`, {
                            method: "POST",
                            body: JSON.stringify({ accept: true }),
                          });
                          if (!res.ok) message.error(res.message || "失败");
                          else load();
                        }}
                      >
                        接受
                      </Button>
                      <Button
                        size="small"
                        type="link"
                        danger
                        onClick={async () => {
                          const res = await apiFetch(`/api/driver/negotiations/${n.id}`, {
                            method: "POST",
                            body: JSON.stringify({ accept: false }),
                          });
                          if (!res.ok) message.error(res.message || "失败");
                          else load();
                        }}
                      >
                        拒绝
                      </Button>
                    </div>
                  )),
            },
          ]}
        />
      </Card>
    </DriverShell>
  );
}
