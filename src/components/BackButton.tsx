"use client";

import Link from "next/link";
import { Button } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";

export function BackButton({ href, label = "返回上一页" }: { href: string; label?: string }) {
  return (
    <Link href={href}>
      <Button icon={<ArrowLeftOutlined />}>{label}</Button>
    </Link>
  );
}
