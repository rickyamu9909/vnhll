"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, Space, Tag, Typography, message } from "antd";
import dayjs from "dayjs";
import { useI18n } from "@/components/I18nProvider";
import { apiFetch } from "@/lib/client";
import { formatVnd } from "@/lib/money";

type Row = {
  id: string;
  status: string;
  distanceKm: number;
  basis: string;
  score?: number;
  reason?: string | null;
  deadline?: string | null;
  orderNo: string;
  orderId?: string;
  pickup: string;
  delivery: string;
  location: string;
  destPreference?: string | null;
  expectedPriceVnd: string;
  mine: "customer" | "driver";
  waiting: boolean;
};

function levelTag(score?: number) {
  if (score == null) return null;
  if (score >= 70) return <Tag color="green">顺路度高</Tag>;
  if (score >= 45) return <Tag color="blue">顺路度中</Tag>;
  return <Tag>顺路度低</Tag>;
}

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
    message.success(accept ? t("suggest.done", "已确认，订单状态已更新") : t("suggest.rejected", "已拒绝"));
    load();
  };

  if (!rows.length) return null;
  return (
    <Card size="small" title={t("suggest.title", "顺路可撮合")} style={{ marginBottom: 16 }}>
      <Space direction="vertical" style={{ width: "100%" }}>
        {rows.map((row) => {
          const detailHref = row.mine === "driver" ? `/driver/orders/${row.orderId || ""}` : `/orders/${row.orderId || ""}`;
          return (
            <div key={row.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <Typography.Text strong>{row.orderNo}</Typography.Text> {levelTag(row.score)}
                {row.deadline ? <Tag>{dayjs(row.deadline).format("HH:mm")} 前有效</Tag> : null}
                <div style={{ color: "#475569", fontSize: 13 }}>{row.reason || `${row.pickup} → ${row.delivery}`}</div>
                <div style={{ color: "#64748b", fontSize: 12 }}>
                  {row.pickup} → {row.delivery}
                  {row.destPreference ? ` · ${row.destPreference}` : ` · ${row.location}`}
                  {" · "}
                  {formatVnd(row.expectedPriceVnd)}
                </div>
              </div>
              <Space wrap>
                {row.orderId ? (
                  <Link href={detailHref}>
                    <Button size="small">订单详情</Button>
                  </Link>
                ) : null}
                {row.waiting ? (
                  <Typography.Text type="secondary">{t("suggest.wait", "已确认，等待对方")}</Typography.Text>
                ) : (
                  <>
                    <Button size="small" type="primary" onClick={() => act(row.id, true)}>
                      确认匹配
                    </Button>
                    <Button size="small" danger onClick={() => act(row.id, false)}>
                      不匹配
                    </Button>
                  </>
                )}
              </Space>
            </div>
          );
        })}
      </Space>
    </Card>
  );
}
