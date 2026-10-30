"use client";

import { Button, Form, Input, Space } from "antd";
import { useI18n } from "@/components/I18nProvider";

export type QueryField = { name: string; placeholder: string; width?: number };

export function QueryFields({ fields, onSearch }: { fields: QueryField[]; onSearch: (values: Record<string, string>) => void }) {
  const { t } = useI18n();
  const [form] = Form.useForm();
  return (
    <Form form={form} layout="inline" size="small" onFinish={(values) => onSearch(values)} style={{ marginBottom: 12, rowGap: 8 }}>
      {fields.map((field) => (
        <Form.Item key={field.name} name={field.name} style={{ marginBottom: 8 }}>
          <Input allowClear placeholder={field.placeholder} style={{ width: field.width || 140 }} />
        </Form.Item>
      ))}
      <Form.Item style={{ marginBottom: 8 }}>
        <Space>
          <Button type="primary" htmlType="submit">
            {t("common.search", "查询")}
          </Button>
          <Button
            onClick={() => {
              form.resetFields();
              onSearch({});
            }}
          >
            {t("common.reset", "重置")}
          </Button>
        </Space>
      </Form.Item>
    </Form>
  );
}
