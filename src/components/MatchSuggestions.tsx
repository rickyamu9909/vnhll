"use client";

import { useEffect, useState } from "react";
import { Alert, Card, Space, Tag, Typography, message } from "antd";
import dayjs from "dayjs";
import { ActionButton } from "@/components/ActionButton";
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

  const needConfirm = rows.filter((row) => !row.waiting && (row.status === "CUSTOMER_OK" || row.status === "DRIVER_OK"));

  return (
    <Card size="small" title={t("suggest.title", "顺路可撮合")} style={{ marginBottom: 16 }}>
      {needConfirm.length ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          message="对方已确认顺路撮合，请点击「确认匹配」完成闭环，订单才会进入待执行。"
        />
      ) : null}
      <Space direction="vertical" style={{ width: "100%" }}>
        {rows.map((row) => {
          const detailHref = row.mine === "driver" ? `/driver/orders/${row.orderId || ""}` : `/orders/${row.orderId || ""}`;
          const peerConfirmed =
            (row.mine === "customer" && row.status === "DRIVER_OK") || (row.mine === "driver" && row.status === "CUSTOMER_OK");
          return (
            <div key={row.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              <div>
                <Typography.Text strong>{row.orderNo}</Typography.Text> {levelTag(row.score)}
                {row.deadline ? <Tag>{dayjs(row.deadline).format("HH:mm")} 前有效</Tag> : null}
                {peerConfirmed ? <Tag color="orange">对方已确认，待你确认</Tag> : null}
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
                  <ActionButton href={detailHref} tone="cyan">
                    订单详情
                  </ActionButton>
                ) : null}
                {row.waiting ? (
                  <Typography.Text type="secondary">{t("suggest.wait", "已确认，等待对方确认")}</Typography.Text>
                ) : (
                  <>
                    <ActionButton tone="primary" onClick={() => act(row.id, true)}>
                      确认匹配
                    </ActionButton>
                    <ActionButton tone="danger" onClick={() => act(row.id, false)}>
                      不匹配
                    </ActionButton>
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
