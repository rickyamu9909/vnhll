"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button, Card, Descriptions, Space, Tag, Typography, message } from "antd";
import dayjs from "dayjs";
import { DriverShell } from "@/components/DriverShell";
import { BackButton } from "@/components/BackButton";
import { apiFetch, vehicleLabel } from "@/lib/client";
import { useI18n } from "@/components/I18nProvider";
import { formatVnd } from "@/lib/money";

type Row = {
  id: string;
  location: string;
  destPreference: string | null;
  availableFrom: string;
  availableTo: string;
  vehicleType: string;
  loadTons: number;
  cargoTypes: string;
  expectedPriceVnd: string;
  airportOk: boolean;
  portOk: boolean;
  note: string | null;
  status: string;
  orderId: string | null;
};

const STATUS: Record<string, string> = { OPEN: "可匹配", MATCHED: "已匹配", CLOSED: "已取消" };

export default function CapacityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const [row, setRow] = useState<Row | null>(null);
  useEffect(() => {
    (async () => {
      const res = await apiFetch<Row>(`/api/driver/capacity/${id}`);
      if (!res.ok) message.error(res.message || "加载失败");
      else setRow(res.data || null);
    })();
  }, [id]);
  return (
    <DriverShell>
      <Space style={{ marginBottom: 16 }}>
        <BackButton href="/driver/capacity" />
        <Typography.Title level={3} style={{ margin: 0 }}>
          运力详情
        </Typography.Title>
      </Space>
      {row ? (
        <Card>
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="状态">{STATUS[row.status] || row.status}</Descriptions.Item>
            <Descriptions.Item label="空车位置">{row.location}</Descriptions.Item>
            <Descriptions.Item label="目的地偏好">{row.destPreference || "-"}</Descriptions.Item>
            <Descriptions.Item label="可接时间">
              {dayjs(row.availableFrom).format("YYYY-MM-DD HH:mm")} 至 {dayjs(row.availableTo).format("YYYY-MM-DD HH:mm")}
            </Descriptions.Item>
            <Descriptions.Item label="车型">{vehicleLabel(row.vehicleType, t)}</Descriptions.Item>
            <Descriptions.Item label="载重">{row.loadTons} 吨</Descriptions.Item>
            <Descriptions.Item label="货物">{row.cargoTypes}</Descriptions.Item>
            <Descriptions.Item label="期望价">{formatVnd(row.expectedPriceVnd)}</Descriptions.Item>
            <Descriptions.Item label="机场/港口">
              {row.airportOk ? "可进机场" : "不进机场"} / {row.portOk ? "可进港口" : "不进港口"}
            </Descriptions.Item>
            <Descriptions.Item label="备注">{row.note || "-"}</Descriptions.Item>
          </Descriptions>
          <Space style={{ marginTop: 16 }}>
            {row.status === "OPEN" ? (
              <Link href={`/driver/capacity/${row.id}/edit`}>
                <Button type="primary">编辑</Button>
              </Link>
            ) : null}
            {row.orderId ? (
              <Link href={`/driver/orders/${row.orderId}`}>
                <Button>查看订单</Button>
              </Link>
            ) : (
              <Tag>尚未生成订单</Tag>
            )}
          </Space>
        </Card>
      ) : null}
    </DriverShell>
  );
}
