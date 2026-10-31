"use client";

import { useEffect, useState } from "react";
import { Card, Table, Typography, message } from "antd";
import { ActionButton } from "@/components/ActionButton";
import { CustomerShell } from "@/components/CustomerShell";
import { MatchSuggestions } from "@/components/MatchSuggestions";
import { useI18n } from "@/components/I18nProvider";
import { apiFetch } from "@/lib/client";
import { localizeNegStatus } from "@/lib/localize";
import { formatVnd } from "@/lib/money";

type Row = { id: string; status: string; priceVnd: string; location: string; expectedPriceVnd: string; orderId?: string };

export default function MatchesPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<Row[]>([]);
  useEffect(() => {
    (async () => {
      const res = await apiFetch<Row[]>("/api/matches");
      if (!res.ok) message.error(res.message || t("msg.load_fail", "加载失败"));
      else setRows(res.data || []);
    })();
  }, [t]);
  return (
    <CustomerShell selected="matches">
      <Typography.Title level={3}>{t("match.mine", "我的匹配")}</Typography.Title>
      <MatchSuggestions />
      <Card>
        <Table
          rowKey="id"
          dataSource={rows}
          pagination={{ pageSize: 15, showSizeChanger: true, pageSizeOptions: ["15", "25", "50", "100", "500"] }}
          columns={[
            { title: t("cap.location", "空车位置"), dataIndex: "location" },
            { title: t("cap.expected", "期望价"), dataIndex: "expectedPriceVnd", render: (v) => formatVnd(v) },
            { title: t("cap.my_price", "我的价格"), dataIndex: "priceVnd", render: (v) => formatVnd(v) },
            { title: t("form.status", "状态"), dataIndex: "status", render: (v: string) => localizeNegStatus(v, t) },
            {
              title: t("match.order", "订单"),
              render: (_, r) =>
                r.orderId ? (
                  <ActionButton href={`/orders/${r.orderId}`} tone="primary">
                    {t("banner.view", "查看")}
                  </ActionButton>
                ) : (
                  "-"
                ),
            },
          ]}
        />
      </Card>
    </CustomerShell>
  );
}
