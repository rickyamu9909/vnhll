"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, List, Typography, message } from "antd";
import dayjs from "dayjs";
import { CustomerShell } from "@/components/CustomerShell";
import { apiFetch } from "@/lib/client";

type Note = { id: string; title: string; body: string; read: boolean; createdAt: string };

export default function CustomerNotificationsPage() {
  const [rows, setRows] = useState<Note[]>([]);
  const load = async () => {
    const res = await apiFetch<Note[]>("/api/notifications");
    if (!res.ok) message.error(res.message || "加载失败");
    else setRows(res.data || []);
  };
  useEffect(() => {
    (async () => {
      await load();
      await apiFetch("/api/notifications", { method: "POST", body: JSON.stringify({ all: true }) });
      await load();
    })();
  }, []);
  return (
    <CustomerShell selected="notes">
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, gap: 8, flexWrap: "wrap" }}>
        <Typography.Title level={3} style={{ margin: 0 }}>
          通知
        </Typography.Title>
        <Button
          type="primary"
          size="small"
          onClick={async () => {
            await apiFetch("/api/notifications", { method: "POST", body: JSON.stringify({ all: true }) });
            message.success("已全部标为已读");
            load();
          }}
        >
          全部已读
        </Button>
      </div>
      <Card>
        <List
          dataSource={rows}
          locale={{ emptyText: "暂无通知" }}
          renderItem={(item) => {
            const orderNo = item.body.match(/ANTS-\d{8}-\d+/)?.[0];
            return (
              <List.Item
                actions={
                  orderNo
                    ? [
                        <Link key="go" href="/orders">
                          <Button type="primary" size="small">
                            去我的订单
                          </Button>
                        </Link>,
                      ]
                    : undefined
                }
              >
                <List.Item.Meta
                  title={`${item.read ? "" : "· "}${item.title} · ${dayjs(item.createdAt).format("YYYY-MM-DD HH:mm")}`}
                  description={item.body}
                />
              </List.Item>
            );
          }}
        />
      </Card>
    </CustomerShell>
  );
}
