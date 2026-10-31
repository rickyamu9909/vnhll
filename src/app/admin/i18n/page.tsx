"use client";

import { useEffect, useState } from "react";
import { Button, Card, Space, Table, Typography, Upload, message, Input } from "antd";
import { DownloadOutlined, UploadOutlined, SyncOutlined } from "@ant-design/icons";
import { AdminShell } from "@/components/AdminShell";
import { useI18n } from "@/components/I18nProvider";
import { apiFetch } from "@/lib/client";

type Row = { id: string; key: string; zh: string; vi: string; groupName: string };

export default function AdminI18nPage() {
  const { t, reload } = useI18n();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [csvText, setCsvText] = useState("");

  const load = async () => {
    setLoading(true);
    const res = await apiFetch<Row[]>("/api/admin/i18n");
    setLoading(false);
    if (!res.ok) {
      message.error(res.message || t("msg.load_fail", "加载失败"));
      return;
    }
    setRows(res.data || []);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exportCsv = () => {
    window.open("/api/admin/i18n?format=csv", "_blank");
  };

  const syncPack = async () => {
    setSyncing(true);
    const res = await apiFetch<{ keys: number; upserted: number }>("/api/admin/i18n", {
      method: "POST",
      body: JSON.stringify({ action: "sync" }),
    });
    setSyncing(false);
    if (!res.ok) {
      message.error(res.message || t("msg.fail", "失败"));
      return;
    }
    message.success(`${t("admin.synced", "已同步语言包")} (${res.data?.upserted || 0}/${res.data?.keys || 0})`);
    await load();
    await reload();
  };

  const importCsv = async () => {
    if (!csvText.trim()) {
      message.warning(t("admin.i18n_tip", "支持中越双语。可导出 CSV（列: key, zh, vi, group）→ 人工校对 → 粘贴导入更新。"));
      return;
    }
    const res = await apiFetch<{ imported: number }>("/api/admin/i18n", {
      method: "POST",
      body: JSON.stringify({ csv: csvText }),
    });
    if (!res.ok) {
      message.error(res.message || t("msg.fail", "失败"));
      return;
    }
    message.success(`${t("admin.i18n_import", "导入更新")} ${res.data?.imported || 0}`);
    setCsvText("");
    await load();
    await reload();
  };

  return (
    <AdminShell>
      <Typography.Title level={3}>{t("nav.admin_i18n", "语言包")}</Typography.Title>
      <Card style={{ marginBottom: 16 }}>
        <Typography.Paragraph>{t("admin.i18n_tip", "支持中越双语。可导出 CSV（列: key, zh, vi, group）→ 人工校对 → 粘贴导入更新。")}</Typography.Paragraph>
        <Space wrap style={{ marginBottom: 12 }}>
          <Button icon={<SyncOutlined />} loading={syncing} onClick={syncPack}>
            {t("admin.sync_pack", "同步代码词库")}
          </Button>
          <Button icon={<DownloadOutlined />} onClick={exportCsv}>
            Xuất CSV
          </Button>
          <Upload
            accept=".csv,text/csv"
            showUploadList={false}
            beforeUpload={async (file) => {
              const text = await file.text();
              setCsvText(text);
              message.success("OK");
              return false;
            }}
          >
            <Button icon={<UploadOutlined />}>Chọn tệp CSV</Button>
          </Upload>
          <Button type="primary" onClick={importCsv}>
            {t("admin.i18n_import", "导入更新")}
          </Button>
        </Space>
        <Input.TextArea
          rows={6}
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          placeholder={"key,zh,vi,group\napp.name,ANTS 越南散货车,ANTS Vận tải Việt Nam,common"}
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
            { title: "zh", dataIndex: "zh" },
            { title: "vi", dataIndex: "vi" },
            { title: "group", dataIndex: "groupName", width: 100 },
          ]}
        />
      </Card>
    </AdminShell>
  );
}
