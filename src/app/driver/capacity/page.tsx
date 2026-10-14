"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, Table, Typography, message } from "antd";
import { DriverShell } from "@/components/DriverShell";
import { MatchSuggestions } from "@/components/MatchSuggestions";
import { useI18n } from "@/components/I18nProvider";
import { apiFetch } from "@/lib/client";
import { formatVnd } from "@/lib/money";

type Row = { id: string; location: string; expectedPriceVnd: string; status: string; negotiations: Array<{ id: string; status: string; priceVnd: string }> };

export default function CapacityListPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState<Row[]>([]);
  const load = async () => {
    const res = await apiFetch<Row[]>("/api/driver/capacity");
    if (!res.ok) message.error(res.message || "加载失败");
    else setRows(res.data || []);
  };
  useEffect(() => {
    load();
  }, []);
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
        <Table
          rowKey="id"
          dataSource={rows}
          columns={[
            { title: "空车位置", dataIndex: "location" },
            { title: "期望价", dataIndex: "expectedPriceVnd", render: (v) => formatVnd(v) },
            { title: "状态", dataIndex: "status" },
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
