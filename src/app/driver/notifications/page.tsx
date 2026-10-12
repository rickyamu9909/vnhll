"use client";

import { useEffect, useState } from "react";
import { Card, List, Typography, message } from "antd";
import dayjs from "dayjs";
import { DriverShell } from "@/components/DriverShell";
import { apiFetch } from "@/lib/client";

type Note = { id: string; title: string; body: string; read: boolean; createdAt: string };

export default function DriverNotificationsPage() {
  const [rows, setRows] = useState<Note[]>([]);
  useEffect(() => {
    (async () => {
      const res = await apiFetch<Note[]>("/api/driver/notifications");
      if (!res.ok) message.error(res.message || "加载失败");
      else setRows(res.data || []);
    })();
  }, []);
  return (
    <DriverShell>
      <Typography.Title level={3}>通知</Typography.Title>
      <Card>
        <List
          dataSource={rows}
          locale={{ emptyText: "暂无通知" }}
          renderItem={(item) => (
            <List.Item>
              <List.Item.Meta
                title={`${item.title} · ${dayjs(item.createdAt).format("YYYY-MM-DD HH:mm")}`}
                description={item.body}
              />
            </List.Item>
          )}
        />
      </Card>
    </DriverShell>
  );
}
