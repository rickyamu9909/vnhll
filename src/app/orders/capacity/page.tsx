"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, Space, Tag, Typography, message } from "antd";
import { CustomerShell } from "@/components/CustomerShell";
import { QueryFields } from "@/components/QueryFields";
import { apiFetch, vehicleLabel } from "@/lib/client";
import { useI18n } from "@/components/I18nProvider";
import { includesText } from "@/lib/order-view";
import { formatVnd } from "@/lib/money";

type Row = {
  id: string;
  location: string;
  destPreference?: string;
  vehicleType: string;
  loadTons: number;
  airportOk: boolean;
  portOk: boolean;
  expectedPriceVnd: string;
  publisherName: string;
  score?: number;
  scoreLevel?: string | null;
  reason?: string | null;
};

export default function CapacityHallPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<Row[]>([]);
  const [query, setQuery] = useState<Record<string, string>>({});
  useEffect(() => {
    (async () => {
      const res = await apiFetch<Row[]>("/api/capacity");
      if (!res.ok) message.error(res.message || "加载失败");
      else setRows(res.data || []);
    })();
  }, []);
  const shown = useMemo(
    () =>
      rows.filter(
        (row) =>
          includesText(row.location, query.location) &&
          includesText(row.destPreference, query.dest) &&
          includesText(`${row.vehicleType} ${vehicleLabel(row.vehicleType, t)}`, query.vehicle) &&
          includesText(row.publisherName, query.publisher) &&
          includesText(row.expectedPriceVnd, query.price)
      ),
    [rows, query, t]
  );
  return (
    <CustomerShell selected="capacity">
      <Typography.Title level={3}>运力大厅</Typography.Title>
      <Card size="small" style={{ marginBottom: 12 }}>
        <QueryFields
          fields={[
            { name: "location", placeholder: "空车位置" },
            { name: "dest", placeholder: "目的偏好" },
            { name: "vehicle", placeholder: "车型" },
            { name: "publisher", placeholder: "发布人" },
            { name: "price", placeholder: "期望价" },
          ]}
          onSearch={setQuery}
        />
      </Card>
      <Space direction="vertical" style={{ width: "100%" }} size={12}>
        {shown.map((row) => (
          <Card key={row.id} size="small">
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <div>
                <Typography.Text strong>{row.location}</Typography.Text>
                <div style={{ color: "#64748b" }}>→ {row.destPreference || "目的不限"}</div>
              </div>
              <Space wrap>
                {row.scoreLevel ? <Tag color={row.scoreLevel === "高" ? "green" : row.scoreLevel === "中" ? "blue" : "default"}>顺路度{row.scoreLevel}</Tag> : null}
                <Tag>{vehicleLabel(row.vehicleType, t)}</Tag>
              </Space>
            </div>
            {row.reason ? <div style={{ marginTop: 6, fontSize: 12, color: "#475569" }}>{row.reason}</div> : null}
            <div style={{ marginTop: 6, fontSize: 13 }}>
              {formatVnd(row.expectedPriceVnd)} VND · {row.loadTons} 吨 · {row.publisherName}
              {` · ${row.airportOk ? "可进机场" : "不可进机场"} / ${row.portOk ? "可进港口" : "不可进港口"}`}
            </div>
            <Link href={`/orders/capacity/${row.id}`} style={{ display: "inline-block", marginTop: 8 }}>
              发起匹配
            </Link>
          </Card>
        ))}
        {!shown.length ? <Card size="small">暂无可匹配运力。你有进行中订单时，这里会按顺路度排序。</Card> : null}
      </Space>
    </CustomerShell>
  );
}
