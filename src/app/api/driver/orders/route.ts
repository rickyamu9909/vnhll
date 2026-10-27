import { NextRequest } from "next/server";
import { MatchPath, OrderStatus, Prisma } from "@prisma/client";
import { getSession, requireCarrier } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { jsonFail, jsonOk } from "@/lib/api";
import { serializeMoney } from "@/lib/money";
import { sweepDeadlines } from "@/lib/market";
import { scoreRouteFit } from "@/lib/route-score";

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
  const executing = [OrderStatus.PENDING_EXECUTION, OrderStatus.IN_TRANSIT, OrderStatus.MATCHED, OrderStatus.DELIVERED];

  let where: Prisma.OrderWhereInput;
  if (scope === "tasks") {
    where = {
      status: { in: executing },
      OR: [{ assignedToUserId: user!.id }, { assignedToUserId: null, acceptedByUserId: user!.id }],
    };
  } else if (scope === "mine") {
    // 接单/被分配 + 自己报过价的单，都进「我的订单」
    where = {
      OR: [
        { acceptedByUserId: user!.id },
        { assignedToUserId: user!.id },
        { carrierBids: { some: { bidderUserId: user!.id } } },
      ],
    };
  } else {
    // 货源大厅：未成交；自己已报价的询价单不再出现在大厅
    where = {
      status: { in: [OrderStatus.OPEN, OrderStatus.BIDDING] },
      matchPath: { in: [MatchPath.A, MatchPath.B] },
      NOT: { carrierBids: { some: { bidderUserId: user!.id } } },
    };
  }

  const [orders, caps] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        carrierBids: dbUser?.role === "CARRIER_SUB" ? { where: { bidderUserId: user!.id } } : true,
      },
      orderBy: { createdAt: "desc" },
      take: scope === "mine" || scope === "tasks" ? 200 : 80,
    }),
    !scope ? prisma.capacity.findMany({ where: { publisherUserId: user!.id, status: "OPEN" }, take: 20 }) : Promise.resolve([]),
  ]);

  return jsonOk(
    orders.map((o) => {
      const view = serializeMoney(o as unknown as Record<string, unknown>);
      const mine = o.carrierBids.find((bid) => bid.bidderUserId === user!.id);
      view.myBidPriceVnd = mine ? mine.priceVnd.toString() : null;
      view.carrierBids = o.carrierBids.map((b) => ({ ...b, priceVnd: b.priceVnd.toString() }));
      if (!scope && caps.length) {
        let best: { score: number; reason: string } | null = null;
        for (const cap of caps) {
          const fit = scoreRouteFit({
            orderOrigin: o.originLat != null && o.originLng != null ? { lat: o.originLat, lng: o.originLng } : null,
            orderDest: o.destLat != null && o.destLng != null ? { lat: o.destLat, lng: o.destLng } : null,
            pickupAt: o.pickupAt,
            vehicleType: o.vehicleType,
            weightTons: o.weightTons,
            cargoType: o.cargoType,
            capLocation: cap.locationLat != null && cap.locationLng != null ? { lat: cap.locationLat, lng: cap.locationLng } : null,
            capDest: cap.destLat != null && cap.destLng != null ? { lat: cap.destLat, lng: cap.destLng } : null,
            availableFrom: cap.availableFrom,
            availableTo: cap.availableTo,
            capVehicleType: cap.vehicleType,
            loadTons: cap.loadTons,
            cargoTypes: cap.cargoTypes,
            airportOk: cap.airportOk,
            portOk: cap.portOk,
          });
          if (fit && (!best || fit.score > best.score)) best = { score: fit.score, reason: fit.reason };
        }
        view.bestScore = best?.score ?? 0;
        view.scoreReason = best?.reason ?? null;
      }
      return visiblePrice(user!.role, o.matchPath, view);
    })
  );
}
