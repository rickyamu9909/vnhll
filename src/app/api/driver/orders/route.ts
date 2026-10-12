import { NextRequest } from "next/server";
import { MatchPath, OrderStatus } from "@prisma/client";
import { getSession, requireCarrier } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonFail, jsonOk } from "@/lib/api";
import { serializeMoney } from "@/lib/money";
import { sweepDeadlines } from "@/lib/market";

function visiblePrice(role: string, path: MatchPath | null, order: Record<string, unknown>) {
  if (role === "CARRIER_SUB" && path === MatchPath.A) {
    delete order.targetPriceVnd;
    delete order.customerBidVnd;
    delete order.dealPriceVnd;
    delete order.platformFeeVnd;
    delete order.driverIncomeVnd;
    delete order.commissionBps;
  }
  if (role === "CARRIER_SUB") {
    delete order.platformFeeVnd;
    delete order.driverIncomeVnd;
    delete order.commissionBps;
  }
  return order;
}

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!requireCarrier(user)) return jsonFail("未登录或无权限", 401);
  await sweepDeadlines();
  const scope = req.nextUrl.searchParams.get("scope");
  const dbUser = await prisma.user.findUnique({ where: { id: user!.id } });
  const where =
    scope === "tasks"
      ? { assignedToUserId: user!.id }
      : scope === "mine"
        ? { OR: [{ acceptedByUserId: user!.id }, { assignedToUserId: user!.id }] }
        : {
            status: { in: [OrderStatus.OPEN, OrderStatus.PENDING_CONFIRM] },
            matchPath: { in: [MatchPath.A, MatchPath.B] },
          };
  const orders = await prisma.order.findMany({
    where,
    include: {
      carrierBids: dbUser?.role === "CARRIER_SUB" ? { where: { bidderUserId: user!.id } } : true,
    },
    orderBy: { createdAt: "desc" },
  });
  return jsonOk(
    orders.map((o) => {
      const view = serializeMoney(o as unknown as Record<string, unknown>);
      view.carrierBids = o.carrierBids.map((b) => ({ ...b, priceVnd: b.priceVnd.toString() }));
      return visiblePrice(user!.role, o.matchPath, view);
    })
  );
}
