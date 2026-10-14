"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MenuOutlined } from "@ant-design/icons";
import { Button, Drawer, Layout, Menu, Space, Typography } from "antd";
import { LocaleSwitch } from "@/components/LocaleSwitch";
import { useI18n } from "@/components/I18nProvider";
import { apiFetch } from "@/lib/client";

const { Header, Content } = Layout;

export function CustomerShell({ children, selected }: { children: React.ReactNode; selected: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const items = [
    { key: "orders", label: <Link href="/orders">{t("nav.orders", "我的订单")}</Link> },
    { key: "new", label: <Link href="/orders/new">{t("nav.new_order", "发布订单")}</Link> },
    { key: "capacity", label: <Link href="/orders/capacity">{t("nav.capacity_hall", "运力大厅")}</Link> },
    { key: "matches", label: <Link href="/orders/matches">{t("nav.matches", "我的匹配")}</Link> },
  ];

  const logout = async () => {
    await apiFetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  return (
    <Layout className="page-shell" style={{ background: "transparent" }}>
      <Header className="shell-header" style={{ background: "#083d30", display: "flex", alignItems: "center", gap: 8 }}>
        <Button className="shell-nav-mobile" size="small" icon={<MenuOutlined />} onClick={() => setOpen(true)} />
        <Typography.Text className="shell-brand" style={{ fontSize: 18 }}>ANTS</Typography.Text>
        <Menu className="shell-nav-desktop" theme="dark" mode="horizontal" selectedKeys={[selected]} items={items} />
        <Space style={{ marginLeft: "auto" }}>
          <LocaleSwitch />
          <Button size="small" onClick={logout}>
            {t("action.logout", "退出")}
          </Button>
        </Space>
      </Header>
      <Drawer title={t("nav.menu", "菜单")} placement="left" open={open} onClose={() => setOpen(false)} width={280}>
        <Menu mode="inline" selectedKeys={[selected]} items={items} onClick={() => setOpen(false)} />
      </Drawer>
      <Content className="page-content" style={{ maxWidth: 1100, width: "100%", margin: "24px auto", padding: "0 16px" }}>{children}</Content>
    </Layout>
  );
}
