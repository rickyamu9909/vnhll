import { NextRequest } from "next/server";
import { OrderStatus } from "@prisma/client";
import { getSession, requireCustomer } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonFail, jsonOk } from "@/lib/api";
import { toBigIntMoney } from "@/lib/money";
import {
  cancelOrder,
  confirmBid,
  customerComplete,
  customerRevise,
  extendOrder,
  rejectAllBids,
  stripCustomer,
  sweepDeadlines,
} from "@/lib/market";

type Ctx = { params: { id: string } };

const SHOW_BIDS: OrderStatus[] = [
  OrderStatus.PENDING_CONFIRM,
  OrderStatus.PENDING_AUDIT,
  OrderStatus.PENDING_EXECUTION,
  OrderStatus.IN_TRANSIT,
  OrderStatus.DELIVERED,
  OrderStatus.COMPLETED,
  OrderStatus.LOCKED,
  OrderStatus.MATCHED,
];

export async function GET(_req: NextRequest, { params }: Ctx) {
  const user = await getSession();
  if (!requireCustomer(user)) return jsonFail("未登录或无权限", 401);
  await sweepDeadlines();
  const order = await prisma.order.findFirst({
    where: { id: params.id, customerId: user!.id },
    include: {
      cargoItems: true,
      carrierBids: {
        include: { bidder: { select: { id: true, displayName: true, username: true, carrierKind: true } } },
        orderBy: { priceVnd: "asc" },
      },
      acceptedBy: { select: { displayName: true, username: true } },
      assignedTo: { select: { displayName: true, username: true } },
    },
  });
  if (!order) return jsonFail("订单不存在", 404);
  const view = stripCustomer(order as unknown as Record<string, unknown>);
  if (!SHOW_BIDS.includes(order.status)) view.carrierBids = [];
  else {
    view.carrierBids = order.carrierBids.map((b) => ({
      id: b.id,
      priceVnd: b.priceVnd.toString(),
      bidderName: b.bidder.displayName || b.bidder.username,
      createdAt: b.createdAt,
    }));
  }
  const showDriverStatuses: OrderStatus[] = [
    OrderStatus.PENDING_EXECUTION,
    OrderStatus.IN_TRANSIT,
    OrderStatus.DELIVERED,
    OrderStatus.COMPLETED,
    OrderStatus.MATCHED,
  ];
  const showDriver = showDriverStatuses.includes(order.status);
  const who = order.assignedTo || order.acceptedBy;
  let plate: string | null = null;
  if (showDriver && order.acceptedByUserId) {
    const vehicle = await prisma.vehicle.findFirst({
      where: { ownerUserId: order.acceptedByUserId },
    });
    plate = vehicle?.plateNumber || null;
  }
  view.driverName = showDriver && who ? who.displayName || who.username : null;
  view.plateNumber = showDriver ? plate : null;
  delete view.acceptedBy;
  delete view.assignedTo;
  return jsonOk(view);
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const user = await getSession();
  if (!requireCustomer(user)) return jsonFail("未登录或无权限", 401);
  try {
    const body = await req.json();
    const updated = await customerRevise(params.id, user!.id, body);
    return jsonOk(stripCustomer(updated as unknown as Record<string, unknown>));
  } catch (e) {
    return jsonFail((e as Error).message || "修改失败");
  }
}

export async function POST(req: NextRequest, { params }: Ctx) {
  const user = await getSession();
  if (!requireCustomer(user)) return jsonFail("未登录或无权限", 401);
  const body = await req.json();
  const action = String(body.action || "");
  try {
    if (action === "cancel") return jsonOk(await cancelOrder(params.id, user!.id));
    if (action === "confirm_complete") return jsonOk(await customerComplete(params.id, user!.id));
    if (action === "confirm_bid") return jsonOk(await confirmBid(params.id, user!.id, String(body.bidId)));
    if (action === "reject_all") return jsonOk(await rejectAllBids(params.id, user!.id));
    if (action === "extend") return jsonOk(await extendOrder(params.id, user!.id));
    if (action === "place_unused") return jsonOk(toBigIntMoney(0));
    return jsonFail("未知操作");
  } catch (e) {
    return jsonFail((e as Error).message || "操作失败");
  }
}
