"use client";

import { Alert, Space, Typography } from "antd";
import dayjs from "dayjs";
import { ActionButton } from "@/components/ActionButton";
import { pathLabel } from "@/lib/client";

export function PostPublishGuide({
  orderId,
  orderNo,
  matchPath,
  waitDeadline,
  routeLabel,
}: {
  orderId: string;
  orderNo: string;
  matchPath?: string | null;
  waitDeadline?: string | null;
  routeLabel?: string | null;
}) {
  const remain = waitDeadline ? Math.max(0, dayjs(waitDeadline).diff(dayjs(), "hour", true)) : null;
  return (
    <Alert
      type="success"
      showIcon
      style={{ marginBottom: 16 }}
      message={`${orderNo} 已进入匹配池`}
      description={
        <Space direction="vertical" size={4}>
          <Typography.Text>
            匹配方式：{pathLabel(matchPath)}。
            {matchPath === "A" ? "主账号/个人司机可按你的目标价接单。" : matchPath === "B" ? "司机会报价，你再挑选。" : "你已通过运力匹配成交或发起协商。"}
          </Typography.Text>
          {routeLabel ? <Typography.Text>本票运输：{routeLabel}</Typography.Text> : null}
          {remain != null ? (
            <Typography.Text>
              大约还有 {remain.toFixed(1)} 小时等待匹配；超时未成交会流标。匹配中可延长 1 次。流标后可改价重发。
            </Typography.Text>
          ) : (
            <Typography.Text>系统会把顺路司机推到货源侧；请关注报价与确认通知。</Typography.Text>
          )}
          <Space wrap>
            <ActionButton href={`/orders/${orderId}`} tone="primary">
              查看订单进度
            </ActionButton>
            <ActionButton href="/orders" tone="default">
              回我的订单
            </ActionButton>
          </Space>
        </Space>
      }
    />
  );
}
