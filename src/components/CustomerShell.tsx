"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Layout, Menu, Space, Typography } from "antd";
import { LocaleSwitch } from "@/components/LocaleSwitch";
import { useI18n } from "@/components/I18nProvider";
import { apiFetch } from "@/lib/client";

const { Header, Content } = Layout;

export function CustomerShell({ children, selected }: { children: React.ReactNode; selected: string }) {
  const { t } = useI18n();
  const router = useRouter();

  const logout = async () => {
    await apiFetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  return (
    <Layout className="page-shell" style={{ background: "transparent" }}>
      <Header style={{ background: "#083d30", display: "flex", alignItems: "center", gap: 16 }}>
        <Typography.Text style={{ color: "#fff", fontWeight: 700, fontSize: 18 }}>ynhll</Typography.Text>
        <Menu
          theme="dark"
          mode="horizontal"
          selectedKeys={[selected]}
          style={{ flex: 1, background: "transparent", minWidth: 0 }}
          items={[
            { key: "orders", label: <Link href="/orders">{t("nav.orders", "我的订单")}</Link> },
            { key: "new", label: <Link href="/orders/new">{t("nav.new_order", "新建订单")}</Link> },
          ]}
        />
        <Space>
          <LocaleSwitch />
          <Button size="small" onClick={logout}>
            {t("action.logout", "退出")}
          </Button>
        </Space>
      </Header>
      <Content style={{ maxWidth: 1100, width: "100%", margin: "24px auto", padding: "0 16px" }}>{children}</Content>
    </Layout>
  );
}
