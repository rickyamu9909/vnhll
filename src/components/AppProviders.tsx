"use client";

import { ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import viVN from "antd/locale/vi_VN";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { I18nProvider, useI18n } from "./I18nProvider";

function AntdLocale({ children }: { children: React.ReactNode }) {
  const { locale } = useI18n();
  return (
    <ConfigProvider
      locale={locale === "vi" ? viVN : zhCN}
      theme={{
        token: {
          colorPrimary: "#1677ff",
          borderRadius: 8,
        },
      }}
    >
      {children}
    </ConfigProvider>
  );
}

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <AntdRegistry>
      <I18nProvider>
        <AntdLocale>{children}</AntdLocale>
      </I18nProvider>
    </AntdRegistry>
  );
}
