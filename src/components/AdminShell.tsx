"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button, Drawer, Layout, Menu, Space, Typography } from "antd";
import {
  CarOutlined,
  FileTextOutlined,
  TeamOutlined,
  TranslationOutlined,
  DashboardOutlined,
  MenuOutlined,
} from "@ant-design/icons";
import { LocaleSwitch } from "@/components/LocaleSwitch";
import { useI18n } from "@/components/I18nProvider";
import { apiFetch } from "@/lib/client";

const { Header, Sider, Content } = Layout;

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const selected =
    pathname.startsWith("/admin/orders")
      ? "orders"
      : pathname.startsWith("/admin/registrations")
        ? "registrations"
        : pathname.startsWith("/admin/config")
          ? "config"
          : pathname.startsWith("/admin/logs")
            ? "logs"
            : pathname.startsWith("/admin/customers")
        ? "customers"
        : pathname.startsWith("/admin/drivers")
          ? "drivers"
          : pathname.startsWith("/admin/i18n")
            ? "i18n"
            : "dashboard";

  const items = [
    { key: "dashboard", icon: <DashboardOutlined />, label: <Link href="/admin">{t("nav.dashboard", "工作台")}</Link> },
    { key: "orders", icon: <FileTextOutlined />, label: <Link href="/admin/orders">{t("nav.admin_orders", "订单管理")}</Link> },
    { key: "registrations", icon: <TeamOutlined />, label: <Link href="/admin/registrations">{t("nav.registrations", "注册审核")}</Link> },
    { key: "config", icon: <DashboardOutlined />, label: <Link href="/admin/config">{t("nav.config", "系统配置")}</Link> },
    { key: "customers", icon: <TeamOutlined />, label: <Link href="/admin/customers">{t("nav.admin_customers", "客户管理")}</Link> },
    { key: "drivers", icon: <CarOutlined />, label: <Link href="/admin/drivers">{t("nav.admin_drivers", "司机管理")}</Link> },
    { key: "i18n", icon: <TranslationOutlined />, label: <Link href="/admin/i18n">{t("nav.admin_i18n", "语言包")}</Link> },
  ];

  const logout = async () => {
    await apiFetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
  };

  return (
    <Layout className="page-shell">
      <Sider className="admin-sider" width={220} style={{ background: "#001529" }}>
        <div style={{ color: "#fff", fontWeight: 700, padding: 16, fontSize: 18 }}>ANTS Admin</div>
        <Menu theme="dark" mode="inline" selectedKeys={[selected]} items={items} />
      </Sider>
      <Layout>
        <Header className="shell-header" style={{ background: "#fff", display: "flex", alignItems: "center", gap: 12 }}>
          <Button className="shell-nav-mobile" icon={<MenuOutlined />} onClick={() => setOpen(true)} />
          <Space style={{ marginLeft: "auto" }}>
            <LocaleSwitch />
            <Button onClick={logout}>{t("action.logout", "退出")}</Button>
          </Space>
        </Header>
        <Drawer title={t("nav.menu", "菜单")} placement="left" open={open} onClose={() => setOpen(false)} width={280}>
          <Menu mode="inline" selectedKeys={[selected]} items={items} onClick={() => setOpen(false)} />
        </Drawer>
        <Content className="admin-content" style={{ margin: 24 }}>
          <Typography.Text type="secondary" style={{ display: "none" }}>
            admin
          </Typography.Text>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
