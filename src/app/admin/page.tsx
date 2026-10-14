"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, Col, Row, Statistic, Typography } from "antd";
import { AdminShell } from "@/components/AdminShell";
import { useI18n } from "@/components/I18nProvider";
import { apiFetch } from "@/lib/client";

const cards = [
  { key: "orders", href: "/admin/orders", titleKey: "dash.orders", fallback: "订单总数" },
  { key: "pendingOrders", href: "/admin/orders", titleKey: "dash.pending", fallback: "待审核订单" },
  { key: "customers", href: "/admin/customers", titleKey: "dash.customers", fallback: "客户数" },
  { key: "drivers", href: "/admin/drivers", titleKey: "dash.drivers", fallback: "司机数" },
] as const;

export default function AdminDashboard() {
  const { t } = useI18n();
  const [stats, setStats] = useState({ orders: 0, pendingOrders: 0, customers: 0, drivers: 0 });

  useEffect(() => {
    (async () => {
      const [orders, customers, drivers] = await Promise.all([
        apiFetch<unknown[]>("/api/admin/orders"),
        apiFetch<unknown[]>("/api/admin/customers"),
        apiFetch<unknown[]>("/api/admin/drivers"),
      ]);
      const orderList = orders.data || [];
      const pending = new Set(["PENDING_REVIEW", "PENDING_AUDIT", "LOCKED"]);
      setStats({
        orders: orderList.length,
        pendingOrders: orderList.filter((o) => pending.has((o as { status: string }).status)).length,
        customers: (customers.data || []).length,
        drivers: (drivers.data || []).length,
      });
    })();
  }, []);

  return (
    <AdminShell>
      <Typography.Title level={3}>{t("dash.title", "工作台")}</Typography.Title>
      <Row gutter={16}>
        {cards.map((card) => (
          <Col span={6} key={card.key}>
            <Link href={card.href}>
              <Card hoverable>
                <Statistic title={t(card.titleKey, card.fallback)} value={stats[card.key]} />
              </Card>
            </Link>
          </Col>
        ))}
      </Row>
    </AdminShell>
  );
}
