import { randomBytes } from "crypto";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { serializeMoney } from "@/lib/money";

const HIDE_FROM_CREW = new Set([
  "targetPriceVnd",
  "dealPriceVnd",
  "platformFeeVnd",
  "driverIncomeVnd",
  "customerBidVnd",
  "commissionBps",
  "carrierBids",
  "myBidPriceVnd",
  "crewTrackToken",
  "adminNote",
  "rejectReason",
  "notifyNote",
]);

export function publicOrigin(req: NextRequest) {
  const proto = req.headers.get("x-forwarded-proto") || "https";
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
  return `${proto}://${host}`;
}

export async function ensureCrewTrackToken(orderId: string, userId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { id: true, crewTrackToken: true, acceptedByUserId: true, assignedToUserId: true },
  });
  if (!order) throw new Error("订单不存在");
  if (order.acceptedByUserId !== userId && order.assignedToUserId !== userId) {
    throw new Error("无权生成跟踪链接");
  }
  if (order.crewTrackToken) return order.crewTrackToken;
  for (let i = 0; i < 5; i++) {
    const token = randomBytes(18).toString("base64url");
    try {
      await prisma.order.update({ where: { id: orderId }, data: { crewTrackToken: token } });
      return token;
    } catch {
      /* unique collision retry */
    }
  }
  throw new Error("生成跟踪链接失败");
}

export async function findOrderByCrewToken(token: string) {
  const clean = String(token || "").trim();
  if (!clean || clean.length < 16) return null;
  return prisma.order.findUnique({
    where: { crewTrackToken: clean },
    include: { cargoItems: true },
  });
}

export function serializeCrewOrder(order: Record<string, unknown>) {
  const view = serializeMoney(order) as Record<string, unknown>;
  for (const key of HIDE_FROM_CREW) delete view[key];
  delete view.customer;
  return view;
}
