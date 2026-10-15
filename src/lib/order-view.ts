import { pathLabel, statusLabel } from "./client";

export type OrderListRow = {
  id: string;
  orderNo: string;
  status: string;
  matchPath?: string | null;
  cargoName?: string | null;
  vehicleType?: string | null;
  weightTons?: number | null;
  customerBidVnd?: string | null;
  targetPriceVnd?: string | null;
  dealPriceVnd?: string | null;
  pickupAt?: string | null;
  originAddress?: string | null;
  pickupAddress?: string | null;
  destAddress?: string | null;
  deliveryAddress?: string | null;
  pickupContact?: string | null;
  pickupPhone?: string | null;
  deliveryContact?: string | null;
  deliveryPhone?: string | null;
  myBidPriceVnd?: string | null;
  driverStage?: string | null;
};

export const CUSTOMER_NODE_TABS = [
  { key: "all", label: "全部" },
  { key: "matching", label: "匹配中" },
  { key: "confirm", label: "待确认报价" },
  { key: "pickup", label: "待接货" },
  { key: "transit", label: "运输中" },
  { key: "delivered", label: "已送达" },
  { key: "done", label: "已完成" },
  { key: "closed", label: "已取消" },
];

export const DRIVER_NODE_TABS = [
  { key: "all", label: "全部" },
  { key: "quoted", label: "已报价" },
  { key: "pickup", label: "待接货" },
  { key: "transit", label: "运输中" },
  { key: "delivered", label: "已送达" },
  { key: "done", label: "已完成" },
  { key: "closed", label: "已取消" },
];

export const TASK_NODE_TABS = [
  { key: "all", label: "全部" },
  { key: "pickup", label: "待接货" },
  { key: "transit", label: "运输中" },
  { key: "delivered", label: "已送达" },
];

const TAB_STATUS: Record<string, string[]> = {
  matching: ["OPEN", "BIDDING"],
  confirm: ["PENDING_CONFIRM"],
  pickup: ["PENDING_EXECUTION", "MATCHED"],
  transit: ["IN_TRANSIT"],
  delivered: ["DELIVERED"],
  done: ["COMPLETED"],
  closed: ["CANCELLED", "FAILED", "REJECTED"],
};

export function zhStatus(status: string) {
  return statusLabel(status, (_key, fallback) => fallback || "");
}

export function orderInTab(row: OrderListRow, tab: string) {
  if (!tab || tab === "all") return true;
  if (tab === "quoted") {
    return !!row.myBidPriceVnd && ["OPEN", "PENDING_CONFIRM", "PENDING_AUDIT", "LOCKED"].includes(row.status);
  }
  return (TAB_STATUS[tab] || []).includes(row.status);
}

export function displayStatus(row: OrderListRow, t: (key: string, fallback?: string) => string) {
  if (row.myBidPriceVnd && ["OPEN", "LOCKED", "PENDING_AUDIT"].includes(row.status)) return "已报价";
  if (row.myBidPriceVnd && row.status === "PENDING_CONFIRM") return "已报价 · 待客户确认";
  return statusLabel(row.status, t);
}

export function includesText(value: unknown, query?: string) {
  const text = String(query || "").trim().toLowerCase();
  if (!text) return true;
  return String(value ?? "").toLowerCase().includes(text);
}

export function orderMatches(row: OrderListRow, query: Record<string, string>) {
  const origin = [row.originAddress, row.pickupAddress, row.pickupContact].filter(Boolean).join(" ");
  const dest = [row.destAddress, row.deliveryAddress, row.deliveryContact].filter(Boolean).join(" ");
  const phone = [row.pickupPhone, row.deliveryPhone].filter(Boolean).join(" ");
  const price = [row.targetPriceVnd, row.customerBidVnd, row.dealPriceVnd, row.myBidPriceVnd].filter(Boolean).join(" ");
  return (
    includesText(row.orderNo, query.q) &&
    includesText(`${row.status} ${zhStatus(row.status)} ${displayStatus(row, (_key, fallback) => fallback || "")}`, query.status) &&
    includesText(`${row.matchPath || ""} ${pathLabel(row.matchPath)}`, query.path) &&
    includesText(origin, query.origin) &&
    includesText(dest, query.dest) &&
    includesText(phone, query.phone) &&
    includesText(row.cargoName, query.cargo) &&
    includesText(row.vehicleType, query.vehicle) &&
    includesText(row.pickupAt, query.date) &&
    includesText(price, query.price)
  );
}

export const ORDER_QUERY_FIELDS = [
  { name: "q", placeholder: "订单号" },
  { name: "status", placeholder: "状态" },
  { name: "path", placeholder: "路径" },
  { name: "origin", placeholder: "起运地" },
  { name: "dest", placeholder: "目的地" },
  { name: "phone", placeholder: "电话" },
  { name: "cargo", placeholder: "货物" },
  { name: "vehicle", placeholder: "车型", width: 110 },
  { name: "date", placeholder: "接货时间", width: 120 },
  { name: "price", placeholder: "价格", width: 110 },
];
