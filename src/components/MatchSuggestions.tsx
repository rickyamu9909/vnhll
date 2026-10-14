"use client";

import { useEffect, useState } from "react";
import { Button, Card, Space, Tag, Typography, message } from "antd";
import { useI18n } from "@/components/I18nProvider";
import { apiFetch } from "@/lib/client";
import { formatVnd } from "@/lib/money";

type Row = {
  id: string;
  status: string;
  distanceKm: number;
  basis: string;
  orderNo: string;
  pickup: string;
  delivery: string;
  location: string;
  destPreference?: string | null;
  expectedPriceVnd: string;
  mine: "customer" | "driver";
  waiting: boolean;
};

export function MatchSuggestions() {
  const { t } = useI18n();
  const [rows, setRows] = useState<Row[]>([]);

  const load = async () => {
    const res = await apiFetch<Row[]>("/api/suggestions");
    if (res.ok) setRows(res.data || []);
  };

  useEffect(() => {
    load();
  }, []);

  const act = async (id: string, accept: boolean) => {
    const res = await apiFetch(`/api/suggestions/${id}`, { method: "POST", body: JSON.stringify({ accept }) });
    if (!res.ok) {
      message.error(res.message || t("suggest.fail", "处理失败"));
      return;
    }
    message.success(accept ? t("suggest.done", "已确认") : t("suggest.rejected", "已拒绝"));
    load();
  };

  if (!rows.length) return null;
  return (
    <Card size="small" title={t("suggest.title", "附近可撮合")} style={{ marginBottom: 16 }}>
      <Space direction="vertical" style={{ width: "100%" }}>
        {rows.map((row) => (
          <div key={row.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <Typography.Text strong>{row.orderNo}</Typography.Text>{" "}
              <Tag>{row.distanceKm} km</Tag>
              <Tag>{row.basis === "DEST" ? t("suggest.dest", "送货地址 ↔ 目的地偏好") : t("suggest.pickup", "接货地址 ↔ 当前空车")}</Tag>
              <div style={{ color: "#475569", fontSize: 13 }}>
                {row.pickup} → {row.delivery}
                {row.destPreference ? ` · ${row.destPreference}` : ` · ${row.location}`}
                {" · "}
                {formatVnd(row.expectedPriceVnd)}
              </div>
            </div>
            {row.waiting ? (
              <Typography.Text type="secondary">{t("suggest.wait", "已确认，等待对方")}</Typography.Text>
            ) : (
              <Space>
                <Button size="small" type="primary" onClick={() => act(row.id, true)}>
                  {t("suggest.accept", "确认匹配")}
                </Button>
                <Button size="small" danger onClick={() => act(row.id, false)}>
                  {t("suggest.reject", "不匹配")}
                </Button>
              </Space>
            )}
          </div>
        ))}
      </Space>
    </Card>
  );
}
