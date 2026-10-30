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
  { key: "all", labelKey: "tab.all" },
  { key: "matching", labelKey: "tab.matching" },
  { key: "confirm", labelKey: "tab.confirm" },
  { key: "pickup", labelKey: "tab.pickup" },
  { key: "transit", labelKey: "tab.transit" },
  { key: "delivered", labelKey: "tab.delivered" },
  { key: "done", labelKey: "tab.done" },
  { key: "closed", labelKey: "tab.closed" },
];

export const DRIVER_NODE_TABS = [
  { key: "all", labelKey: "tab.all" },
  { key: "quoted", labelKey: "tab.quoted" },
  { key: "pickup", labelKey: "tab.pickup" },
  { key: "transit", labelKey: "tab.transit" },
  { key: "delivered", labelKey: "tab.delivered" },
  { key: "done", labelKey: "tab.done" },
  { key: "closed", labelKey: "tab.closed" },
];

export const TASK_NODE_TABS = [
  { key: "all", labelKey: "tab.all" },
  { key: "pickup", labelKey: "tab.pickup" },
  { key: "transit", labelKey: "tab.transit" },
  { key: "delivered", labelKey: "tab.delivered" },
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

export function orderInTab(row: OrderListRow, tab: string) {
  if (!tab || tab === "all") return true;
  if (tab === "quoted") {
    return !!row.myBidPriceVnd && ["OPEN", "PENDING_CONFIRM", "PENDING_AUDIT", "LOCKED"].includes(row.status);
  }
  return (TAB_STATUS[tab] || []).includes(row.status);
}

export function displayStatus(row: OrderListRow, t: (key: string, fallback?: string) => string) {
  if (row.myBidPriceVnd && ["OPEN", "LOCKED", "PENDING_AUDIT"].includes(row.status)) return t("order.quoted", "已报价");
  if (row.myBidPriceVnd && row.status === "PENDING_CONFIRM") return t("order.quoted_wait", "已报价 · 待客户确认");
  return statusLabel(row.status, t);
}

export function includesText(value: unknown, query?: string) {
  const text = String(query || "").trim().toLowerCase();
  if (!text) return true;
  return String(value ?? "").toLowerCase().includes(text);
}

export function orderMatches(row: OrderListRow, query: Record<string, string>, t?: (key: string, fallback?: string) => string) {
  const translate = t || ((key: string, fallback?: string) => fallback || key);
  const origin = [row.originAddress, row.pickupAddress, row.pickupContact].filter(Boolean).join(" ");
  const dest = [row.destAddress, row.deliveryAddress, row.deliveryContact].filter(Boolean).join(" ");
  const phone = [row.pickupPhone, row.deliveryPhone].filter(Boolean).join(" ");
  const price = [row.targetPriceVnd, row.customerBidVnd, row.dealPriceVnd, row.myBidPriceVnd].filter(Boolean).join(" ");
  return (
    includesText(row.orderNo, query.q) &&
    includesText(`${row.status} ${statusLabel(row.status, translate)} ${displayStatus(row, translate)}`, query.status) &&
    includesText(`${row.matchPath || ""} ${pathLabel(row.matchPath, translate)}`, query.path) &&
    includesText(origin, query.origin) &&
    includesText(dest, query.dest) &&
    includesText(phone, query.phone) &&
    includesText(row.cargoName, query.cargo) &&
    includesText(row.vehicleType, query.vehicle) &&
    includesText(row.pickupAt, query.date) &&
    includesText(price, query.price)
  );
}

export function orderQueryFields(t: (key: string, fallback?: string) => string) {
  return [
    { name: "q", placeholder: t("order.order_no", "订单号") },
    { name: "status", placeholder: t("order.status", "状态") },
    { name: "path", placeholder: t("order.path", "路径") },
    { name: "origin", placeholder: t("order.origin", "起运地") },
    { name: "dest", placeholder: t("order.dest", "目的地") },
    { name: "phone", placeholder: t("order.phone_q", "电话") },
    { name: "cargo", placeholder: t("order.cargo_q", "货物") },
    { name: "vehicle", placeholder: t("form.vehicle", "车型"), width: 110 },
    { name: "date", placeholder: t("form.pickup_at", "接货时间"), width: 120 },
    { name: "price", placeholder: t("order.price", "价格"), width: 110 },
  ];
}

/** @deprecated 使用 orderQueryFields(t) */
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
