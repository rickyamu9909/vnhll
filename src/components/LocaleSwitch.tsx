"use client";

import { Select, Space } from "antd";
import { useI18n } from "./I18nProvider";

export function LocaleSwitch() {
  const { locale, setLocale } = useI18n();
  return (
    <Space>
      <Select
        size="small"
        value={locale}
        style={{ width: 110 }}
        onChange={(v) => setLocale(v)}
        options={[
          { value: "zh", label: "中文" },
          { value: "vi", label: "Tiếng Việt" },
        ]}
      />
    </Space>
  );
}
