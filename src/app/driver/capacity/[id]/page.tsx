"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, Descriptions, Space, Tag, Typography, message } from "antd";
import dayjs from "dayjs";
import { ActionButton } from "@/components/ActionButton";
import { DriverShell } from "@/components/DriverShell";
import { BackButton } from "@/components/BackButton";
import { apiFetch, vehicleLabel } from "@/lib/client";
import { useI18n } from "@/components/I18nProvider";
import { localizeCapStatus } from "@/lib/localize";
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

export default function CapacityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const [row, setRow] = useState<Row | null>(null);
  useEffect(() => {
    (async () => {
      const res = await apiFetch<Row>(`/api/driver/capacity/${id}`);
      if (!res.ok) message.error(res.message || t("msg.load_fail", "加载失败"));
      else setRow(res.data || null);
    })();
  }, [id, t]);
  return (
    <DriverShell>
      <Space style={{ marginBottom: 16 }}>
        <BackButton href="/driver/capacity" />
        <Typography.Title level={3} style={{ margin: 0 }}>
          {t("cap.detail", "运力详情")}
        </Typography.Title>
      </Space>
      {row ? (
        <Card>
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label={t("form.status", "状态")}>{localizeCapStatus(row.status, t)}</Descriptions.Item>
            <Descriptions.Item label={t("cap.location", "空车位置")}>{row.location}</Descriptions.Item>
            <Descriptions.Item label={t("cap.dest_pref", "目的偏好")}>{row.destPreference || "-"}</Descriptions.Item>
            <Descriptions.Item label={t("cap.available", "可接时间")}>
              {dayjs(row.availableFrom).format("YYYY-MM-DD HH:mm")} {t("cap.to", "至")} {dayjs(row.availableTo).format("YYYY-MM-DD HH:mm")}
            </Descriptions.Item>
            <Descriptions.Item label={t("form.vehicle", "车型")}>{vehicleLabel(row.vehicleType, t)}</Descriptions.Item>
            <Descriptions.Item label={t("form.load_tons", "载重")}>
              {row.loadTons} {t("cap.tons", "吨")}
            </Descriptions.Item>
            <Descriptions.Item label={t("form.cargo", "货物")}>{row.cargoTypes}</Descriptions.Item>
            <Descriptions.Item label={t("cap.expected", "期望价")}>{formatVnd(row.expectedPriceVnd)}</Descriptions.Item>
            <Descriptions.Item label={t("cap.airport_port", "机场/港口")}>
              {row.airportOk ? t("cap.airport_yes", "可进机场") : t("cap.airport_no", "不进机场")} /{" "}
              {row.portOk ? t("cap.port_yes", "可进港口") : t("cap.port_no", "不进港口")}
            </Descriptions.Item>
            <Descriptions.Item label={t("form.note", "备注")}>{row.note || "-"}</Descriptions.Item>
          </Descriptions>
          <Space style={{ marginTop: 16 }} wrap>
            {row.status === "OPEN" ? (
              <ActionButton href={`/driver/capacity/${row.id}/edit`} tone="primary">
                {t("cap.edit", "编辑")}
              </ActionButton>
            ) : null}
            {row.orderId ? (
              <ActionButton href={`/driver/orders/${row.orderId}`} tone="green">
                {t("cap.view_order", "查看订单")}
              </ActionButton>
            ) : (
              <Tag>{t("cap.no_order", "尚未生成订单")}</Tag>
            )}
          </Space>
        </Card>
      ) : null}
    </DriverShell>
  );
}
