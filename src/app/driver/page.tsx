"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, Input, Space, Tag, Typography, message } from "antd";
import dayjs from "dayjs";
import { ActionButton } from "@/components/ActionButton";
import { DriverShell } from "@/components/DriverShell";
import { MatchSuggestions } from "@/components/MatchSuggestions";
import { QueryFields } from "@/components/QueryFields";
import { apiFetch, pathLabel, statusLabel } from "@/lib/client";
import { useI18n } from "@/components/I18nProvider";
import { ORDER_QUERY_FIELDS, orderMatches, type OrderListRow } from "@/lib/order-view";
import { formatVnd } from "@/lib/money";

type HallRow = OrderListRow & {
  routeDistanceKm?: number | null;
  routeDurationMin?: number | null;
  routeSource?: string | null;
  bestScore?: number | null;
  scoreReason?: string | null;
};

export default function DriverHallPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<HallRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState<Record<string, string>>({});
  const [line, setLine] = useState("");

  useEffect(() => {
    (async () => {
      const res = await apiFetch<HallRow[]>("/api/driver/orders");
      setLoading(false);
      if (!res.ok) message.error(res.message || "加载失败");
      else setRows(res.data || []);
    })();
  }, []);

  const shown = useMemo(() => {
    let list = rows.filter((row) => orderMatches(row, query));
    if (line.trim()) {
      const q = line.trim().toLowerCase();
      list = list.filter((row) => `${row.originAddress || ""} ${row.pickupAddress || ""} ${row.destAddress || ""} ${row.deliveryAddress || ""}`.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => (b.bestScore || 0) - (a.bestScore || 0) || dayjs(b.pickupAt).valueOf() - dayjs(a.pickupAt).valueOf());
  }, [rows, query, line]);

  return (
    <DriverShell>
      <Typography.Title level={3}>货源大厅</Typography.Title>
      <MatchSuggestions />
      <Card loading={loading} size="small" style={{ marginBottom: 12 }}>
        <Input.Search allowClear placeholder="按线路关键词筛选，如 Cát Lái" onSearch={setLine} onChange={(e) => !e.target.value && setLine("")} style={{ marginBottom: 8 }} />
        <QueryFields fields={ORDER_QUERY_FIELDS.slice(0, 6)} onSearch={setQuery} />
      </Card>
      <Space direction="vertical" style={{ width: "100%" }} size={12}>
        {shown.map((row) => {
          const origin = row.originAddress || row.pickupAddress || "-";
          const dest = row.destAddress || row.deliveryAddress || "-";
          const price = row.targetPriceVnd || row.customerBidVnd;
          const route =
            row.routeDistanceKm != null
              ? `约 ${row.routeDistanceKm} km${row.routeDurationMin != null ? ` · ${row.routeDurationMin} 分钟` : ""}${row.routeSource === "straight" ? "（直线）" : ""}`
              : null;
          return (
            <Card key={row.id} size="small" styles={{ body: { padding: 14 } }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                <div>
                  <Typography.Text strong>{origin}</Typography.Text>
                  <div style={{ color: "#64748b" }}>→ {dest}</div>
                </div>
                <Space wrap>
                  <Tag>{pathLabel(row.matchPath)}</Tag>
                  <Tag>{statusLabel(row.status, t)}</Tag>
                  {row.bestScore != null && row.bestScore > 0 ? (
                    <Tag color={row.bestScore >= 70 ? "green" : row.bestScore >= 45 ? "blue" : "default"}>顺路 {row.bestScore}</Tag>
                  ) : null}
                </Space>
              </div>
              <div style={{ marginTop: 8, fontSize: 13, color: "#475569" }}>
                {row.orderNo}
                {route ? ` · ${route}` : ""}
                {row.pickupAt ? ` · 装货 ${dayjs(row.pickupAt).format("MM-DD HH:mm")}` : ""}
                {price ? ` · ${formatVnd(price)} VND` : " · 询价"}
              </div>
              {row.scoreReason ? <div style={{ marginTop: 4, fontSize: 12, color: "#64748b" }}>{row.scoreReason}</div> : null}
              <Space style={{ marginTop: 10 }} wrap>
                <ActionButton href={`/driver/orders/${row.id}`} tone="primary">
                  {row.matchPath === "A" ? "抢单" : row.matchPath === "B" ? "报价" : "查看"}
                </ActionButton>
                <ActionButton href={`/driver/orders/${row.id}`} tone="cyan">
                  详情
                </ActionButton>
              </Space>
            </Card>
          );
        })}
        {!loading && !shown.length ? <Card size="small">暂无货源。发布运力后，顺路订单会推到这里和「待处理」提醒。</Card> : null}
      </Space>
    </DriverShell>
  );
}
