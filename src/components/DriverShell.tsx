"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { MenuOutlined } from "@ant-design/icons";
import { Button, Drawer, Layout, Menu, Space } from "antd";
import { LocaleSwitch } from "@/components/LocaleSwitch";
import { useI18n } from "@/components/I18nProvider";
import { apiFetch } from "@/lib/client";
import { PendingBanner } from "@/components/PendingBanner";
import { TrackReporter } from "@/components/TrackReporter";

const { Header, Content } = Layout;

export function DriverShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const selected = pathname.startsWith("/driver/team")
    ? "team"
    : pathname.startsWith("/driver/capacity")
      ? "capacity"
      : pathname.startsWith("/driver/notifications")
        ? "notes"
        : pathname.startsWith("/driver/orders") || pathname.startsWith("/driver/tasks")
          ? "mine"
          : "hall";
  const items = [
    { key: "hall", label: <Link href="/driver">{t("driver.hall", "订单中心")}</Link> },
    { key: "mine", label: <Link href="/driver/orders">{t("driver.mine", "我的订单")}</Link> },
    { key: "capacity", label: <Link href="/driver/capacity">{t("driver.capacity", "运力")}</Link> },
    { key: "team", label: <Link href="/driver/team">{t("driver.team", "司机管理")}</Link> },
    { key: "notes", label: <Link href="/driver/notifications">{t("driver.notes", "通知")}</Link> },
  ];

  return (
    <Layout className="page-shell" style={{ background: "transparent" }}>
      <Header className="shell-header" style={{ background: "#1d3557", display: "flex", alignItems: "center", gap: 8 }}>
        <Button className="shell-nav-mobile" size="small" icon={<MenuOutlined />} onClick={() => setOpen(true)} />
        <div className="shell-brand">{t("driver.brand", "ANTS 司机")}</div>
        <Menu className="shell-nav-desktop" theme="dark" mode="horizontal" selectedKeys={[selected]} items={items} />
        <Space style={{ marginLeft: "auto" }}>
          <LocaleSwitch />
          <Button
            size="small"
            onClick={async () => {
              await apiFetch("/api/auth/logout", { method: "POST" });
              router.push("/driver/login");
            }}
          >
            {t("driver.logout", "退出")}
          </Button>
        </Space>
      </Header>
      <Drawer title={t("nav.menu", "菜单")} placement="left" open={open} onClose={() => setOpen(false)} width={280}>
        <Menu mode="inline" selectedKeys={[selected]} items={items} onClick={() => setOpen(false)} />
      </Drawer>
      <Content className="page-content" style={{ maxWidth: 1100, width: "100%", margin: "24px auto", padding: "0 16px" }}>
        <TrackReporter />
        <PendingBanner api="/api/driver/notifications" fallbackHref="/driver/notifications" />
        {children}
      </Content>
    </Layout>
  );
}
