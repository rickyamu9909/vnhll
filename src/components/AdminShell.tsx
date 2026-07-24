"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button, Layout, Menu, Space, Typography } from "antd";
import {
  CarOutlined,
  FileTextOutlined,
  TeamOutlined,
  TranslationOutlined,
  DashboardOutlined,
} from "@ant-design/icons";
import { LocaleSwitch } from "@/components/LocaleSwitch";
import { useI18n } from "@/components/I18nProvider";
import { apiFetch } from "@/lib/client";

const { Header, Sider, Content } = Layout;

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const router = useRouter();

  const selected =
    pathname.startsWith("/admin/orders")
      ? "orders"
      : pathname.startsWith("/admin/customers")
        ? "customers"
        : pathname.startsWith("/admin/drivers")
          ? "drivers"
          : pathname.startsWith("/admin/i18n")
            ? "i18n"
            : "dashboard";

  const logout = async () => {
    await apiFetch("/api/auth/logout", { method: "POST" });
    router.push("/admin/login");
  };

  return (
    <Layout className="page-shell">
      <Sider breakpoint="lg" collapsedWidth={0} style={{ background: "#001529" }}>
        <div style={{ color: "#fff", fontWeight: 700, padding: 16, fontSize: 18 }}>ynhll Admin</div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selected]}
          items={[
            { key: "dashboard", icon: <DashboardOutlined />, label: <Link href="/admin">{t("nav.dashboard", "工作台")}</Link> },
            { key: "orders", icon: <FileTextOutlined />, label: <Link href="/admin/orders">{t("nav.admin_orders", "订单管理")}</Link> },
            { key: "customers", icon: <TeamOutlined />, label: <Link href="/admin/customers">{t("nav.admin_customers", "客户管理")}</Link> },
            { key: "drivers", icon: <CarOutlined />, label: <Link href="/admin/drivers">{t("nav.admin_drivers", "司机管理")}</Link> },
            { key: "i18n", icon: <TranslationOutlined />, label: <Link href="/admin/i18n">{t("nav.admin_i18n", "语言包")}</Link> },
          ]}
        />
      </Sider>
      <Layout>
        <Header style={{ background: "#fff", display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 12 }}>
          <LocaleSwitch />
          <Button onClick={logout}>{t("action.logout", "退出")}</Button>
        </Header>
        <Content style={{ margin: 24 }}>
          <Typography.Text type="secondary" style={{ display: "none" }}>
            admin
          </Typography.Text>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
