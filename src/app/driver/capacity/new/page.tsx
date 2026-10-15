"use client";

import { useRouter } from "next/navigation";
import { Typography, message } from "antd";
import { DriverShell } from "@/components/DriverShell";
import { BackButton } from "@/components/BackButton";
import { CapacityForm } from "@/components/CapacityForm";
import { useI18n } from "@/components/I18nProvider";
import { apiFetch } from "@/lib/client";

export default function NewCapacityPage() {
  const router = useRouter();
  const { t } = useI18n();
  return (
    <DriverShell>
      <BackButton href="/driver/capacity" />
      <Typography.Title level={3}>{t("cap.title", "发布运力")}</Typography.Title>
      <CapacityForm
        submitText={t("cap.publish", "发布")}
        onSubmit={async (body) => {
          const res = await apiFetch("/api/driver/capacity", { method: "POST", body: JSON.stringify(body) });
          if (!res.ok) {
            message.error(res.message || t("cap.fail", "发布失败"));
            return;
          }
          message.success(t("cap.ok", "已发布，已进入匹配池"));
          router.push("/driver/capacity");
        }}
      />
    </DriverShell>
  );
}
