import { OrderStatus, VehicleType } from "@prisma/client";

export function genOrderNo() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const rand = Math.floor(Math.random() * 900 + 100);
  return `ANTS-${y}${m}${day}-${rand}`;
}

export const ORDER_STATUS_FLOW: Partial<Record<OrderStatus, OrderStatus[]>> = {
  PENDING_REVIEW: [OrderStatus.MATCHED, OrderStatus.BIDDING, OrderStatus.REJECTED, OrderStatus.CANCELLED],
  BIDDING: [OrderStatus.MATCHED, OrderStatus.CANCELLED],
  MATCHED: [OrderStatus.IN_TRANSIT, OrderStatus.CANCELLED],
  IN_TRANSIT: [OrderStatus.DELIVERED, OrderStatus.CANCELLED],
  DELIVERED: [OrderStatus.COMPLETED],
};

export const VEHICLE_OPTIONS = Object.values(VehicleType);

export function canCustomerSeeDealPrice() {
  return false;
}
