"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button, Layout, Menu, Space } from "antd";
import { LocaleSwitch } from "@/components/LocaleSwitch";
import { useI18n } from "@/components/I18nProvider";
import { apiFetch } from "@/lib/client";

const { Header, Content } = Layout;

export function DriverShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const selected = pathname.startsWith("/driver/team")
    ? "team"
    : pathname.startsWith("/driver/capacity")
      ? "capacity"
      : pathname.startsWith("/driver/tasks")
        ? "tasks"
        : pathname.startsWith("/driver/notifications")
          ? "notes"
          : pathname.startsWith("/driver/orders")
            ? "mine"
            : "hall";

  return (
    <Layout className="page-shell" style={{ background: "transparent" }}>
      <Header style={{ background: "#1d3557", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ color: "#fff", fontWeight: 700 }}>{t("driver.brand", "ANTS 司机")}</div>
        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={[selected]}
          style={{ flex: 1, background: "transparent", minWidth: 0 }}
          items={[
            { key: "hall", label: <Link href="/driver">{t("driver.hall", "订单中心")}</Link> },
            { key: "mine", label: <Link href="/driver/orders">{t("driver.mine", "我的订单")}</Link> },
            { key: "tasks", label: <Link href="/driver/tasks">{t("driver.tasks", "我的任务")}</Link> },
            { key: "capacity", label: <Link href="/driver/capacity">{t("driver.capacity", "运力")}</Link> },
            { key: "team", label: <Link href="/driver/team">{t("driver.team", "司机管理")}</Link> },
            { key: "notes", label: <Link href="/driver/notifications">{t("driver.notes", "通知")}</Link> },
          ]}
        />
        <Space>
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
      <Content style={{ maxWidth: 1100, width: "100%", margin: "24px auto", padding: "0 16px" }}>{children}</Content>
    </Layout>
  );
}
