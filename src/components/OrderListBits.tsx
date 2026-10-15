"use client";

import Link from "next/link";
import { Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import { pathLabel, vehicleLabel } from "@/lib/client";
import { displayStatus, type OrderListRow } from "@/lib/order-view";
import { formatVnd } from "@/lib/money";

export function orderColumns(
  t: (key: string, fallback?: string) => string,
  extra?: ColumnsType<OrderListRow>[number]
): ColumnsType<OrderListRow> {
  const columns: ColumnsType<OrderListRow> = [
    { title: "订单号", dataIndex: "orderNo", width: 170, fixed: "left" },
    { title: "状态", width: 140, render: (_, row) => <Tag>{displayStatus(row, t)}</Tag> },
    { title: "路径", dataIndex: "matchPath", width: 100, render: (value) => pathLabel(value) },
    { title: "起运", width: 180, render: (_, row) => row.originAddress || row.pickupAddress || "-" },
    { title: "目的", width: 180, render: (_, row) => row.destAddress || row.deliveryAddress || "-" },
    { title: "联系人", width: 160, render: (_, row) => [row.pickupContact, row.pickupPhone].filter(Boolean).join(" / ") || "-" },
    { title: "货物", dataIndex: "cargoName", width: 140, render: (value) => value || "-" },
    { title: "重量(吨)", dataIndex: "weightTons", width: 90, render: (value) => value ?? "-" },
    { title: "车型", dataIndex: "vehicleType", width: 90, render: (value) => (value ? vehicleLabel(value, t) : "-") },
    {
      title: "价格",
      width: 130,
      render: (_, row) => formatVnd(row.dealPriceVnd || row.myBidPriceVnd || row.targetPriceVnd || row.customerBidVnd || ""),
    },
    { title: "接货时间", dataIndex: "pickupAt", width: 140, render: (value) => (value ? dayjs(value).format("MM-DD HH:mm") : "-") },
  ];
  if (extra) columns.push(extra);
  return columns;
}

export function orderLink(href: string, text: string) {
  return <Link href={href}>{text}</Link>;
}
