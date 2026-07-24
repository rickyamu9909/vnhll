"use client";

import { useEffect, useState } from "react";
import { Button, Card, Space, Table, Typography, Upload, message, Input } from "antd";
import { DownloadOutlined, UploadOutlined } from "@ant-design/icons";
import { AdminShell } from "@/components/AdminShell";
import { useI18n } from "@/components/I18nProvider";
import { apiFetch } from "@/lib/client";

type Row = { id: string; key: string; zh: string; vi: string; groupName: string };

export default function AdminI18nPage() {
  const { t, reload } = useI18n();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [csvText, setCsvText] = useState("");

  const load = async () => {
    setLoading(true);
    const res = await apiFetch<Row[]>("/api/admin/i18n");
    setLoading(false);
    if (!res.ok) {
      message.error(res.message || "加载失败");
      return;
    }
    setRows(res.data || []);
  };

  useEffect(() => {
    load();
  }, []);

  const exportCsv = () => {
    window.open("/api/admin/i18n?format=csv", "_blank");
  };

  const importCsv = async () => {
    if (!csvText.trim()) {
      message.warning("请粘贴 CSV 内容");
      return;
    }
    const res = await apiFetch<{ imported: number }>("/api/admin/i18n", {
      method: "POST",
      body: JSON.stringify({ csv: csvText }),
    });
    if (!res.ok) {
      message.error(res.message || "导入失败");
      return;
    }
    message.success(`已导入 ${res.data?.imported || 0} 条`);
    setCsvText("");
    await load();
    await reload();
  };

  return (
    <AdminShell>
      <Typography.Title level={3}>{t("nav.admin_i18n", "语言包")}</Typography.Title>
      <Card style={{ marginBottom: 16 }}>
        <Typography.Paragraph>
          支持中越双语。可导出 CSV（列：key,zh,vi,group）→ 人工校对 → 粘贴导入更新，用于修正机翻不准的文案。
        </Typography.Paragraph>
        <Space wrap style={{ marginBottom: 12 }}>
          <Button icon={<DownloadOutlined />} onClick={exportCsv}>
            导出 CSV
          </Button>
          <Upload
            accept=".csv,text/csv"
            showUploadList={false}
            beforeUpload={async (file) => {
              const text = await file.text();
              setCsvText(text);
              message.success("已读取文件，请点击导入");
              return false;
            }}
          >
            <Button icon={<UploadOutlined />}>选择 CSV 文件</Button>
          </Upload>
          <Button type="primary" onClick={importCsv}>
            导入更新
          </Button>
        </Space>
        <Input.TextArea
          rows={6}
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          placeholder={"key,zh,vi,group\napp.name,ynhll 越南散货车,ynhll Vận tải Việt Nam,common"}
        />
      </Card>
      <Card>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={rows}
          pagination={{ pageSize: 20 }}
          columns={[
            { title: "key", dataIndex: "key", width: 220 },
            { title: "中文 zh", dataIndex: "zh" },
            { title: "越南语 vi", dataIndex: "vi" },
            { title: "分组", dataIndex: "groupName", width: 100 },
          ]}
        />
      </Card>
    </AdminShell>
  );
}
