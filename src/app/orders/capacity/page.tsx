"use client";

import { useEffect, useMemo, useState } from "react";
import { Card, Space, Tag, Typography, message } from "antd";
import { ActionButton } from "@/components/ActionButton";
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
      if (!res.ok) message.error(res.message || t("msg.load_fail", "加载失败"));
      else setRows(res.data || []);
    })();
  }, [t]);
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
  const fitTag = (level?: string | null) => {
    if (!level) return null;
    if (level === "高" || level === "cao") return <Tag color="green">{t("cap.fit_high", "顺路度高")}</Tag>;
    if (level === "中" || level === "trung") return <Tag color="blue">{t("cap.fit_mid", "顺路度中")}</Tag>;
    return <Tag>{t("cap.fit_low", "顺路度低")}</Tag>;
  };
  return (
    <CustomerShell selected="capacity">
      <Typography.Title level={3}>{t("cap.hall", "运力大厅")}</Typography.Title>
      <Card size="small" style={{ marginBottom: 12 }}>
        <QueryFields
          fields={[
            { name: "location", placeholder: t("cap.location", "空车位置") },
            { name: "dest", placeholder: t("cap.dest_pref", "目的偏好") },
            { name: "vehicle", placeholder: t("form.vehicle", "车型") },
            { name: "publisher", placeholder: t("cap.publisher", "发布人") },
            { name: "price", placeholder: t("cap.expected", "期望价") },
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
                <div style={{ color: "#64748b" }}>→ {row.destPreference || t("cap.any_dest", "目的不限")}</div>
              </div>
              <Space wrap>
                {fitTag(row.scoreLevel)}
                <Tag>{vehicleLabel(row.vehicleType, t)}</Tag>
              </Space>
            </div>
            {row.reason ? <div style={{ marginTop: 6, fontSize: 12, color: "#475569" }}>{row.reason}</div> : null}
            <div style={{ marginTop: 6, fontSize: 13 }}>
              {formatVnd(row.expectedPriceVnd)} VND · {row.loadTons} {t("cap.tons", "吨")} · {row.publisherName}
              {` · ${row.airportOk ? t("cap.airport_yes", "可进机场") : t("cap.airport_no", "不进机场")} / ${
                row.portOk ? t("cap.port_yes", "可进港口") : t("cap.port_no", "不进港口")
              }`}
            </div>
            <div style={{ marginTop: 10 }}>
              <ActionButton href={`/orders/capacity/${row.id}`} tone="primary">
                {t("cap.start_match", "发起匹配")}
              </ActionButton>
            </div>
          </Card>
        ))}
        {!shown.length ? <Card size="small">{t("cap.empty_hall", "暂无可匹配运力。你有进行中订单时，这里会按顺路度排序。")}</Card> : null}
      </Space>
    </CustomerShell>
  );
}
