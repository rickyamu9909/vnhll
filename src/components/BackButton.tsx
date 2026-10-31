"use client";

import Link from "next/link";
import { Button } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import { useI18n } from "@/components/I18nProvider";

export function BackButton({ href, label }: { href: string; label?: string }) {
  const { t } = useI18n();
  return (
    <Link href={href}>
      <Button icon={<ArrowLeftOutlined />}>{label || t("action.back", "返回上一页")}</Button>
    </Link>
  );
}
