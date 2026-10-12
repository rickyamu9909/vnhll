import { NextRequest } from "next/server";
import { OrderStatus } from "@prisma/client";
import { getSession, requireCustomer } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonFail, jsonOk } from "@/lib/api";
import { serializeMoney } from "@/lib/money";
import { createPublishedOrder, stripCustomer, sweepDeadlines } from "@/lib/market";

const SHOW_DRIVER: OrderStatus[] = [
  OrderStatus.PENDING_EXECUTION,
  OrderStatus.IN_TRANSIT,
  OrderStatus.DELIVERED,
  OrderStatus.COMPLETED,
  OrderStatus.MATCHED,
];

export async function GET() {
  const user = await getSession();
  if (!requireCustomer(user)) return jsonFail("未登录或无权限", 401);
  await sweepDeadlines();
  const orders = await prisma.order.findMany({
    where: { customerId: user!.id },
    include: {
      acceptedBy: { select: { id: true, displayName: true, username: true } },
      assignedTo: { select: { id: true, displayName: true, username: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return jsonOk(
    orders.map((o) => {
      const view = stripCustomer(o as unknown as Record<string, unknown>);
      const show = SHOW_DRIVER.includes(o.status);
      const who = o.assignedTo || o.acceptedBy;
      view.driverName = show && who ? who.displayName || who.username : null;
      delete view.acceptedBy;
      delete view.assignedTo;
      return view;
    })
  );
}

export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!requireCustomer(user)) return jsonFail("未登录或无权限", 401);
  try {
    const body = await req.json();
    const order = await createPublishedOrder(user!.id, body, user!.id, "客户发布订单");
    return jsonOk(stripCustomer(serializeMoney(order as unknown as Record<string, unknown>)));
  } catch (e) {
    return jsonFail((e as Error).message || "创建订单失败");
  }
}
