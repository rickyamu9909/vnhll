"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card } from "antd";
import { DriverShell } from "@/components/DriverShell";

/** 我的任务已并入「我的订单」，保留路由以免旧链接 404 */
export default function TasksRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/driver/orders");
  }, [router]);
  return (
    <DriverShell>
      <Card loading />
    </DriverShell>
  );
}
