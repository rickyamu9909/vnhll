"use client";

import { useEffect, useState } from "react";
import { Card, Col, Row, Statistic, Typography } from "antd";
import { AdminShell } from "@/components/AdminShell";
import { apiFetch } from "@/lib/client";

export default function AdminDashboard() {
  const [stats, setStats] = useState({ orders: 0, pendingOrders: 0, customers: 0, drivers: 0 });

  useEffect(() => {
    (async () => {
      const [orders, customers, drivers] = await Promise.all([
        apiFetch<unknown[]>("/api/admin/orders"),
        apiFetch<unknown[]>("/api/admin/customers"),
        apiFetch<unknown[]>("/api/admin/drivers"),
      ]);
      const orderList = orders.data || [];
      setStats({
        orders: orderList.length,
        pendingOrders: orderList.filter((o) => (o as { status: string }).status === "PENDING_REVIEW").length,
        customers: (customers.data || []).length,
        drivers: (drivers.data || []).length,
      });
    })();
  }, []);

  return (
    <AdminShell>
      <Typography.Title level={3}>工作台</Typography.Title>
      <Row gutter={16}>
        <Col span={6}><Card><Statistic title="订单总数" value={stats.orders} /></Card></Col>
        <Col span={6}><Card><Statistic title="待审核订单" value={stats.pendingOrders} /></Card></Col>
        <Col span={6}><Card><Statistic title="客户数" value={stats.customers} /></Card></Col>
        <Col span={6}><Card><Statistic title="司机数" value={stats.drivers} /></Card></Col>
      </Row>
    </AdminShell>
  );
}
